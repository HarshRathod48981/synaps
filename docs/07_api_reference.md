# 07 — API Reference

Complete documentation of every HTTP endpoint in Synaps, with examples you can copy-paste.

**Base URL (dev)**: `http://localhost:8000`  
**Base URL (NAS)**: `http://YOUR-NAS-IP:8000`

The FastAPI auto-docs are also available at: `http://localhost:8000/docs` (interactive Swagger UI)

---

## Health & System

### `GET /api/health`

Check if the backend is running.

**Response:**
```json
{
  "status": "ok",
  "app": "Synaps",
  "version": "1.0.0"
}
```

**curl:**
```bash
curl http://localhost:8000/api/health
```

---

### `POST /api/scan`

Trigger a manual media library rescan. Returns immediately while scan runs in background.

**Response:**
```json
{
  "status": "scan_started"
}
```

**curl:**
```bash
curl -X POST http://localhost:8000/api/scan
```

**Frontend usage**: Settings page → "Rescan Now" button

---

## Media — `/api/media`

### `GET /api/media/timeline`

The main timeline endpoint. Returns media grouped by month/year.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (≥1) |
| `per_page` | int | 50 | Items per page (1–200) |
| `media_type` | string | null | Filter: `image`, `video`, `document`, `screenshot`, `screen_recording`, `raw`, `favorite` |
| `year` | int | null | Filter by year (e.g., `2024`) |
| `month` | int | null | Filter by month (1–12) |

**Response:**
```json
{
  "groups": [
    {
      "year": 2024,
      "month": 1,
      "month_name": "January",
      "items": [
        {
          "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          "filename": "IMG_4532.HEIC",
          "media_type": "image",
          "extension": ".heic",
          "file_size": 4521034,
          "file_size_human": "4.3 MB",
          "width": null,
          "height": null,
          "is_screenshot": false,
          "is_favorite": false,
          "date_taken": "2024-01-15T14:32:55",
          "has_thumbnail": false,
          "thumbnail_url": "/api/media/thumbnail/f47ac10b-...",
          "file_url": "/api/media/file/f47ac10b-..."
        }
      ]
    }
  ],
  "total": 347,
  "page": 1,
  "per_page": 80,
  "total_pages": 5
}
```

**curl examples:**
```bash
# Page 1, all media
curl "http://localhost:8000/api/media/timeline?page=1&per_page=80"

# Only photos
curl "http://localhost:8000/api/media/timeline?media_type=image"

# Screenshots from 2024
curl "http://localhost:8000/api/media/timeline?media_type=screenshot&year=2024"

# Videos from January 2024
curl "http://localhost:8000/api/media/timeline?media_type=video&year=2024&month=1"
```

---

### `GET /api/media/item/{media_id}`

Get full metadata for a single media item.

**Path Parameters:**
- `media_id` — UUID string from the `id` field

**Response** (same as timeline item + extra fields):
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "filename": "IMG_4532.HEIC",
  "media_type": "image",
  "extension": ".heic",
  "file_size": 4521034,
  "file_size_human": "4.3 MB",
  "width": null,
  "height": null,
  "is_screenshot": false,
  "is_favorite": false,
  "date_taken": "2024-01-15T14:32:55",
  "has_thumbnail": false,
  "thumbnail_url": "/api/media/thumbnail/f47ac10b-...",
  "file_url": "/api/media/file/f47ac10b-...",
  "stream_url": null,
  "duration": null,
  "path": "Vault/Harsh/Iphone/2024/01/IMG_4532.HEIC",
  "directory": "Vault/Harsh/Iphone/2024/01",
  "mime_type": "image/heic",
  "date_created": "2024-01-15T14:33:01",
  "date_modified": "2024-01-15T14:33:01",
  "camera_make": null,
  "camera_model": null,
  "gps_lat": null,
  "gps_lon": null
}
```

**curl:**
```bash
curl http://localhost:8000/api/media/item/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Frontend usage**: MediaViewer fetches this when opening a photo

