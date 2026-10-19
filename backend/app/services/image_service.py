import os
from pathlib import Path
import uuid
from typing import Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.enums import UserRole
from app.models.history import AuditLog
from app.models.report import ItemImage, ItemReport
from app.models.user import User

settings = get_settings()

# Magic bytes signatures for supported image formats
IMAGE_SIGNATURES = {
    "image/jpeg": [b"\xFF\xD8\xFF"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # Starts with RIFF and has WEBP at offset 8
}

ALLOWED_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class ImageService:
    """Service handling validated image upload, storage, metadata, and safe file serving."""

    @staticmethod
    def _ensure_upload_dir() -> Path:
        """Ensure local upload directory exists."""
        upload_path = Path(settings.UPLOAD_DIR).resolve()
        upload_path.mkdir(parents=True, exist_ok=True)
        return upload_path

    @staticmethod
    def detect_content_type(header_bytes: bytes) -> Optional[str]:
        """Verify actual image type using magic byte signatures."""
        if header_bytes.startswith(b"\xFF\xD8\xFF"):
            return "image/jpeg"
        if header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if header_bytes.startswith(b"RIFF") and len(header_bytes) >= 12 and header_bytes[8:12] == b"WEBP":
            return "image/webp"
        return None

    @staticmethod
    async def upload_image(
        db: Session,
        report_id: int,
        file: UploadFile,
        user: User,
        is_primary: bool = False,
    ) -> ItemImage:
        """Validate and store an uploaded image attached to an item report."""
        report = db.scalar(select(ItemReport).where(ItemReport.report_id == report_id))
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report with ID {report_id} not found.",
            )

        # Ownership check
        is_owner = report.created_by == user.user_id
        is_staff_or_admin = user.role in (UserRole.STAFF, UserRole.ADMIN)
        if not (is_owner or is_staff_or_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to attach images to this report.",
            )

        # Read content and enforce size limits
        contents = await file.read()
        file_size = len(contents)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )
        if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
            )

        # Validate true MIME type using magic bytes
        content_type = ImageService.detect_content_type(contents[:16])
        if not content_type:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Unsupported or invalid image format. Only JPEG, PNG, and WebP are accepted.",
            )

        # Generate a safe, collision-resistant storage key (prevents directory traversal)
        extension = ALLOWED_EXTENSIONS[content_type]
        safe_filename = f"{uuid.uuid4().hex}{extension}"
        upload_dir = ImageService._ensure_upload_dir()
        storage_file_path = upload_dir / safe_filename

        # Write to local filesystem
        with open(storage_file_path, "wb") as f:
            f.write(contents)

        # If designated as primary, unset other primary images for this report
        if is_primary:
            existing_images = db.scalars(select(ItemImage).where(ItemImage.report_id == report_id)).all()
            for img in existing_images:
                img.is_primary = False

        # Record metadata
        original_filename = Path(file.filename or "image").name  # Sanitize
        image_record = ItemImage(
            report_id=report_id,
            storage_path=safe_filename,
            display_filename=original_filename,
            content_type=content_type,
            file_size=file_size,
            is_primary=is_primary,
        )
        db.add(image_record)

        audit = AuditLog(
            actor_user_id=user.user_id,
            action="IMAGE_UPLOADED",
            entity_type="ItemImage",
            entity_id=str(report_id),
            summary=f'{{"filename": "{safe_filename}", "size": {file_size}, "type": "{content_type}"}}',
        )
        db.add(audit)
        db.commit()
        db.refresh(image_record)
        return image_record

    @staticmethod
    def get_image_file_path(
        db: Session,
        report_id: int,
        image_id: int,
        user: Optional[User] = None,
    ) -> Tuple[Path, str]:
        """Resolve physical image path while enforcing privacy constraints."""
        report = db.scalar(select(ItemReport).where(ItemReport.report_id == report_id))
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found.",
            )

        image = db.scalar(
            select(ItemImage).where(
                ItemImage.image_id == image_id,
                ItemImage.report_id == report_id,
            )
        )
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found.",
            )

        # If report is not verified, only owner or staff can view image
        is_owner = user and report.created_by == user.user_id
        is_staff_or_admin = user and user.role in (UserRole.STAFF, UserRole.ADMIN)
        if report.moderation_status.value != "verified" and not (is_owner or is_staff_or_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Image is part of an unverified report.",
            )

        upload_dir = ImageService._ensure_upload_dir()
        resolved_path = (upload_dir / image.storage_path).resolve()

        # Prevent directory traversal: path must stay within UPLOAD_DIR
        if not str(resolved_path).startswith(str(upload_dir)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path detected.",
            )

        if not resolved_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored image file is missing.",
            )

        return resolved_path, image.content_type

    @staticmethod
    def delete_image(
        db: Session,
        report_id: int,
        image_id: int,
        user: User,
    ) -> None:
        """Delete image metadata and physical file if authorized."""
        report = db.scalar(select(ItemReport).where(ItemReport.report_id == report_id))
        if not report:
            raise HTTPException(status_code=404, detail="Report not found.")

        is_owner = report.created_by == user.user_id
        is_staff = user.role in (UserRole.STAFF, UserRole.ADMIN)
        if not (is_owner or is_staff):
            raise HTTPException(status_code=403, detail="Permission denied to delete image.")

        image = db.scalar(
            select(ItemImage).where(
                ItemImage.image_id == image_id,
                ItemImage.report_id == report_id,
            )
        )
        if not image:
            raise HTTPException(status_code=404, detail="Image not found.")

        # Remove physical file if it exists
        upload_dir = ImageService._ensure_upload_dir()
        file_path = upload_dir / image.storage_path
        if file_path.exists():
            try:
                os.remove(file_path)
            except OSError:
                pass

        db.delete(image)
        audit = AuditLog(
            actor_user_id=user.user_id,
            action="IMAGE_DELETED",
            entity_type="ItemImage",
            entity_id=str(image_id),
            summary=f'{{"report_id": {report_id}, "image_id": {image_id}}}',
        )
        db.add(audit)
        db.commit()
