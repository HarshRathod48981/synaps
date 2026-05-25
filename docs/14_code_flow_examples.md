# 14 — Code Flow Examples

Real, step-by-step walkthroughs of what happens in the code when you interact with Synaps. Follow each step through the actual files.

---

## Example 1: User Opens the Timeline Page

**Scenario**: You navigate to `http://nas-ip:3000` in your browser.

### Step 1: Browser Request

Browser sends: `GET http://nas-ip:3000/`

### Step 2: Next.js App Router

Next.js receives the request. It determines this maps to:
- `frontend/src/app/layout.tsx` (always runs)
- `frontend/src/app/page.tsx` (for the `/` route)

### Step 3: `layout.tsx` Runs

```tsx
// layout.tsx — Server Component (runs on Node.js, not browser)
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>
        <AppShell>{children}</AppShell>
        {/* children = page.tsx content */}
      </body>
    </html>
  );
}
```

HTML skeleton is sent to browser.

### Step 4: Browser Hydration (React Takes Over)

React loads the JavaScript bundle in the browser. It "hydrates" the HTML — attaches event handlers and starts React's component lifecycle.

`AppShell` runs:
```tsx
// AppShell.tsx — Client Component
export function AppShell({ children }) {
  const { sidebarOpen } = useAppStore();  // Reads Zustand: sidebarOpen = true

  return (
    <>
      <Sidebar />        // Rendered because sidebarOpen = true
      <MediaViewer />    // Rendered but hidden (viewerOpen = false)
      <main className="lg:ml-[260px]">  // Shifted right on desktop
        {children}       // = page.tsx content
      </main>
    </>
  );
}
```

### Step 5: Timeline Page `useEffect` Fires

```tsx
// page.tsx
useEffect(() => {
  setPage(1);
  setGroups([]);
  setHasMore(true);
  fetchPage(1, true);
}, [activeFilter]);  // activeFilter = null (show all)
```

Since this is the first render, this fires immediately.

### Step 6: `fetchPage(1, true)` Runs

```tsx
async function fetchPage(pageNum, reset) {
  setLoading(true);    // State: loading = true → spinner appears

  const params = { page: 1, per_page: 80 };  // No filter (activeFilter = null)
  const data = await getTimeline(params);     // ← API call
```

### Step 7: API Call to Backend

`getTimeline()` in `api.ts`:
```tsx
return fetchAPI(`/media/timeline?page=1&per_page=80`);
```

`fetchAPI` sends: `GET http://nas-ip:3000/api/media/timeline?page=1&per_page=80`

### Step 8: Next.js Proxy

`next.config.js` rewrites this to:
`GET http://localhost:8000/api/media/timeline?page=1&per_page=80`

### Step 9: FastAPI Receives Request

```python
# routers/media.py — get_timeline()
@router.get("/timeline")
def get_timeline(page=1, per_page=80, media_type=None, ...):
    query = db.query(MediaFile)
    # No filters applied (media_type=None)
    
    total = query.count()    # e.g., 347 total files
    
    # Get 80 items sorted by date_taken descending
    items = query.order_by(desc(MediaFile.date_taken))\
                 .offset(0).limit(80).all()
```

### Step 10: Grouping by Month

```python
groups = {}
for item in items:
    dt = item.date_taken       # e.g., 2024-01-15 14:32:55
    key = dt.strftime("%Y-%m") # "2024-01"
    if key not in groups:
        groups[key] = {"year": 2024, "month": 1, "month_name": "January", "items": []}
    groups[key]["items"].append(_serialize_media(item))

sorted_groups = sorted(groups.values(), key=..., reverse=True)
```

Response JSON:
```json
{
  "groups": [{"year": 2024, "month": 5, "items": [...]}, ...],
  "total": 347,
  "total_pages": 5
}
```

### Step 11: Frontend Processes Response

```tsx
// Back in page.tsx → fetchPage()
setGroups(newGroups);        // State: groups = [{...January...}, ...]
setHasMore(1 < 5);           // State: hasMore = true
setLoading(false);           // State: loading = false → spinner disappears
```

### Step 12: Render

React re-renders because state changed. The timeline renders:

```tsx
{groups.map(group => (
  <section key={`${group.year}-${group.month}`}>
    <button>January 2024 (35 items)</button>
    <MediaGrid items={group.items} />
  </section>
))}
```

