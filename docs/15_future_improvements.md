# 15 — Future Improvements

This document outlines improvements that would make Synaps more capable, reliable, and feature-rich. Items are organized from most to least impactful.

---

## Priority 1: Critical Bug Fixes

These are issues in the current codebase that cause incorrect behavior:

### Fix 1: Hash Algorithm Consistency

**Problem**: The scanner uses a **partial MD5** (first 64KB), but the upload endpoint uses a **full MD5**. This means the same file can appear both in `media_files` (scanned) and get uploaded again as a "new" file through Sync.

**Fix**:
```python
# scanner.py — change to full hash for small files, partial for large:
def compute_file_hash(filepath):
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

# OR keep partial hash everywhere for consistency (faster, slightly less accurate):
# sync.py — change upload to also use partial hash
def compute_partial_hash(content: bytes) -> str:
    return hashlib.md5(content[:65536]).hexdigest()
```

### Fix 2: Orphan Record Cleanup

**Problem**: When you delete a file from the NAS filesystem directly (not through Synaps), the `media_files` row remains. Timeline shows a broken thumbnail.

**Fix**: Add a cleanup endpoint that checks all paths in `media_files` against the filesystem and removes orphaned rows:

```python
# New endpoint in routers/media.py or settings.py
@router.post("/cleanup-orphans")
def cleanup_orphaned_records(db: Session = Depends(get_db)):
    all_records = db.query(MediaFile).all()
    orphaned = []
    for record in all_records:
        if not os.path.exists(record.path):
            orphaned.append(record.id)
    
    if orphaned:
        db.query(MediaFile).filter(MediaFile.id.in_(orphaned)).delete()
        db.commit()
    
    return {"removed": len(orphaned)}
```

### Fix 3: Scan-Then-Appear for Uploads

**Problem**: After a successful upload via the Sync page, the photo doesn't appear in the timeline until the next scan.

**Fix**: After each upload, index just that file immediately:

```python
# In sync.py, after writing the file:
from scanner import classify_media, get_best_date, compute_file_hash

media_file = MediaFile(
    filename=os.path.basename(dest_path),
    path=dest_path,
    # ... all the fields the scanner would fill in
)
db.add(media_file)
```

### Fix 4: Filename Path Traversal in Upload

**Problem**: `file.filename` is used directly in `os.path.join()` without sanitization. A malicious filename like `../../etc/cron.d/backdoor` could theoretically escape the target directory.

**Fix**:
```python
# In sync.py, after receiving the filename:
safe_filename = os.path.basename(file.filename)  # Strips any path components
if not safe_filename:
    raise HTTPException(400, "Invalid filename")
dest_path = os.path.join(year_month_dir, safe_filename)
```

### Fix 5: Restore from Trash Doesn't Re-index

**Problem**: Restoring a file from trash puts it back on disk but the `media_files` row was deleted when it was trashed. The file won't appear in timeline until next scan.

**Fix**: Re-create the `MediaFile` row during restore:
```python
# In trash.py → restore_from_trash():
# After shutil.move(trash_path, original_path):
from scanner import classify_media, get_best_date, compute_file_hash

ext = os.path.splitext(item.original_path)[1].lower()
classification = classify_media(ext, item.filename)
date_taken = get_best_date(item.original_path, item.filename)

media_file = MediaFile(
    filename=item.filename,
    path=item.original_path,
    # ... fill in fields
)
db.add(media_file)
```

---

## Priority 2: Core Functionality Improvements

### Improvement 1: Extract Width, Height, Duration

The model has `width`, `height` (for images) and `duration` (for videos) columns, but the scanner never populates them.

```python
# In scanner.py — enhance the processing:
from PIL import Image

# For images:
try:
    with Image.open(filepath) as img:
        width, height = img.size
except Exception:
    width, height = None, None

# For videos — use ffprobe (comes with ffmpeg):
import subprocess, json

def get_video_metadata(filepath):
    try:
        result = subprocess.run([
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", filepath
        ], capture_output=True, text=True, timeout=10)
        data = json.loads(result.stdout)
        video_stream = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
        if video_stream:
            return {
                "width": video_stream.get("width"),
                "height": video_stream.get("height"),
                "duration": float(video_stream.get("duration", 0)),
            }
    except Exception:
        return {}
```

