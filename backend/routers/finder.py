"""
Synaps Finder Router — Directory browsing APIs
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import os
import mimetypes
from datetime import datetime

from config import STORAGE_PATH, ALL_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS

router = APIRouter(prefix="/api/finder", tags=["finder"])


@router.get("/browse")
def browse_directory(path: str = Query("", description="Relative path from storage root")):
    """
    Browse a directory in the NAS filesystem.
    Returns folders and files at the given path.
    """
    # Sanitize path to prevent directory traversal
    clean_path = os.path.normpath(path).lstrip("/")
    if ".." in clean_path:
        raise HTTPException(status_code=400, detail="Invalid path")

    full_path = os.path.join(STORAGE_PATH, clean_path) if clean_path else STORAGE_PATH
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Directory not found")
    
    if not os.path.isdir(full_path):
        raise HTTPException(status_code=400, detail="Not a directory")

    items = []
    try:
        entries = sorted(os.listdir(full_path))
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    folders = []
    files = []

    for entry in entries:
        if entry.startswith('.'):
            continue

        entry_path = os.path.join(full_path, entry)
        relative_entry = os.path.join(clean_path, entry) if clean_path else entry
        
        try:
            stat = os.stat(entry_path)
        except OSError:
            continue

        if os.path.isdir(entry_path):
            # Count children
            try:
                child_count = len([c for c in os.listdir(entry_path) if not c.startswith('.')])
            except OSError:
                child_count = 0

            folders.append({
                "name": entry,
                "path": relative_entry,
                "type": "folder",
                "children_count": child_count,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
        else:
            ext = os.path.splitext(entry)[1].lower()
            mime_type, _ = mimetypes.guess_type(entry_path)
            
            file_type = "other"
            if ext in IMAGE_EXTENSIONS:
                file_type = "image"
            elif ext in VIDEO_EXTENSIONS:
                file_type = "video"
            elif ext in {".pdf", ".doc", ".docx", ".txt", ".md"}:
                file_type = "document"

            files.append({
                "name": entry,
                "path": relative_entry,
                "type": "file",
                "file_type": file_type,
                "extension": ext,
                "mime_type": mime_type,
                "size": stat.st_size,
                "size_human": _format_size(stat.st_size),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    # Build breadcrumb
    breadcrumb = [{"name": "Storage", "path": ""}]
    if clean_path:
        parts = clean_path.split(os.sep)
        for i, part in enumerate(parts):
            breadcrumb.append({
                "name": part,
                "path": os.sep.join(parts[:i+1]),
            })

    return {
        "current_path": clean_path or "/",
        "breadcrumb": breadcrumb,
        "folders": folders,
        "files": files,
        "total_folders": len(folders),
        "total_files": len(files),
    }


@router.get("/tree")
def get_directory_tree(depth: int = Query(2, ge=1, le=5)):
    """Get a directory tree structure up to specified depth."""
    def build_tree(path: str, current_depth: int) -> list:
        if current_depth <= 0:
            return []
        
        result = []
        try:
            entries = sorted(os.listdir(path))
        except (PermissionError, OSError):
            return []

        for entry in entries:
            if entry.startswith('.'):
                continue
            
            entry_path = os.path.join(path, entry)
            if os.path.isdir(entry_path):
                relative = os.path.relpath(entry_path, STORAGE_PATH)
                children = build_tree(entry_path, current_depth - 1)
                result.append({
                    "name": entry,
                    "path": relative,
                    "type": "folder",
                    "children": children,
                })

        return result

    tree = build_tree(STORAGE_PATH, depth)
    return {"tree": tree}


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
