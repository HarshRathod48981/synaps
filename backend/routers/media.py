"""
Synaps Media Router — Timeline & media APIs
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from datetime import datetime

from database import get_db
from models import MediaFile
from thumbnails import enqueue_thumbnail, get_thumbnail_path
import os
import mimetypes
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["media"])

SVG_PLACEHOLDER = b"""<svg width="320" height="320" xmlns="http://www.w3.org/2000/svg">
  <rect width="320" height="320" fill="#1f2937"/>
  <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="14" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">Generating...</text>
</svg>"""


@router.get("/timeline")
def get_timeline(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    media_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get media grouped by month/year for timeline view.
    Returns media sorted by date_taken descending.
    """
    query = db.query(MediaFile)

    # Apply filters
    if media_type:
        if media_type == "screenshot":
            query = query.filter(MediaFile.is_screenshot == True)
        elif media_type == "screen_recording":
            query = query.filter(MediaFile.is_screen_recording == True)
        elif media_type == "raw":
            query = query.filter(MediaFile.is_raw == True)
        elif media_type == "favorite":
            query = query.filter(MediaFile.is_favorite == True)
        else:
            query = query.filter(MediaFile.media_type == media_type)

    if year:
        query = query.filter(func.strftime("%Y", MediaFile.date_taken) == str(year))
    if month:
        query = query.filter(func.strftime("%m", MediaFile.date_taken) == f"{month:02d}")

    total = query.count()
    offset = (page - 1) * per_page
    items = query.order_by(desc(MediaFile.date_taken)).offset(offset).limit(per_page).all()

    # Group by month/year
    groups = {}
    for item in items:
        # Check if it's an Old Photo (archive)
        is_old_photo = False
        if item.directory and "Old_Photos" in item.directory:
            is_old_photo = True
        elif item.relative_path and "Old_Photos" in item.relative_path:
            is_old_photo = True

        if is_old_photo:
            key = "Old_Photos"
            if key not in groups:
                groups[key] = {
                    "year": 0,  # 0 sorts to the bottom
                    "month": 0,
                    "month_name": "Archive",
                    "items": [],
                }
            groups[key]["items"].append(_serialize_media(item))
            continue

        dt = item.date_taken or item.date_created or datetime.now()
        key = dt.strftime("%Y-%m")
        if key not in groups:
            groups[key] = {
                "year": dt.year,
                "month": dt.month,
                "month_name": dt.strftime("%B"),
                "items": [],
            }
        groups[key]["items"].append(_serialize_media(item))

    # Sort groups by date descending
    sorted_groups = sorted(groups.values(), key=lambda g: (g["year"], g["month"]), reverse=True)

    return {
        "groups": sorted_groups,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
    }


@router.get("/item/{media_id}")
def get_media_item(media_id: str, db: Session = Depends(get_db)):
    """Get a single media item by ID."""
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    return _serialize_media(item, full=True)


@router.get("/thumbnail/{media_id}")
def get_thumbnail(media_id: str, db: Session = Depends(get_db)):
    """Get or generate a thumbnail for a media file."""
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")

    # Check cached thumbnail
    thumb_path = get_thumbnail_path(item.path)
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/webp")

    # Enqueue on-the-fly generation asynchronously
    enqueue_thumbnail(item.path)
    
    # Return an SVG placeholder so frontend doesn't hang
    from fastapi.responses import Response
    return Response(
        content=SVG_PLACEHOLDER, 
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"}
    )


@router.get("/file/{media_id}")
def get_file(media_id: str, db: Session = Depends(get_db)):
    """Serve the original file, transcoding HEIC to JPEG for browser compatibility."""
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    if not os.path.exists(item.path):
        logger.error(f"Failed to serve file - not found on disk: {item.path}")
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Always compute the file extension for downstream decisions
    ext = (item.extension or os.path.splitext(item.filename)[1] or "").lower()

    # HEIC transcoding: browsers cannot render HEIC natively, convert to JPEG on the fly
    if ext in (".heic", ".heif"):
        try:
            from PIL import Image
            import io
            import pillow_heif
            from fastapi.responses import Response

            pillow_heif.register_heif_opener()

            with Image.open(item.path) as img:
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')

                resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
                img.thumbnail((2560, 2560), resample_filter)

                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)
                return Response(
                    content=buf.getvalue(),
                    media_type="image/jpeg",
                    headers={"Cache-Control": "no-store"},
                )
        except Exception as e:
            logger.error(f"HEIC transcode failed for {item.filename}: {e}")
            # Fall through to serve raw file as last resort

    # Resolve correct MIME type for non-HEIC files
    mime_type = _resolve_mime(item, ext)
    return FileResponse(item.path, media_type=mime_type, filename=item.filename)


