from typing import Any
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_optional_current_user
from app.models.user import User
from app.schemas.image import ImageResponse
from app.services.image_service import ImageService

router = APIRouter(prefix="/reports", tags=["Images"])


@router.post(
    "/{report_id}/images",
    response_model=ImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image for an item report",
)
async def upload_image(
    report_id: int,
    file: UploadFile = File(...),
    is_primary: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Upload an image file (JPEG, PNG, WebP) up to 5MB. Enforces ownership and content verification."""
    image_record = await ImageService.upload_image(
        db=db,
        report_id=report_id,
        file=file,
        user=current_user,
        is_primary=is_primary,
    )
    return image_record


@router.get(
    "/{report_id}/images/{image_id}",
    summary="Retrieve or stream an uploaded image file",
)
def get_image_file(
    report_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_current_user),
) -> Any:
    """Stream stored image file. Unverified report images require owner or staff authorization."""
    file_path, content_type = ImageService.get_image_file_path(
        db=db,
        report_id=report_id,
        image_id=image_id,
        user=current_user,
    )
    return FileResponse(path=file_path, media_type=content_type)


@router.delete(
    "/{report_id}/images/{image_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete an uploaded report image",
)
def delete_image(
    report_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Delete image metadata and remove physical file from storage."""
    ImageService.delete_image(
        db=db,
        report_id=report_id,
        image_id=image_id,
        user=current_user,
    )
    return {"message": "Image successfully deleted."}