With duration populated, you can show video length in the thumbnail overlay.

### Improvement 2: Extract Full EXIF Metadata

`exifread` can provide camera make/model, GPS coordinates, aperture, shutter speed, ISO. Currently these are all NULL.

```python
# Enhanced extract_exif_metadata() in scanner.py:
def extract_exif_metadata(filepath: str) -> dict:
    try:
        with open(filepath, "rb") as f:
            tags = exifread.process_file(f, details=False)
        
        result = {}
        
        # Date
        date_tag = tags.get("EXIF DateTimeOriginal")
        if date_tag:
            result["date_taken"] = datetime.strptime(str(date_tag), "%Y:%m:%d %H:%M:%S")
        
        # Camera
        result["camera_make"] = str(tags.get("Image Make", "")).strip()
        result["camera_model"] = str(tags.get("Image Model", "")).strip()
        
        # GPS
        gps_lat = tags.get("GPS GPSLatitude")
        gps_lon = tags.get("GPS GPSLongitude")
        if gps_lat and gps_lon:
            result["gps_lat"] = _convert_gps(gps_lat)
            result["gps_lon"] = _convert_gps(gps_lon)
        
        return result
    except Exception:
        return {}
```

### Improvement 3: Real-Time Scan Progress

Currently there's no way to know how far along the scanner is. Add a progress endpoint:

```python
# In main.py:
scan_progress = {"running": False, "scanned": 0, "new": 0, "total_estimate": 0}

@app.get("/api/scan/progress")
def get_scan_progress():
    return scan_progress
```

Frontend: Show a progress bar in Settings while scan is running.

### Improvement 4: Video Scrubbing Support (Range Requests)

The current `stream_video` endpoint uses `FileResponse`, which doesn't support HTTP Range requests. This means:
- No seeking/scrubbing in videos
- Video must download from the beginning every time

**Fix**: Implement proper byte-range streaming:

```python
from fastapi import Request
from fastapi.responses import StreamingResponse

@router.get("/stream/{media_id}")
def stream_video(media_id: str, request: Request, db=...):
    item = db.query(MediaFile)...first()
    
    file_size = os.path.getsize(item.path)
    range_header = request.headers.get("Range", None)
    
    if range_header:
        start, end = parse_range_header(range_header, file_size)
        def generate():
            with open(item.path, "rb") as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = f.read(min(8192, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        return StreamingResponse(
            generate(),
            status_code=206,
            headers={"Content-Range": f"bytes {start}-{end}/{file_size}"},
        )
```

---

## Priority 3: New Features

### Feature 1: Albums / Smart Collections

Allow users to create albums and organize photos:

**Backend**:
```python
# New model:
class Album(Base):
    __tablename__ = "albums"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    cover_media_id = Column(String, ForeignKey("media_files.id"))
    created_at = Column(DateTime, default=func.now())

class AlbumItem(Base):
    __tablename__ = "album_items"
    album_id = Column(String, ForeignKey("albums.id"), primary_key=True)
    media_id = Column(String, ForeignKey("media_files.id"), primary_key=True)
    position = Column(Integer, default=0)
```

### Feature 2: AI Semantic Search

Currently, search only matches filenames and directories. Adding AI search would allow "find photos of sunsets" or "find photos with people".

**Architecture**:
1. Run a local embedding model (e.g., CLIP) on each photo during indexing
2. Store the embedding vector in the database
3. On search, compute the embedding of the query text
4. Find the photos whose embeddings are closest (cosine similarity)

**Tools for NAS**:
- `clip-interrogator` — generates text descriptions from images
- `sentence-transformers` — computes text embeddings
- SQLite doesn't support vector search natively; would need `sqlite-vss` extension

**Realistic timeline**: This requires significant RAM (2–4GB for the model) and CPU time per photo (30s–5min each on Core2Duo). Not viable on weak hardware. Consider a cloud-based approach for AI features.

### Feature 3: Face Recognition

Detect and group photos by person.

**Architecture**:
1. Use `face_recognition` library (built on dlib) to find faces in each photo
2. Compute face embeddings
3. Cluster similar face embeddings together (k-means or DBSCAN)
4. Present clusters as "People" albums

**Challenge**: Very CPU/RAM intensive. Requires powerful hardware or a GPU.

### Feature 4: WebSocket Real-Time Updates

