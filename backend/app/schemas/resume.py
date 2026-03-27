"""
Resume schemas for file upload and parse responses.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ResumeUploadResponse(BaseModel):
    """Returned after a successful resume upload."""
    id: UUID
    original_filename: str
    file_type: str
    file_size_bytes: int
    created_at: datetime
    last_used_at: datetime | None = None

    model_config = {"from_attributes": True}


class ResumeParseResponse(BaseModel):
    """Returned after parsing a resume's text content."""
    id: UUID
    original_filename: str
    raw_text: str
    parsed_sections: dict | None = None
    word_count: int

    model_config = {"from_attributes": True}
