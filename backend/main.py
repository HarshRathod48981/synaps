"""
Synaps — Personal NAS Media OS
Main FastAPI application entry point.
"""
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import threading

from database import init_db, SessionLocal
from scanner import scan_directory
from thumbnails import batch_generate_thumbnails
from config import HOST, PORT, THUMBNAIL_DIR, TRASH_DIR
from models import MediaFile


def run_initial_scan():
    """Run initial scan in a background thread."""
    db = SessionLocal()
    try:
        print("[Synaps] Starting initial media scan...")
        stats = scan_directory(db)
        print(f"[Synaps] Scan complete: {stats}")

        # Generate thumbnails for images without them
        files = db.query(MediaFile).filter(
            MediaFile.has_thumbnail == False,
            MediaFile.media_type == "image"
        ).all()

        if files:
            paths = [f.path for f in files]
            print(f"[Synaps] Generating thumbnails for {len(paths)} files...")
            thumb_stats = batch_generate_thumbnails(paths, db)
            print(f"[Synaps] Thumbnails: {thumb_stats}")
    except Exception as e:
        print(f"[Synaps] Scan error: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: init DB and run scan on startup."""
    init_db()
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    os.makedirs(TRASH_DIR, exist_ok=True)

    # Run scan in background thread to not block startup
    scan_thread = threading.Thread(target=run_initial_scan, daemon=True)
    scan_thread.start()

    yield


app = FastAPI(
    title="Synaps",
    description="Personal NAS Media OS",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers.media import router as media_router
from routers.finder import router as finder_router
from routers.sync import router as sync_router
from routers.search import router as search_router
from routers.trash import router as trash_router
from routers.settings import router as settings_router

app.include_router(media_router)
app.include_router(finder_router)
app.include_router(sync_router)
app.include_router(search_router)
app.include_router(trash_router)
app.include_router(settings_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Synaps", "version": "1.0.0"}


@app.post("/api/scan")
def trigger_scan():
    """Manually trigger a rescan."""
    thread = threading.Thread(target=run_initial_scan, daemon=True)
    thread.start()
    return {"status": "scan_started"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
