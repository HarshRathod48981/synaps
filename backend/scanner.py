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
    SCAN_BATCH_SIZE, ALLOWED_SCAN_PATHS, SOURCE_MAPPING,
    EXCLUDED_PATHS
)
from models import MediaFile

logger = logging.getLogger("synaps.scanner")

# Normalize excluded paths
NORMALIZED_EXCLUDED_PATHS = [os.path.normpath(p) for p in EXCLUDED_PATHS]

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

    # iPhone screenshots: iPhones save screenshots as PNG, regular photos as JPG/HEIC.
    # Detection: filename contains "screenshot", OR it's a PNG from an iPhone camera roll.
    # iPhone camera roll PNGs are almost always screenshots (iPhone never saves photos as PNG).
    import re
    is_iphone_png_screenshot = (
        ext_lower == ".png" and
        media_type == "image" and
        # Matches iPhone naming patterns: IMG_XXXX.PNG, 4-letter codes like AVGG4766.PNG, etc.
        bool(re.match(r'^(IMG_\d+|[A-Z]{4}\d{4})', filename))
    )

    is_screenshot = (
        "screenshot" in name_lower or
        "screen shot" in name_lower or
        name_lower.startswith("screenshot") or
        is_iphone_png_screenshot
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


def compute_content_hash(filepath: str, chunk_size: int = 65536) -> str:
    """Compute full SHA-256 hash for exact duplicate detection.
    Reads entire file in chunks."""
    hasher = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                hasher.update(chunk)
    except (IOError, OSError):
        return ""
    return hasher.hexdigest()


def extract_exif_date(filepath: str) -> Optional[datetime]:
    """Extract date taken from EXIF data.
    Uses exifread for JPEG/TIFF, and PIL+pillow_heif for HEIC files
    (exifread cannot read HEIC EXIF data)."""

    ext = os.path.splitext(filepath)[1].lower()

    # ── HEIC/HEIF: use PIL (with pillow-heif registered) ──
    if ext in {'.heic', '.heif'}:
        try:
            from PIL import Image
            from PIL.ExifTags import Base as ExifBase
            import pillow_heif
            pillow_heif.register_heif_opener()

            with Image.open(filepath) as img:
                exif_data = img.getexif()
                if exif_data:
                    # Tag 36867 = DateTimeOriginal, 306 = DateTime
                    date_str = exif_data.get(36867) or exif_data.get(306)
                    if date_str:
                        return datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
        except Exception:
            pass
        return None

    # ── JPEG/TIFF/RAW: use exifread ──
    if not HAS_EXIFREAD:
        return None

    if ext not in {'.jpg', '.jpeg', '.tiff', '.raw', '.cr2', '.nef', '.arw', '.dng'}:
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


def extract_video_date(filepath: str) -> Optional[datetime]:
    """Extract creation date from video metadata using ffprobe.
    MP4/MOV files store creation_time in their container metadata."""
    import subprocess

    ext = os.path.splitext(filepath)[1].lower()
    if ext not in {'.mp4', '.mov', '.m4v'}:
        return None

    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_entries", "format_tags=creation_time",
                filepath
            ],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            creation_time = data.get("format", {}).get("tags", {}).get("creation_time")
            if creation_time:
                # Format: "2025-03-15T10:30:45.000000Z"
                clean = creation_time.replace("Z", "").split(".")[0]
                return datetime.strptime(clean, "%Y-%m-%dT%H:%M:%S")
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
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
    """Get the best available date for a file.
    Priority: EXIF > video metadata > filename > filesystem."""
    # 1. Try EXIF (images)
    exif_date = extract_exif_date(filepath)
    if exif_date:
        return exif_date

    # 2. Try video container metadata (MP4/MOV)
    video_date = extract_video_date(filepath)
    if video_date:
        return video_date

    # 3. Try filename parsing
    fn_date = extract_date_from_filename(filename)
    if fn_date:
        return fn_date

    # Fallback to filesystem dates
    # Priority: birthtime (original creation) > mtime (last modified)
    # Why: When files are copied/transferred between devices, mtime is reset
    # to the copy date. birthtime preserves the original creation timestamp
    # on macOS (HFS+/APFS) and some NAS filesystems.
    try:
        stat = os.stat(filepath)
        candidates = []

        # Prefer birthtime (original creation date, survives copies)
        birth = getattr(stat, 'st_birthtime', None)
        if birth:
            candidates.append(datetime.fromtimestamp(birth))

        # mtime as secondary (unreliable for copied/imported media)
        if hasattr(stat, 'st_mtime'):
            candidates.append(datetime.fromtimestamp(stat.st_mtime))

        # ctime as last resort
        candidates.append(datetime.fromtimestamp(stat.st_ctime))

        # Pick the OLDEST valid date (most likely to be the real capture date)
        # Reject dates in the future
        now = datetime.now()
        valid = [d for d in candidates if d <= now]
        if valid:
            return min(valid)

    except OSError:
        pass
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
            rel_root = os.path.relpath(root, STORAGE_PATH)
            is_root_excluded = False
            for ep in NORMALIZED_EXCLUDED_PATHS:
                if rel_root == ep or rel_root.startswith(ep + os.sep):
                    is_root_excluded = True
                    break
            
            if is_root_excluded:
                dirs[:] = []  # Stop recursion
                logger.debug(f"Skipping excluded directory: {rel_root}")
                continue

            # Skip hidden directories and system dirs
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {
                'thumbnails', 'trash', 'venv', '__pycache__',
                'node_modules', '.git'
            }]

            batch = []

            for filename in files:
                if filename.startswith('.') or filename.lower().endswith('.aae') or filename.lower().endswith('.tmp'):
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

                    # Derive source
                    parts = relative_path.split('/')
                    source_val = "unknown"
                    if len(parts) >= 3 and parts[0] == "Vault":
                        raw_source = parts[2]
                        source_val = SOURCE_MAPPING.get(raw_source, raw_source.lower())

                    media_file = MediaFile(
                        filename=filename,
                        path=filepath,
                        relative_path=relative_path,
                        directory=os.path.relpath(root, STORAGE_PATH),
                        source=source_val,
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

    # ── Database Garbage Collection ──
    logger.info("Running database garbage collection...")
    all_media = db.query(MediaFile).all()
    stale_count = 0
    for media in all_media:
        is_excluded = False
        if media.relative_path:
            norm_rel_path = os.path.normpath(media.relative_path)
            for ep in NORMALIZED_EXCLUDED_PATHS:
                if norm_rel_path == ep or norm_rel_path.startswith(ep + os.sep):
                    is_excluded = True
                    break

        if not os.path.exists(media.path) or is_excluded:
            db.delete(media)
            stale_count += 1
            if is_excluded and os.path.exists(media.path):
                logger.info(f"Deleted excluded record from database: {media.relative_path}")
            
    if stale_count > 0:
        db.commit()
        logger.info(f"Deleted {stale_count} stale records from database")
    stats["stale_deleted"] = stale_count

    logger.info(f"Scan complete: {stats}")
    return stats


def index_single_file(filepath: str, db: Session) -> Optional[MediaFile]:
    """Index a single file and add it to the database. Used for restore-from-trash.
    Returns the created MediaFile or None if it fails."""
    if not os.path.exists(filepath):
        logger.error(f"Cannot index — file not found: {filepath}")
        return None

    filename = os.path.basename(filepath)
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALL_MEDIA_EXTENSIONS:
        logger.warning(f"Cannot index — unsupported extension: {ext}")
        return None

    # Skip if already indexed
    existing = db.query(MediaFile).filter(MediaFile.path == filepath).first()
    if existing:
        return existing

    try:
        file_stat = os.stat(filepath)
        classification = classify_media(ext, filename)
        date_taken = get_best_date(filepath, filename)
        file_hash = compute_file_hash(filepath)
        relative_path = os.path.relpath(filepath, STORAGE_PATH)
        mime_type, _ = mimetypes.guess_type(filepath)

        media_file = MediaFile(
            filename=filename,
            path=filepath,
            relative_path=relative_path,
            directory=os.path.relpath(os.path.dirname(filepath), STORAGE_PATH),
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

        db.add(media_file)
        db.commit()
        logger.info(f"Re-indexed restored file: {filename}")
        return media_file

    except Exception as e:
        logger.error(f"Failed to index restored file {filepath}: {e}")
        return None

