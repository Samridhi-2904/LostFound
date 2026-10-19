from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ImageResponse(BaseModel):
    """Metadata response for an uploaded report image."""

    model_config = ConfigDict(from_attributes=True)

    image_id: int
    report_id: int
    display_filename: str
    content_type: str
    file_size: int
    is_primary: bool
    uploaded_at: datetime