Currently, the UI doesn't update in real-time when:
- Scan completes
- New photos are uploaded
- Thumbnails finish generating

**Implementation**:
```python
# Backend — WebSocket endpoint:
from fastapi import WebSocket

connected_clients = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except:
        connected_clients.remove(websocket)

async def broadcast(event: dict):
    for client in connected_clients[:]:
        try:
            await client.send_json(event)
        except:
            connected_clients.remove(client)
```

```tsx
// Frontend — listen for updates:
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8000/ws');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'scan_complete') {
      fetchPage(1, true);  // Refresh timeline
    }
  };
  return () => ws.close();
}, []);
```

### Feature 5: Mobile App

A native iOS app would enable:
- Background automatic photo sync
- Better media browsing experience
- Notification when new photos sync

**Minimum approach**: A PWA (Progressive Web App). Next.js supports this:
- Add a `manifest.json` with icons
- Add a service worker for offline caching
- Add `<meta name="apple-mobile-web-app-capable" content="yes">` (already done in `layout.tsx`)

Users can then "Add to Home Screen" on iOS for an app-like experience.

### Feature 6: Multiple Storage Paths

Currently `ALLOWED_SCAN_PATHS` is hardcoded for one user. To support multiple users or devices:

```python
# config.py — make it dynamic from DB
def get_allowed_scan_paths(db):
    setting = db.query(Setting).filter(Setting.key == "scan_paths").first()
    if setting:
        return json.loads(setting.value)
    return DEFAULT_ALLOWED_SCAN_PATHS
```

Add a UI in Settings to add/remove scan paths.

### Feature 7: Thumbnail Pre-Generation Queue

Rather than generating thumbnails on-demand (which can make the timeline feel slow initially), add a background queue:

```python
# In main.py, after scan completes:
async def generate_thumbnails_background(db):
    files_without_thumbs = db.query(MediaFile)\
        .filter(MediaFile.has_thumbnail == False)\
        .limit(50).all()  # Process 50 at a time
    
    for file in files_without_thumbs:
        if not os.path.exists(get_thumbnail_path(file.path)):
            result = generate_thumbnail(file.path)
            if result:
                file.has_thumbnail = True
    
    db.commit()
    
    # Schedule next batch
    await asyncio.sleep(5)
    await generate_thumbnails_background(db)
```

With a semaphore limiting to `MAX_CONCURRENT_THUMBNAILS = 2`, this would run continuously in the background, eventually generating all thumbnails.

---

## Priority 4: Architecture Improvements

### Improvement 1: Async Database Layer

Replace SQLAlchemy sync with async using `aiosqlite`:

```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

DATABASE_URL = "sqlite+aiosqlite:///./synaps.db"
engine = create_async_engine(DATABASE_URL)
```

This allows database operations to not block the event loop, enabling better concurrency.

### Improvement 2: Better Configuration UI

Currently, `ALLOWED_SCAN_PATHS` in `config.py` must be edited manually. Add a proper configuration page:
- Edit scan paths from the UI
- Configure sync target directories
- Set thumbnail quality
- Set retention periods

### Improvement 3: Scheduled Scans

Instead of only scanning on startup, add a scheduler:

```python
# Using APScheduler:
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(run_initial_scan_async, 'interval', hours=6)
scheduler.start()
```

This would keep the timeline up to date as you add files to the NAS without manual rescanning.

### Improvement 4: Nginx Integration

For production performance, serve static files via nginx instead of Python:

```nginx
server {
    listen 80;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
    }
    
    # Thumbnails (static files — no Python needed)
    location /thumbnails/ {
        alias /path/to/backend/thumbnails/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
    }
}
```

This reduces load on the Python backend significantly.

---

## Development Roadmap Suggestion

| Phase | Features | Effort | Impact |
|-------|----------|--------|--------|
| **v1.1** (Next) | Bug fixes (orphans, hash, restore) | Low | High |
| **v1.2** | Width/height/duration extraction | Medium | Medium |
| **v1.3** | Video scrubbing (range requests) | Medium | Medium |
| **v1.4** | Scan progress reporting | Low | Medium |
| **v1.5** | WebSocket real-time updates | Medium | High |
| **v2.0** | Albums, PWA, multiple scan paths | High | High |
| **v3.0** | AI search, face recognition | Very High | Very High |