### Step 13: Thumbnails Load

For each item in `MediaGrid`, a `<MediaThumbnail>` renders:
```tsx
<img src="/api/media/thumbnail/f47ac10b-..." loading="lazy" />
```

The browser lazily loads each thumbnail as it enters the viewport. Each request triggers thumbnail generation (or cache hit) in the backend.

**Total time**: ~200–500ms for first meaningful paint (until groups appear). Thumbnails continue loading over the next few seconds.

---

## Example 2: User Clicks a Photo

**Scenario**: User clicks on `IMG_4532.HEIC` in the timeline.

### Step 1: Click Handler

```tsx
// MediaThumbnail in MediaGrid.tsx
<motion.div onClick={() => openViewer(item.id)}>
```

`openViewer("f47ac10b-...")` is called.

### Step 2: Zustand Store Updates

```tsx
// store.ts
openViewer: (mediaId) => set({ viewerOpen: true, viewerMediaId: "f47ac10b-..." }),
```

Two state values change: `viewerOpen = true`, `viewerMediaId = "f47ac10b-..."`.

### Step 3: MediaViewer Detects Change

```tsx
// MediaViewer.tsx — always mounted in AppShell
useEffect(() => {
  if (viewerMediaId) {          // "f47ac10b-..." is truthy
    setLoading(true);
    setZoom(1);
    getMediaItem("f47ac10b-...")   // API call: GET /api/media/item/f47ac10b-...
      .then(setMedia)
      .finally(() => setLoading(false));
  }
}, [viewerMediaId]);
```

### Step 4: Backend Returns Full Metadata

```python
# routers/media.py
@router.get("/item/{media_id}")
def get_media_item(media_id, db=...):
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    return _serialize_media(item, full=True)  # full=True adds path, camera, GPS
```

### Step 5: MediaViewer Renders

The `<MediaViewer>` (previously hidden since `viewerOpen = false`) now renders:
- `viewerOpen = true` → the `if (!viewerOpen) return null` check passes
- Full-screen overlay appears with Framer Motion `animate({ opacity: 1 })`
- Shows loading spinner while `loading = true`
- Once `media` state is set: renders `<img src="/api/media/file/f47ac10b-...">` (original file)

### Step 6: Full Image Loads

Browser requests the original HEIC file: `GET /api/media/file/f47ac10b-...`

FastAPI serves it:
```python
@router.get("/file/{media_id}")
def get_file(media_id, db=...):
    item = db.query(MediaFile)...first()
    return FileResponse(item.path, media_type=item.mime_type, filename=item.filename)
```

The browser decodes and displays the full-resolution image.

---

## Example 3: User Opens Finder and Navigates Into a Folder

**Scenario**: User opens `/finder`, then clicks on "Vault" → "Harsh" → "Iphone".

### Step 1: Navigate to `/finder`

User clicks "Finder" in sidebar → `<Link href="/finder">` → client-side navigation.

### Step 2: `finder/page.tsx` Mounts

```tsx
const [currentPath, setCurrentPath] = useState('');
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  navigate('');    // Start at root
}, []);
```

`navigate('')` calls `browseDirectory('')` → `GET /api/finder/browse?path=`

### Step 3: Backend Returns Root Directory

```python
# routers/finder.py
clean_path = os.path.normpath('').lstrip('/')   # = ""
full_path = STORAGE_PATH    # Since clean_path is empty

entries = sorted(os.listdir(STORAGE_PATH))  # ["Vault", ...]
```

Response:
```json
{
  "current_path": "/",
  "breadcrumb": [{"name": "Storage", "path": ""}],
  "folders": [{"name": "Vault", "path": "Vault", "children_count": 1}],
  "files": []
}
```

### Step 4: User Clicks "Vault"

```tsx
<motion.button onClick={() => navigate(folder.path)}>  // folder.path = "Vault"
```

`navigate("Vault")`:
1. `setCurrentPath("Vault")`
2. `browseDirectory("Vault")` → `GET /api/finder/browse?path=Vault`
3. Backend returns: `{folders: [{name: "Harsh", path: "Vault/Harsh"}]}`

### Step 5: User Clicks "Harsh", then "Iphone"

Same pattern repeats. Final request: `GET /api/finder/browse?path=Vault/Harsh/Iphone`

### Step 6: Backend Path Traversal Check