---

### `GET /api/media/thumbnail/{media_id}`

Get or generate a thumbnail for a media file. Returns a WebP image file.

**Response**: Binary WebP image (Content-Type: `image/webp`)

**Special behaviors:**
- If thumbnail cached on disk → instant response
- If not cached → generates it (may take 0.1–5 seconds)
- If generation fails but it's an image → serves the original (no size limit!)
- If generation fails for video/PDF → HTTP 404

**curl:**
```bash
# Download thumbnail
curl http://localhost:8000/api/media/thumbnail/f47ac10b-... -o thumb.webp

# Check response headers
curl -I http://localhost:8000/api/media/thumbnail/f47ac10b-...
```

---

### `GET /api/media/file/{media_id}`

Serve the original file for download or display.

**Response**: Original file with correct MIME type and `Content-Disposition: attachment` header

**curl:**
```bash
# Download original file
curl http://localhost:8000/api/media/file/f47ac10b-... -o original.heic
```

**Frontend usage**: MediaViewer uses this as `<img src>` for image display

---

### `GET /api/media/stream/{media_id}`

Stream a video file. Same as `/file/` but optimized for video players.

**Response**: Video file with MIME type (e.g., `video/mp4`)

**Note**: Currently this endpoint uses `FileResponse` which doesn't support HTTP Range requests. This means some browsers can't seek within videos (no scrubbing to a specific time). This is a known limitation — proper range support requires using `StreamingResponse` with custom headers.

**curl:**
```bash
curl http://localhost:8000/api/media/stream/f47ac10b-... -o video.mp4
```

---

### `POST /api/media/favorite/{media_id}`

Toggle the favorite status of a media item.

**Response:**
```json
{
  "id": "f47ac10b-...",
  "is_favorite": true
}
```

**curl:**
```bash
curl -X POST http://localhost:8000/api/media/favorite/f47ac10b-...
```

---

### `GET /api/media/stats`

Get summary statistics for the media library.

**Response:**
```json
{
  "total_files": 347,
  "images": 280,
  "videos": 45,
  "documents": 22,
  "screenshots": 12,
  "favorites": 3,
  "total_size_bytes": 2147483648,
  "total_size_human": "2.0 GB"
}
```

**curl:**
```bash
curl http://localhost:8000/api/media/stats
```

**Frontend usage**: Timeline page subtitle ("347 items · 2.0 GB")

---

## Finder — `/api/finder`

### `GET /api/finder/browse`

Browse a directory on the NAS filesystem.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | `""` | Relative path from storage root |
| `page` | int | 1 | Page for file list pagination |
| `per_page` | int | 200 | Max files per page (1–1000) |

**Response:**
```json
{
  "current_path": "Vault/Harsh",
  "breadcrumb": [
    {"name": "Storage", "path": ""},
    {"name": "Vault", "path": "Vault"},
    {"name": "Harsh", "path": "Vault/Harsh"}
  ],
  "folders": [
    {
      "name": "Iphone",
      "path": "Vault/Harsh/Iphone",
      "type": "folder",
      "children_count": 142,
      "modified": "2024-01-15T14:33:01"
    }
  ],
  "files": [
    {
      "name": "README.md",
      "path": "Vault/Harsh/README.md",
      "type": "file",
      "file_type": "document",
      "extension": ".md",
      "mime_type": "text/markdown",
      "size": 4096,
      "size_human": "4.0 KB",
      "modified": "2024-01-15T14:33:01"
    }
  ],
  "total_folders": 3,
  "total_files": 1,
  "page": 1,
  "per_page": 200
}
```

**curl examples:**
```bash
# Browse root
curl "http://localhost:8000/api/finder/browse"

# Browse a subdirectory
curl "http://localhost:8000/api/finder/browse?path=Vault/Harsh/Iphone"

# URL-encode spaces
curl "http://localhost:8000/api/finder/browse?path=Vault%2FHarsh%2FIphone"
```

