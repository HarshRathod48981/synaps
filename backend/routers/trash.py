"""
Synaps Trash Router — Trash management APIs
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import shutil

from database import get_db
from models import MediaFile, TrashItem
from config import TRASH_DIR, TRASH_RETENTION_DAYS
from thumbnails import get_thumbnail_path
from fastapi.responses import FileResponse, Response
from routers.media import SVG_PLACEHOLDER

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.post("/delete/{media_id}")
def move_to_trash(media_id: str, db: Session = Depends(get_db)):
    """Move a media file to trash."""
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    if not os.path.exists(item.path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    os.makedirs(TRASH_DIR, exist_ok=True)
    trash_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{item.filename}"
    trash_path = os.path.join(TRASH_DIR, trash_filename)

    try:
        shutil.move(item.path, trash_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to move file: {e}")

    trash_item = TrashItem(
        original_path=item.path,
        trash_path=trash_path,
        filename=item.filename,
        file_size=item.file_size,
        media_type=item.media_type,
        auto_delete_at=datetime.now() + timedelta(days=TRASH_RETENTION_DAYS),
    )
    db.add(trash_item)
    db.delete(item)
    db.commit()

    return {"status": "success", "message": f"{item.filename} moved to trash"}


@router.get("/")
def list_trash(db: Session = Depends(get_db)):
    """List all items in trash."""
    items = db.query(TrashItem).order_by(TrashItem.deleted_at.desc()).all()
    return {
        "total": len(items),
        "items": [
            {
                "id": i.id, "filename": i.filename, "file_size": i.file_size,
                "media_type": i.media_type,
                "deleted_at": i.deleted_at.isoformat() if i.deleted_at else None,
                "auto_delete_at": i.auto_delete_at.isoformat() if i.auto_delete_at else None,
                "days_remaining": max(0, (i.auto_delete_at - datetime.now()).days) if i.auto_delete_at else 0,
                "thumbnail_url": f"/api/trash/thumbnail/{i.id}"
            }
            for i in items
        ],
    }


@router.get("/thumbnail/{trash_id}")
def get_trash_thumbnail(trash_id: str, db: Session = Depends(get_db)):
    """Get the cached thumbnail for a trash item."""
    item = db.query(TrashItem).filter(TrashItem.id == trash_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Trash item not found")

    # The thumbnail path is based on the original file path
    thumb_path = get_thumbnail_path(item.original_path)
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/webp")

    # If thumbnail doesn't exist, we just return the placeholder
    return Response(content=SVG_PLACEHOLDER, media_type="image/svg+xml")


@router.post("/restore/{trash_id}")
def restore_from_trash(trash_id: str, db: Session = Depends(get_db)):
    """Restore a file from trash and re-index it for the timeline."""
    from scanner import index_single_file

    item = db.query(TrashItem).filter(TrashItem.id == trash_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Trash item not found")

    if not os.path.exists(item.trash_path):
        raise HTTPException(status_code=404, detail="Trash file not found on disk")

    os.makedirs(os.path.dirname(item.original_path), exist_ok=True)
    try:
        shutil.move(item.trash_path, item.original_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore: {e}")

    # Re-index the file so it appears in the timeline immediately
    restored_media = index_single_file(item.original_path, db)

    db.delete(item)
    db.commit()
    return {
        "status": "success",
        "message": f"{item.filename} restored",
        "media_id": restored_media.id if restored_media else None,
    }


@router.delete("/permanent/{trash_id}")
def permanent_delete(trash_id: str, db: Session = Depends(get_db)):
    """Permanently delete a file from trash."""
    item = db.query(TrashItem).filter(TrashItem.id == trash_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Trash item not found")

    if os.path.exists(item.trash_path):
        os.remove(item.trash_path)

    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"{item.filename} permanently deleted"}


@router.post("/cleanup")
def cleanup_expired(db: Session = Depends(get_db)):
    """Auto-delete expired trash items (older than 30 days)."""
    expired = db.query(TrashItem).filter(TrashItem.auto_delete_at <= datetime.now()).all()
    count = 0
    for item in expired:
        if os.path.exists(item.trash_path):
            os.remove(item.trash_path)
        db.delete(item)
        count += 1
    db.commit()
    return {"status": "success", "deleted": count}