```python
clean_path = os.path.normpath("Vault/Harsh/Iphone").lstrip("/")
# = "Vault/Harsh/Iphone"

if ".." in clean_path:    # False — safe
    raise HTTPException(400)

full_path = os.path.join(STORAGE_PATH, "Vault/Harsh/Iphone")
# = "/storage/Vault/Harsh/Iphone"
```

Backend lists the files in that directory and returns them.

---

## Example 4: User Uploads a Photo via Sync

**Scenario**: User selects `IMG_9000.HEIC` (4.2MB) on the Sync page and clicks Upload.

### Step 1: File Selection

```tsx
<input type="file" multiple onChange={(e) => handleFiles(e.target.files)} />
```

`handleFiles` creates an `UploadItem` with `status: 'pending'`.

### Step 2: Upload Button Clicked

`startUpload()` loops through pending items and processes each:

```tsx
// Status: pending → uploading
setUploads(prev => prev.map((u, idx) => idx === i ? {...u, status: 'uploading', progress: 50} : u));

const result = await uploadFile(uploads[i].file, 'iPhone');
```

### Step 3: `uploadFile()` in `api.ts`

```tsx
export async function uploadFile(file, device) {
  const formData = new FormData();
  formData.append('file', file);       // 4.2MB binary data
  formData.append('device', device);   // "iPhone"
  return fetch('/api/sync/upload', { method: 'POST', body: formData }).then(r => r.json());
}
```

Multipart form data is sent. Next.js proxies to FastAPI.

### Step 4: FastAPI Receives Upload

```python
# routers/sync.py
@router.post("/upload")
async def upload_file(file: UploadFile = File(...), device: str = Form("iPhone"), db=...):
    content = await file.read()    # Reads all 4.2MB into memory
    file_hash = hashlib.md5(content).hexdigest()   # "d41d8cd98f00b204e9800998ecf8427e"
```

### Step 5: Duplicate Check

```python
# Check SyncRecord table
existing = db.query(SyncRecord).filter(SyncRecord.file_hash == file_hash).first()
if existing:
    return {"status": "duplicate", ...}

# Check MediaFile table
existing_media = db.query(MediaFile).filter(MediaFile.file_hash == file_hash).first()
if existing_media:
    return {"status": "duplicate", ...}
```

Both checks return None → file is new.

### Step 6: Create Destination Directory

```python
now = datetime.now()    # 2026-05-23
year_month_dir = os.path.join(SYNC_TARGET_DIR, "2026", "05")
os.makedirs(year_month_dir, exist_ok=True)
# Creates: /storage/Vault/Harsh/Iphone/2026/05/
```

### Step 7: Handle Name Collision

```python
dest_path = "/storage/Vault/Harsh/Iphone/2026/05/IMG_9000.HEIC"
# Check if it exists...
# Assume it doesn't → use as-is
```

### Step 8: Write File

```python
with open(dest_path, "wb") as f:
    f.write(content)    # Writes 4.2MB to disk
```

### Step 9: Save SyncRecord

```python
sync_record = SyncRecord(
    filename="IMG_9000.HEIC",
    file_hash="d41d8cd98f...",
    file_size=4200000,
    destination_path=dest_path,
    source_device="iPhone",
)
db.add(sync_record)
db.commit()
```

### Step 10: Response and UI Update

```json
{"status": "success", "filename": "IMG_9000.HEIC", "path": "/storage/...", "size": 4200000}
```

Frontend updates:
```tsx
setUploads(prev => prev.map((u, idx) => idx === i ? {...u, status: 'success', progress: 100, message: result.message} : u));
```

The file row shows a green checkmark. **The photo is on the NAS but NOT in the timeline yet** — a rescan is needed.

---

## Example 5: Scanner Indexes a New File

**Scenario**: Backend starts up, `run_initial_scan()` runs in background thread.

### Step 1: Load Existing Paths

```python
existing_paths = set()
for (path,) in db.query(MediaFile.path).all():
    existing_paths.add(path)
# existing_paths = {"/storage/.../IMG_4532.HEIC", ...}
```

### Step 2: Walk Directory

```python
for root, dirs, files in os.walk("/storage/Vault/Harsh/Iphone"):
    # root = "/storage/Vault/Harsh/Iphone/2024/01"
    # files = ["IMG_4532.HEIC", "IMG_4533.HEIC"]
```

