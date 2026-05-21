"""
Synaps Media Scanner — Async filesystem indexer
Designed for low-power hardware with batch processing.
"""
import os
import hashlib
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from config import (
    STORAGE_PATH, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS,
    DOCUMENT_EXTENSIONS, RAW_EXTENSIONS, ALL_EXTENSIONS,
    SCAN_BATCH_SIZE
)
from models import MediaFile

# Try to import exifread for EXIF metadata
try:
    import exifread
    HAS_EXIFREAD = True
except ImportError:
    HAS_EXIFREAD = False


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

    # Fallback to filesystem
    try:
        stat = os.stat(filepath)
        # Use birth time on macOS, modification time on Linux
        birth = getattr(stat, 'st_birthtime', None)
        if birth:
            return datetime.fromtimestamp(birth)
        return datetime.fromtimestamp(stat.st_mtime)
    except OSError:
        return datetime.now()


def scan_directory(db: Session, base_path: str = None, force_rescan: bool = False) -> dict:
    """
    Scan the storage directory and index all media files.
    Returns scan statistics.
    """
    if base_path is None:
        base_path = STORAGE_PATH

    stats = {"scanned": 0, "new": 0, "skipped": 0, "errors": 0}

    for root, dirs, files in os.walk(base_path):
        # Skip hidden directories and thumbnail cache
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'thumbnails' and d != 'trash' and d != 'venv']

        batch = []

        for filename in files:
            if filename.startswith('.'):
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALL_EXTENSIONS:
                continue

            filepath = os.path.join(root, filename)
            relative_path = os.path.relpath(filepath, base_path)
            stats["scanned"] += 1

            # Check if already indexed
            if not force_rescan:
                existing = db.query(MediaFile).filter(MediaFile.path == filepath).first()
                if existing:
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
                    directory=os.path.relpath(root, base_path),
                    extension=ext,
                    mime_type=mime_type or "application/octet-stream",
                    file_size=file_stat.st_size,
                    media_type=classification["media_type"],
                    is_screenshot=classification["is_screenshot"],
                    is_screen_recording=classification["is_screen_recording"],
                    is_raw=classification["is_raw"],
                    date_taken=date_taken,
                    date_created=datetime.fromtimestamp(getattr(file_stat, 'st_birthtime', file_stat.st_ctime)),
                    date_modified=datetime.fromtimestamp(file_stat.st_mtime),
                    file_hash=file_hash,
                )

                batch.append(media_file)
                stats["new"] += 1

                # Commit in batches
                if len(batch) >= SCAN_BATCH_SIZE:
                    db.add_all(batch)
                    db.commit()
                    batch = []

            except Exception as e:
                stats["errors"] += 1
                print(f"Error scanning {filepath}: {e}")
                continue

        # Commit remaining batch
        if batch:
            db.add_all(batch)
            db.commit()

    return stats
