"""
Synaps Database Models
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class MediaFile(Base):
    """Indexed media file from the NAS filesystem."""
    __tablename__ = "media_files"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String, nullable=False, index=True)
    path = Column(String, nullable=False, unique=True, index=True)
    relative_path = Column(String, nullable=False)
    directory = Column(String, nullable=False, index=True)
    extension = Column(String, nullable=False, index=True)
    mime_type = Column(String)
    file_size = Column(Integer, default=0)
    width = Column(Integer)
    height = Column(Integer)
    duration = Column(Float)  # For videos, in seconds

    # Classification
    media_type = Column(String, nullable=False, index=True)  # image, video, document
    is_screenshot = Column(Boolean, default=False, index=True)
    is_screen_recording = Column(Boolean, default=False)
    is_raw = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False, index=True)

    # Dates
    date_taken = Column(DateTime, index=True)  # EXIF or best guess
    date_created = Column(DateTime)  # Filesystem creation
    date_modified = Column(DateTime)  # Filesystem modified
    date_indexed = Column(DateTime, default=func.now())

    # Metadata
    camera_make = Column(String)
    camera_model = Column(String)
    gps_lat = Column(Float)
    gps_lon = Column(Float)

    # Thumbnail
    has_thumbnail = Column(Boolean, default=False)
    thumbnail_path = Column(String)

    # Hash for deduplication
    file_hash = Column(String, index=True)  # MD5 (first 64KB) for fast partial checks
    content_hash = Column(String(64), index=True, nullable=True)  # Full SHA-256 for exact match
    hash_algorithm = Column(String(16), default="sha256")


class TrashItem(Base):
    """Files moved to trash."""
    __tablename__ = "trash_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    original_path = Column(String, nullable=False)
    trash_path = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    file_size = Column(Integer, default=0)
    media_type = Column(String)
    deleted_at = Column(DateTime, default=func.now())
    auto_delete_at = Column(DateTime)  # 30 days after deletion


class SyncRecord(Base):
    """Record of synced files from iPhone."""
    __tablename__ = "sync_records"

    id = Column(String, primary_key=True, default=generate_uuid)
    filename = Column(String, nullable=False)
    file_hash = Column(String, nullable=False, index=True)
    content_hash = Column(String(64), index=True, nullable=True)
    hash_algorithm = Column(String(16), default="sha256")
    file_size = Column(Integer, default=0)
    destination_path = Column(String, nullable=False)
    synced_at = Column(DateTime, default=func.now())
    source_device = Column(String, default="iPhone")


class Setting(Base):
    """Application settings stored in DB."""
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