### Step 3: Process New File

For `IMG_9000.HEIC` (just uploaded):
```python
filepath = "/storage/Vault/Harsh/Iphone/2026/05/IMG_9000.HEIC"

# Not in existing_paths → process it
file_stat = os.stat(filepath)
# file_stat.st_size = 4200000
# file_stat.st_mtime = 1748000000 (Unix timestamp)

classification = classify_media(".heic", "IMG_9000.HEIC")
# {"media_type": "image", "is_screenshot": False, "is_raw": False}

date_taken = get_best_date(filepath, "IMG_9000.HEIC")
# Tries EXIF → finds "2024:06:15 14:32:55" → returns datetime(2024, 6, 15, 14, 32, 55)

file_hash = compute_file_hash(filepath)
# Reads first 64KB → "abc123..." (different from sync upload's full hash!)
```

### Step 4: Create MediaFile Object

```python
media_file = MediaFile(
    filename="IMG_9000.HEIC",
    path="/storage/Vault/Harsh/Iphone/2026/05/IMG_9000.HEIC",
    relative_path="Vault/Harsh/Iphone/2026/05/IMG_9000.HEIC",
    directory="Vault/Harsh/Iphone/2026/05",
    extension=".heic",
    mime_type="image/heic",
    file_size=4200000,
    media_type="image",
    date_taken=datetime(2024, 6, 15, 14, 32, 55),  # From EXIF
    file_hash="abc123...",
)
batch.append(media_file)
stats["new"] += 1
```

### Step 5: Batch Commit

```python
if len(batch) >= 100:
    db.add_all(batch)
    db.commit()
    batch = []
```

Or at end of directory:
```python
if batch:
    db.add_all(batch)
    db.commit()
```

The photo now has a row in `media_files` and will appear in the timeline on the next request.

---

## Example 6: Thumbnail Gets Generated

**Scenario**: Browser requests thumbnail for `IMG_9000.HEIC` for the first time.

### Step 1: Browser Requests

```html
<img src="/api/media/thumbnail/f47ac10b-NEWID" loading="lazy">
```

### Step 2: FastAPI Route

```python
# routers/media.py
@router.get("/thumbnail/{media_id}")
def get_thumbnail(media_id, db=...):
    item = db.query(MediaFile).filter(MediaFile.id == media_id).first()
    # item.path = "/storage/Vault/Harsh/Iphone/2026/05/IMG_9000.HEIC"
    
    thumb_path = get_thumbnail_path(item.path)
    # thumb_path = "backend/thumbnails/md5-of-path.webp"
    
    if os.path.exists(thumb_path):    # First time = False
        return FileResponse(thumb_path, media_type="image/webp")
    
    result = generate_thumbnail(item.path)
```

### Step 3: Thumbnail Generation

```python
# thumbnails.py — generate_thumbnail()
ext = ".heic"

if HAS_HEIF:
    success = generate_image_thumbnail(item.path, thumb_path)
    # Opens HEIC with pillow-heif → resizes → saves as WebP
```

`generate_image_thumbnail()`:
```python
with Image.open("/storage/.../IMG_9000.HEIC") as img:
    # pillow-heif decodes HEIC → Pillow Image object
    img.thumbnail((320, 320), Image.LANCZOS)  # Resize
    img.save("backend/thumbnails/abc123.webp", "WEBP", quality=75)
    # → saves ~15KB WebP file
```

Takes ~500ms–2s on Core2Duo for a 12MP HEIC.

### Step 4: Update Database

```python
item.has_thumbnail = True
item.thumbnail_path = "backend/thumbnails/abc123.webp"
db.commit()
```

### Step 5: Serve Thumbnail

```python
return FileResponse("backend/thumbnails/abc123.webp", media_type="image/webp")
```

Browser receives ~15KB WebP image. MediaThumbnail component:
```tsx
<img onLoad={() => setLoaded(true)} ...>
// setLoaded(true) → skeleton hides, image shows
```

### Step 6: Second Request (Cache Hit)

Next time ANY component requests this thumbnail:
```python
thumb_path = get_thumbnail_path(item.path)   # Same path → same hash → same .webp file
if os.path.exists(thumb_path):               # True now!
    return FileResponse(thumb_path, ...)     # Instant response
```

Under 1ms response time, no image processing at all.
