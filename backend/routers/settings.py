"""
Synaps Settings Router
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Setting, MediaFile
from sqlalchemy import func
from config import STORAGE_PATH, THUMBNAIL_DIR, TRASH_DIR
import os

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).all()
    result = {s.key: s.value for s in settings}
    # Defaults
    defaults = {
        "storage_path": STORAGE_PATH,
        "thumbnail_dir": THUMBNAIL_DIR,
        "trash_dir": TRASH_DIR,
        "theme": "system",
    }
    for k, v in defaults.items():
        if k not in result:
            result[k] = v
    return result


@router.put("/")
def update_settings(data: dict, db: Session = Depends(get_db)):
    for key, value in data.items():
        existing = db.query(Setting).filter(Setting.key == key).first()
        if existing:
            existing.value = str(value)
        else:
            db.add(Setting(key=key, value=str(value)))
    db.commit()
    return {"status": "success"}


@router.get("/storage-usage")
def get_storage_usage(db: Session = Depends(get_db)):
    total_indexed = db.query(func.sum(MediaFile.file_size)).scalar() or 0
    total_files = db.query(MediaFile).count()
    images = db.query(MediaFile).filter(MediaFile.media_type == "image").count()
    videos = db.query(MediaFile).filter(MediaFile.media_type == "video").count()
    documents = db.query(MediaFile).filter(MediaFile.media_type == "document").count()
    thumb_size = _dir_size(THUMBNAIL_DIR)
    trash_size = _dir_size(TRASH_DIR)
    return {
        "total_indexed_size": total_indexed,
        "total_indexed_human": _fmt(total_indexed),
        "total_files": total_files,
        "images": images, "videos": videos, "documents": documents,
        "thumbnail_cache_size": thumb_size,
        "thumbnail_cache_human": _fmt(thumb_size),
        "trash_size": trash_size,
        "trash_size_human": _fmt(trash_size),
    }


def _dir_size(path):
    total = 0
    if os.path.exists(path):
        for root, dirs, files in os.walk(path):
            for f in files:
                total += os.path.getsize(os.path.join(root, f))
    return total


def _fmt(size):
    if size == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    s = float(size)
    while s >= 1024 and i < len(units) - 1:
        s /= 1024
        i += 1
    return f"{s:.1f} {units[i]}"