@router.get("/stream/{media_id}")
def stream_video(media_id: str, db: Session = Depends(get_db)):
    """Stream a video file."""
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    if not os.path.exists(item.path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    ext = (item.extension or os.path.splitext(item.filename)[1] or "").lower()
    mime_type = _resolve_mime(item, ext)
    return FileResponse(item.path, media_type=mime_type, filename=item.filename)


def _resolve_mime(item, ext: str) -> str:
    """Resolve a reliable MIME type from DB value, mimetypes module, or extension fallback."""
    mime = item.mime_type
    if mime and mime != "application/octet-stream":
        return mime
    # Try the stdlib guesser with lowercased filename
    guessed, _ = mimetypes.guess_type(item.filename.lower())
    if guessed:
        return guessed
    # Manual fallback map
    fallback = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
        ".heic": "image/heic", ".heif": "image/heif",
        ".mp4": "video/mp4", ".mov": "video/quicktime",
        ".m4v": "video/x-m4v", ".avi": "video/x-msvideo",
    }
    return fallback.get(ext, "application/octet-stream")


@router.post("/favorite/{media_id}")
def toggle_favorite(media_id: str, db: Session = Depends(get_db)):
    """Toggle favorite status for a media item."""
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    item.is_favorite = not item.is_favorite
    db.commit()
    return {"id": media_id, "is_favorite": item.is_favorite}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get media library statistics."""
    total = db.query(MediaFile).count()
    images = db.query(MediaFile).filter(MediaFile.media_type == "image").count()
    videos = db.query(MediaFile).filter(MediaFile.media_type == "video").count()
    documents = db.query(MediaFile).filter(MediaFile.media_type == "document").count()
    screenshots = db.query(MediaFile).filter(MediaFile.is_screenshot == True).count()
    favorites = db.query(MediaFile).filter(MediaFile.is_favorite == True).count()

    total_size = db.query(func.sum(MediaFile.file_size)).scalar() or 0

    return {
        "total_files": total,
        "images": images,
        "videos": videos,
        "documents": documents,
        "screenshots": screenshots,
        "favorites": favorites,
        "total_size_bytes": total_size,
        "total_size_human": _format_size(total_size),
    }


def _serialize_media(item: MediaFile, full: bool = False) -> dict:
    """Serialize a MediaFile to a dict."""
    data = {
        "id": item.id,
        "filename": item.filename,
        "media_type": item.media_type,
        "extension": item.extension,
        "file_size": item.file_size,
        "file_size_human": _format_size(item.file_size),
        "width": item.width,
        "height": item.height,
        "is_screenshot": item.is_screenshot,
        "is_favorite": item.is_favorite,
        "date_taken": item.date_taken.isoformat() if item.date_taken else None,
        "has_thumbnail": item.has_thumbnail,
        "thumbnail_url": f"/api/media/thumbnail/{item.id}",
        "file_url": f"/api/media/file/{item.id}",
    }

    if item.media_type == "video":
        data["stream_url"] = f"/api/media/stream/{item.id}"
        data["duration"] = item.duration

    if full:
        data.update({
            "path": item.relative_path,
            "directory": item.directory,
            "mime_type": item.mime_type,
            "date_created": item.date_created.isoformat() if item.date_created else None,
            "date_modified": item.date_modified.isoformat() if item.date_modified else None,
            "camera_make": item.camera_make,
            "camera_model": item.camera_model,
            "gps_lat": item.gps_lat,
            "gps_lon": item.gps_lon,
        })

    return data


def _format_size(size_bytes: int) -> str:
    """Format bytes to human readable string."""
    if size_bytes == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    return f"{size:.1f} {units[i]}"
