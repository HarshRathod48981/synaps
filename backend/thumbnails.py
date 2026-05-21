"""
Synaps Thumbnail Generator
Lightweight thumbnail generation with caching.
"""
import os
from pathlib import Path
from PIL import Image
from config import THUMBNAIL_DIR, THUMBNAIL_SIZE, THUMBNAIL_QUALITY, VIDEO_EXTENSIONS


def ensure_thumbnail_dir():
    """Create thumbnail directory if it doesn't exist."""
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)


def get_thumbnail_path(file_path: str) -> str:
    """Generate a deterministic thumbnail path for a given file."""
    import hashlib
    path_hash = hashlib.md5(file_path.encode()).hexdigest()
    return os.path.join(THUMBNAIL_DIR, f"{path_hash}.webp")


def generate_image_thumbnail(source_path: str, thumb_path: str) -> bool:
    """Generate a thumbnail for an image file."""
    try:
        with Image.open(source_path) as img:
            # Convert RGBA to RGB for JPEG/WebP compatibility
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')

            # Use LANCZOS for high quality downscaling
            img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            img.save(thumb_path, "WEBP", quality=THUMBNAIL_QUALITY, optimize=True)
            return True
    except Exception as e:
        print(f"Thumbnail generation failed for {source_path}: {e}")
        return False


def generate_video_thumbnail(source_path: str, thumb_path: str) -> bool:
    """Generate a thumbnail for a video using ffmpeg."""
    import subprocess
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", source_path,
                "-ss", "00:00:00.100",  # 0.1 seconds into the video for short clips
                "-vframes", "1",
                "-vf", f"scale={THUMBNAIL_SIZE[0]}:-1",
                "-q:v", "5",
                thumb_path
            ],
            capture_output=True,
            timeout=30
        )
        return result.returncode == 0 and os.path.exists(thumb_path)
    except Exception as e:
        print(f"Video thumbnail generation failed for {source_path}: {e}")
        return False


def generate_thumbnail(source_path: str) -> str | None:
    """Generate a thumbnail for any media file. Returns thumbnail path or None."""
    ensure_thumbnail_dir()

    thumb_path = get_thumbnail_path(source_path)

    # Return cached thumbnail if exists
    if os.path.exists(thumb_path):
        return thumb_path

    ext = os.path.splitext(source_path)[1].lower()

    if ext in VIDEO_EXTENSIONS:
        success = generate_video_thumbnail(source_path, thumb_path)
    else:
        success = generate_image_thumbnail(source_path, thumb_path)

    return thumb_path if success else None


def batch_generate_thumbnails(file_paths: list[str], db_session=None) -> dict:
    """Generate thumbnails for a batch of files. Updates DB if session provided."""
    from models import MediaFile

    stats = {"generated": 0, "cached": 0, "failed": 0}

    for path in file_paths:
        thumb_path = get_thumbnail_path(path)

        if os.path.exists(thumb_path):
            stats["cached"] += 1
            continue

        result = generate_thumbnail(path)

        if result:
            stats["generated"] += 1
            if db_session:
                media = db_session.query(MediaFile).filter(MediaFile.path == path).first()
                if media:
                    media.has_thumbnail = True
                    media.thumbnail_path = result
        else:
            stats["failed"] += 1

    if db_session:
        db_session.commit()

    return stats
