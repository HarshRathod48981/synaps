# Synaps — Personal NAS Media Cloud

A beautiful, Apple-inspired personal media cloud for your NAS.  
Browse, stream, and sync your entire media library from any device.

<p align="center">
  <strong>Apple Photos + Finder + Google Photos — on your own NAS.</strong>
</p>

---

## ✨ Features

- **Timeline View** — Apple Photos-style chronological media grid with infinite scroll
- **Finder View** — macOS Finder-like directory browser with tree navigation
- **iPhone Sync** — Upload photos/videos from Safari with deduplication
- **Media Viewer** — Fullscreen viewer with zoom, video streaming, and metadata
- **Video Streaming** — Progressive playback without full download
- **Smart Thumbnails** — Auto-generated WebP thumbnails with caching
- **Global Search** — Search by filename, folder, and extension
- **Trash System** — 30-day auto-delete recycle bin
- **Media Filters** — Filter by photos, videos, screenshots, documents, favorites

## 🏗 Architecture

```
synaps/
├── backend/           # FastAPI (Python) — REST API + media processing
│   ├── main.py        # App entry point with auto-scan on startup
│   ├── config.py      # Configuration with env var overrides
│   ├── database.py    # SQLite via SQLAlchemy
│   ├── models.py      # MediaFile, TrashItem, SyncRecord, Setting
│   ├── scanner.py     # Async filesystem indexer with EXIF extraction
│   ├── thumbnails.py  # WebP thumbnail generator with caching
│   └── routers/       # API endpoints
│       ├── media.py   # Timeline, thumbnails, streaming, favorites
│       ├── finder.py  # Directory browsing, tree view
│       ├── sync.py    # Upload with deduplication
│       ├── search.py  # Filename/folder search
│       ├── trash.py   # Trash management
│       └── settings.py # App settings & storage usage
├── frontend/          # Next.js 14 + TypeScript + Tailwind CSS
│   └── src/
│       ├── app/       # Pages: Timeline, Finder, Sync, Search, Trash, Settings
│       ├── components/ # Sidebar, MediaGrid, MediaViewer, TopBar, AppShell
│       └── lib/       # API client, Zustand store
└── mock_storage/      # Dev-mode mock of NAS directory structure
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- ffmpeg (optional, for video thumbnails)

### Setup

```bash
# 1. Clone and enter the project
cd nas_dashboard

# 2. Set up Python backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Set up Next.js frontend
cd frontend
npm install
cd ..

# 4. Generate mock test data (optional)
python3 generate_mock_data.py

# 5. Start backend (Terminal 1)
cd backend
source venv/bin/activate
python main.py

# 6. Start frontend (Terminal 2)
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### Or use the scripts:
```bash
chmod +x setup.sh start.sh
./setup.sh     # One-time setup
./start.sh     # Start both servers
```

## 🖥 NAS Deployment

### On your Ubuntu NAS:

```bash
# 1. Install dependencies
sudo apt update
sudo apt install python3 python3-venv python3-pip nodejs npm ffmpeg

# 2. Clone project to NAS
scp -r nas_dashboard/ user@192.168.0.101:/opt/synaps/

# 3. SSH into NAS
ssh user@192.168.0.101
cd /opt/synaps

# 4. Configure storage path
echo "SYNAPS_STORAGE_PATH=/storage" >> backend/.env

# 5. Setup
./setup.sh

# 6. Start
./start.sh
```

Access from iPhone/Mac: **http://192.168.0.101:3000**

### Auto-start on boot (systemd):

```ini
# /etc/systemd/system/synaps-backend.service
[Unit]
Description=Synaps Backend
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/opt/synaps/backend
ExecStart=/opt/synaps/backend/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🎨 Design

- **Glassmorphism** — Frosted glass panels with blur
- **Dark mode first** — Elegant dark theme, light mode available
- **Apple typography** — SF Pro / Inter font stack
- **Smooth animations** — Framer Motion throughout
- **Responsive** — Optimized for iPhone Safari and desktop

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/media/timeline` | GET | Timeline with month grouping |
| `/api/media/thumbnail/{id}` | GET | Get/generate thumbnail |
| `/api/media/file/{id}` | GET | Serve original file |
| `/api/media/stream/{id}` | GET | Stream video |
| `/api/media/stats` | GET | Library statistics |
| `/api/finder/browse` | GET | Browse directories |
| `/api/finder/tree` | GET | Directory tree |
| `/api/sync/upload` | POST | Upload file with dedup |
| `/api/search/` | GET | Search media |
| `/api/trash/` | GET | List trash |
| `/api/settings/` | GET/PUT | App settings |
| `/api/scan` | POST | Trigger rescan |

## 📐 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS 3 |
| Animation | Framer Motion |
| State | Zustand |
| Icons | Lucide React |
| Backend | FastAPI (Python) |
| Database | SQLite (SQLAlchemy) |
| Thumbnails | Pillow + ffmpeg |
| Metadata | exifread |

## 📝 License

Personal use. Built for your NAS.