---

### `GET /api/finder/tree`

Get a nested directory tree (no files, just folders).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `depth` | int | 2 | How many levels deep (1–4) |

**Response:**
```json
{
  "tree": [
    {
      "name": "Vault",
      "path": "Vault",
      "type": "folder",
      "children": [
        {
          "name": "Harsh",
          "path": "Vault/Harsh",
          "type": "folder",
          "children": [
            {"name": "Iphone", "path": "Vault/Harsh/Iphone", "type": "folder", "children": []}
          ]
        }
      ]
    }
  ]
}
```

**curl:**
```bash
curl "http://localhost:8000/api/finder/tree?depth=3"
```

---

## Search — `/api/search`

### `GET /api/search/`

Search for media by filename, directory, or path.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | ✓ | Search term (min 1 char) |
| `media_type` | string | — | Filter by type |
| `page` | int | — | Page (default 1) |
| `per_page` | int | — | Items per page (default 50) |

**Response:**
```json
{
  "query": "cat",
  "total": 3,
  "page": 1,
  "per_page": 50,
  "results": [
    {
      "id": "f47ac10b-...",
      "filename": "cat_photo.jpg",
      "directory": "Vault/Harsh/Iphone/2024/01",
      "media_type": "image",
      "extension": ".jpg",
      "file_size": 1234567,
      "date_taken": "2024-01-15T14:32:55",
      "thumbnail_url": "/api/media/thumbnail/f47ac10b-...",
      "file_url": "/api/media/file/f47ac10b-..."
    }
  ]
}
```

**curl:**
```bash
curl "http://localhost:8000/api/search/?q=cat"
curl "http://localhost:8000/api/search/?q=screenshot&media_type=image"
```

---

### `GET /api/search/suggestions`

Get autocomplete suggestions while typing.

**Query Parameters:**
- `q` — search term (min 1 char)

**Response:**
```json
{
  "files": ["cat_photo.jpg", "cat_birthday.heic"],
  "directories": ["Vault/Harsh/Cats"]
}
```

**curl:**
```bash
curl "http://localhost:8000/api/search/suggestions?q=cat"
```

---

## Sync — `/api/sync`

### `POST /api/sync/upload`

Upload a single file from your device to the NAS.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✓ | The media file to upload |
| `device` | string | — | Source device label (default: "iPhone") |

**Response (success):**
```json
{
  "status": "success",
  "message": "File uploaded successfully",
  "filename": "IMG_4532.HEIC",
  "path": "/storage/Vault/Harsh/Iphone/2026/05/IMG_4532.HEIC",
  "size": 4521034
}
```

**Response (duplicate):**
```json
{
  "status": "duplicate",
  "message": "File already synced as IMG_4532.HEIC",
  "filename": "IMG_4532.HEIC"
}
```

**curl:**
```bash
# Upload a single file
curl -X POST http://localhost:8000/api/sync/upload \
  -F "file=@/path/to/photo.heic" \
  -F "device=iPhone"
```

---

### `POST /api/sync/upload-batch`

Upload multiple files at once.

**Request**: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `files` | File[] | Multiple file upload |
| `device` | string | Source device label |

**Response:**
```json
{
  "total": 3,
  "success": 2,
  "duplicates": 1,
  "errors": 0,
  "results": [
    {"filename": "IMG_4532.HEIC", "status": "success"},
    {"filename": "IMG_4533.HEIC", "status": "duplicate"},
    {"filename": "IMG_4534.HEIC", "status": "success"}
  ]
}
```

**curl:**
```bash
curl -X POST http://localhost:8000/api/sync/upload-batch \
  -F "files=@photo1.heic" \
  -F "files=@photo2.jpg" \
  -F "device=iPhone"
```

---

### `GET /api/sync/history`

