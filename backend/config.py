"""
Synaps Configuration
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Storage path - on NAS this would be /storage, locally use mock_storage
STORAGE_PATH = os.getenv("SYNAPS_STORAGE_PATH", str(PROJECT_ROOT / "mock_storage"))

# Whitelist directories for media timeline
ALLOWED_SCAN_PATHS = [
    os.path.join(STORAGE_PATH, "Vault", "Harsh", "Iphone"),
    os.path.join(STORAGE_PATH, "Vault", "Harsh", "Mac")
]

# Database
DATABASE_URL = os.getenv("SYNAPS_DB_URL", f"sqlite:///{BASE_DIR / 'synaps.db'}")

# Thumbnail cache
THUMBNAIL_DIR = os.getenv("SYNAPS_THUMBNAIL_DIR", str(BASE_DIR / "thumbnails"))
THUMBNAIL_SIZE = (320, 320)
THUMBNAIL_QUALITY = 75

# Trash
TRASH_DIR = os.getenv("SYNAPS_TRASH_DIR", str(BASE_DIR / "trash"))
TRASH_RETENTION_DAYS = 30

# Media extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".heic", ".heif", ".tiff", ".tif", ".raw", ".cr2", ".nef", ".arw", ".dng"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp"}
DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".csv", ".md"}
RAW_EXTENSIONS = {".raw", ".cr2", ".nef", ".arw", ".dng", ".orf", ".rw2"}

ALL_MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
ALL_EXTENSIONS = ALL_MEDIA_EXTENSIONS | DOCUMENT_EXTENSIONS

# Server
HOST = os.getenv("SYNAPS_HOST", "0.0.0.0")
PORT = int(os.getenv("SYNAPS_PORT", "8000"))

# Sync target
SYNC_TARGET_DIR = os.path.join(STORAGE_PATH, "Vault", "Harsh", "Iphone")

# Scanner settings
SCAN_BATCH_SIZE = 100
MAX_CONCURRENT_THUMBNAILS = 2  # Low for Core2Duo
