"""
Synaps Media Scanner — Async filesystem indexer
Designed for low-power hardware with batch processing.
"""
import os
import hashlib
import mimetypes
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from config import (
    STORAGE_PATH, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS,
    DOCUMENT_EXTENSIONS, RAW_EXTENSIONS, ALL_MEDIA_EXTENSIONS,
    SCAN_BATCH_SIZE, ALLOWED_SCAN_PATHS
)
from models import MediaFile

logger = logging.getLogger("synaps.scanner")

# Try to import exifread for EXIF metadata
try:
    import exifread
    HAS_EXIFREAD = True
except ImportError:
    HAS_EXIFREAD = False
    logger.warning("exifread not installed — EXIF date extraction disabled")


def classify_media(ext: str, filename: str) -> dict:
    """Classify a file by its extension and name."""
    ext_lower = ext.lower()
    name_lower = filename.lower()

    media_type = "document"
    if ext_lower in IMAGE_EXTENSIONS:
        media_type = "image"
    elif ext_lower in VIDEO_EXTENSIONS:
        media_type = "video"

    is_screenshot = (
        "screenshot" in name_lower or
        "screen shot" in name_lower or
        name_lower.startswith("screenshot")
    )

    is_screen_recording = (
        "screen recording" in name_lower or
        "screenrecording" in name_lower or
        ("screen" in name_lower and "recording" in name_lower)
    )

    is_raw = ext_lower in RAW_EXTENSIONS

    return {
        "media_type": media_type,
        "is_screenshot": is_screenshot,
        "is_screen_recording": is_screen_recording,
        "is_raw": is_raw,
    }


def compute_file_hash(filepath: str, chunk_size: int = 8192) -> str:
    """Compute a fast partial hash for deduplication.
    Only reads first 64KB for speed on low-power hardware."""
    hasher = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            # Read first 64KB for fast hashing
            data = f.read(65536)
            hasher.update(data)
    except (IOError, OSError):
        return ""
    return hasher.hexdigest()


def extract_exif_date(filepath: str) -> Optional[datetime]:
    """Extract date taken from EXIF data."""
    if not HAS_EXIFREAD:
        return None

    # Only attempt EXIF on formats that support it
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in {'.jpg', '.jpeg', '.tiff', '.heic', '.heif', '.raw', '.cr2', '.nef', '.arw', '.dng'}:
        return None

    try:
        with open(filepath, "rb") as f:
            tags = exifread.process_file(f, stop_tag="DateTimeOriginal", details=False)

        date_tag = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
        if date_tag:
            date_str = str(date_tag)
            return datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def extract_date_from_filename(filename: str) -> Optional[datetime]:
    """Try to extract date from common filename patterns like IMG_20230415_123456."""
    import re
    patterns = [
        r'(\d{4})[\-_](\d{2})[\-_](\d{2})',  # YYYY-MM-DD or YYYY_MM_DD
        r'(\d{4})(\d{2})(\d{2})',  # YYYYMMDD
    ]
    for pattern in patterns:
        match = re.search(pattern, filename)
        if match:
            try:
                year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                if 1990 <= year <= 2030 and 1 <= month <= 12 and 1 <= day <= 31:
                    return datetime(year, month, day)
            except (ValueError, IndexError):
                continue
    return None


def get_best_date(filepath: str, filename: str) -> datetime:
    """Get the best available date for a file. Priority: EXIF > filename > filesystem."""
    # Try EXIF
    exif_date = extract_exif_date(filepath)
    if exif_date:
        return exif_date

    # Try filename parsing
    fn_date = extract_date_from_filename(filename)
    if fn_date:
        return fn_date

    # Fallback to filesystem modification time
    try:
        stat = os.stat(filepath)
        # Use birth time on macOS, modification time on Linux
        birth = getattr(stat, 'st_birthtime', None)
        if birth:
            return datetime.fromtimestamp(birth)
        return datetime.fromtimestamp(stat.st_mtime)
    except OSError:
        return datetime.now()


def scan_directory(db: Session, force_rescan: bool = False) -> dict:
    """
    Scan the whitelisted storage directories and index all media files.
    Only indexes photos and videos (not documents) for the timeline.
    Optimized for low-power NAS with batch processing.
    """
    stats = {"scanned": 0, "new": 0, "skipped": 0, "errors": 0}

    # Pre-fetch all existing paths into memory for fast lookups
    existing_paths = set()
    if not force_rescan:
        for (path,) in db.query(MediaFile.path).all():
            existing_paths.add(path)
        logger.info(f"Loaded {len(existing_paths)} existing paths from DB")

    for base_path in ALLOWED_SCAN_PATHS:
        if not os.path.exists(base_path):
            logger.warning(f"Allowed path does not exist: {base_path}")
            continue

        logger.info(f"Scanning: {base_path}")

        for root, dirs, files in os.walk(base_path):
            # Skip hidden directories and system dirs
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {
                'thumbnails', 'trash', 'venv', '__pycache__',
                'node_modules', '.git'
            }]

            batch = []

            for filename in files:
                if filename.startswith('.'):
                    continue

                ext = os.path.splitext(filename)[1].lower()
                # Only index media files (photos + videos) for timeline
                if ext not in ALL_MEDIA_EXTENSIONS:
                    continue

                filepath = os.path.join(root, filename)
                relative_path = os.path.relpath(filepath, STORAGE_PATH)
                stats["scanned"] += 1

                # Fast memory lookup instead of DB query per file
                if not force_rescan and filepath in existing_paths:
                    stats["skipped"] += 1
                    continue

                try:
                    file_stat = os.stat(filepath)
                    classification = classify_media(ext, filename)
                    date_taken = get_best_date(filepath, filename)
                    file_hash = compute_file_hash(filepath)

                    mime_type, _ = mimetypes.guess_type(filepath)

                    media_file = MediaFile(
                        filename=filename,
                        path=filepath,
                        relative_path=relative_path,
                        directory=os.path.relpath(root, STORAGE_PATH),
                        extension=ext,
                        mime_type=mime_type or "application/octet-stream",
                        file_size=file_stat.st_size,
                        media_type=classification["media_type"],
                        is_screenshot=classification["is_screenshot"],
                        is_screen_recording=classification["is_screen_recording"],
                        is_raw=classification["is_raw"],
                        date_taken=date_taken,
                        date_created=datetime.fromtimestamp(
                            getattr(file_stat, 'st_birthtime', file_stat.st_ctime)
                        ),
                        date_modified=datetime.fromtimestamp(file_stat.st_mtime),
                        file_hash=file_hash,
                    )

                    batch.append(media_file)
                    stats["new"] += 1

                    # Commit in batches to limit memory usage
                    if len(batch) >= SCAN_BATCH_SIZE:
                        db.add_all(batch)
                        db.commit()
                        logger.info(f"  Committed batch of {len(batch)} files")
                        batch = []

                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"Error scanning {filepath}: {e}")
                    continue

            # Commit remaining batch for this directory
            if batch:
                db.add_all(batch)
                db.commit()
                logger.info(f"  Committed final batch of {len(batch)} files from {root}")

    logger.info(f"Scan complete: {stats}")
    return stats