Get upload history.

**Response:**
```json
{
  "total": 45,
  "page": 1,
  "records": [
    {
      "id": "...",
      "filename": "IMG_4532.HEIC",
      "file_size": 4521034,
      "source_device": "iPhone",
      "synced_at": "2024-01-15T14:32:55"
    }
  ]
}
```

---

### `GET /api/sync/check-duplicate`

Check if a file hash already exists (for client-side pre-check before uploading).

**Query Parameters:**
- `file_hash` — MD5 hex string of the file

**Response:**
```json
{"exists": true}
```

**curl:**
```bash
curl "http://localhost:8000/api/sync/check-duplicate?file_hash=a3f7b9c2d4e5f6a7"
```

---

## Trash — `/api/trash`

### `POST /api/trash/delete/{media_id}`

Move a media file to trash. Removes from timeline.

**Response:**
```json
{
  "status": "success",
  "message": "IMG_4532.HEIC moved to trash"
}
```

**curl:**
```bash
curl -X POST http://localhost:8000/api/trash/delete/f47ac10b-...
```

---

### `GET /api/trash/`

List all items in trash.

**Response:**
```json
{
  "total": 2,
  "items": [
    {
      "id": "...",
      "filename": "IMG_4532.HEIC",
      "file_size": 4521034,
      "media_type": "image",
      "deleted_at": "2024-01-20T10:00:00",
      "auto_delete_at": "2024-02-19T10:00:00",
      "days_remaining": 29
    }
  ]
}
```

---

### `POST /api/trash/restore/{trash_id}`

Restore a file from trash back to its original location.

**Response:**
```json
{
  "status": "success",
  "message": "IMG_4532.HEIC restored"
}
```

**curl:**
```bash
curl -X POST http://localhost:8000/api/trash/restore/TRASH-UUID
```

> **Note**: After restoring, the file won't appear in the timeline until the next scan. The MediaFile DB row was deleted when it was trashed, and restoration doesn't re-create it.

---

### `DELETE /api/trash/permanent/{trash_id}`

Permanently delete a file. Cannot be undone.

**curl:**
```bash
curl -X DELETE http://localhost:8000/api/trash/permanent/TRASH-UUID
```

---

### `POST /api/trash/cleanup`

Auto-delete all trash items older than 30 days.

**Response:**
```json
{
  "status": "success",
  "deleted": 3
}
```

---

## Settings — `/api/settings`

### `GET /api/settings/`

Get all app settings.

**Response:**
```json
{
  "storage_path": "/storage",
  "thumbnail_dir": "/backend/thumbnails",
  "trash_dir": "/backend/trash",
  "theme": "dark"
}
```

---

### `PUT /api/settings/`

Update settings.

**Request body** (JSON):
```json
{
  "theme": "light"
}
```

**curl:**
```bash
curl -X PUT http://localhost:8000/api/settings/ \
  -H "Content-Type: application/json" \
  -d '{"theme": "dark"}'
```

---

### `GET /api/settings/storage-usage`

Get storage statistics.

**Response:**
```json
{
  "total_indexed_size": 2147483648,
  "total_indexed_human": "2.0 GB",
  "total_files": 347,
  "images": 280,
  "videos": 45,
  "documents": 22,
  "thumbnail_cache_size": 52428800,
  "thumbnail_cache_human": "50.0 MB",
  "trash_size": 1048576,
  "trash_size_human": "1.0 MB"
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "detail": "Human-readable error message"
}
```

Common HTTP status codes:
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (e.g., invalid path, unsupported file type) |
| 403 | Permission denied |
| 404 | Not found (file or media item doesn't exist) |
| 500 | Server error (check backend logs) |

---

## Using the Interactive Docs

FastAPI automatically generates interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

At `/docs`, you can:
- See all endpoints
- Click "Try it out" to test them in the browser
- See exact request/response schemas
- No curl needed — test everything in-browser
