# Synaps — Internal Engineering Handbook

> A comprehensive developer guide for the Synaps personal NAS media cloud.  
> Written based on deep analysis of the actual codebase, not generic documentation.

---

## What This Is

This documentation was written specifically for **this codebase** after analyzing every file. It is designed to help you:
- Understand how Synaps actually works
- Debug issues confidently
- Modify features safely
- Maintain the project independently

---

## Document Index

| # | Document | What It Covers |
|---|----------|---------------|
| 01 | [Project Overview](./01_project_overview.md) | Purpose, architecture, data flow, request lifecycle |
| 02 | [Backend Architecture](./02_backend_architecture.md) | Every backend file explained, startup flow, request flow |
| 03 | [Frontend Architecture](./03_frontend_architecture.md) | Every component explained, Next.js patterns, rendering |
| 04 | [Database and Indexing](./04_database_and_indexing.md) | SQLite schema, example rows, deduplication, grouping |
| 05 | [Media Scanner](./05_media_scanner.md) | Scanning algorithm, EXIF extraction, batch processing |
| 06 | [Thumbnail Pipeline](./06_thumbnail_pipeline.md) | Generation, caching, HEIC/video/PDF support, failures |
| 07 | [API Reference](./07_api_reference.md) | Every endpoint with curl examples and response shapes |
| 08 | [Routing and Navigation](./08_routing_and_navigation.md) | Next.js routing, sidebar nav, debugging broken navigation |
| 09 | [State Management](./09_state_management.md) | Zustand store, React state, known bugs |
| 10 | [Sync Engine](./10_sync_engine.md) | Upload pipeline, deduplication, file organization |
| 11 | [Deployment and Services](./11_deployment_and_services.md) | Production setup, systemd, scripts, git workflow |
| 12 | [Debugging Guide](./12_debugging_guide.md) | Scenario-based debugging, tools, commands |
| 13 | [Performance Guide](./13_performance_guide.md) | Bottlenecks, NAS optimizations, caching |
| 14 | [Code Flow Examples](./14_code_flow_examples.md) | Real step-by-step walkthroughs of key operations |
| 15 | [Future Improvements](./15_future_improvements.md) | Bug fixes, new features, roadmap |

---

## Architecture Diagrams

All diagrams are in [diagrams/architecture_diagrams.md](./diagrams/architecture_diagrams.md):

1. Full System Architecture
2. Request Lifecycle (sequence diagram)
3. Backend Module Dependency Graph
4. Frontend Component Tree
5. Scanner Flow (flowchart)
6. Thumbnail Generation Pipeline
7. Upload/Sync Flow
8. State Management Flow
9. Deployment Flow
10. Database Entity Relationship Diagram
11. Data Flow When Filter Changes

---

## Quick Reference

### "Where is X?" Map

| Thing | Location |
|-------|----------|
| API endpoints | `backend/routers/*.py` |
| Database tables | `backend/models.py` |
| Scanner logic | `backend/scanner.py` |
| Thumbnail generation | `backend/thumbnails.py` |
| Configuration | `backend/config.py` |
| Database file | `backend/synaps.db` |
| Thumbnail cache | `backend/thumbnails/` |
| Timeline page | `frontend/src/app/page.tsx` |
| Sidebar navigation | `frontend/src/components/Sidebar.tsx` |
| Global state | `frontend/src/lib/store.ts` |
| All API calls | `frontend/src/lib/api.ts` |
| CSS / design system | `frontend/src/app/globals.css` |
| Tailwind colors | `frontend/tailwind.config.ts` |
| API proxy config | `frontend/next.config.js` |

### "What calls what?" Quick Map

| Frontend Function | Backend Endpoint | Backend File |
|------------------|------------------|--------------|
| `getTimeline()` | `GET /api/media/timeline` | `routers/media.py` |
| `getMediaItem(id)` | `GET /api/media/item/{id}` | `routers/media.py` |
| `getThumbnailUrl(id)` | `GET /api/media/thumbnail/{id}` | `routers/media.py` |
| `getFileUrl(id)` | `GET /api/media/file/{id}` | `routers/media.py` |
| `toggleFavorite(id)` | `POST /api/media/favorite/{id}` | `routers/media.py` |
| `getMediaStats()` | `GET /api/media/stats` | `routers/media.py` |
| `browseDirectory(path)` | `GET /api/finder/browse?path=` | `routers/finder.py` |
| `searchMedia(q)` | `GET /api/search/?q=` | `routers/search.py` |
| `uploadFile(file)` | `POST /api/sync/upload` | `routers/sync.py` |
| `getTrash()` | `GET /api/trash/` | `routers/trash.py` |
| `moveToTrash(id)` | `POST /api/trash/delete/{id}` | `routers/trash.py` |
| `getSettings()` | `GET /api/settings/` | `routers/settings.py` |
| `triggerScan()` | `POST /api/scan` | `main.py` |

---

## Known Bugs Summary

| Bug | Severity | Where Documented |
|-----|----------|-----------------|
| Hash mismatch (scanner partial vs upload full) | High | Doc 10 |
| Orphaned DB records (deleted files stay indexed) | High | Doc 05, Doc 12 |
| Restore from trash doesn't re-index | Medium | Doc 10, Doc 15 |
| Upload doesn't trigger rescan | Medium | Doc 10 |
| Stats not refreshed after rescan | Low | Doc 09 |
| Video scrubbing not supported (no range requests) | Medium | Doc 15 |
| Favorite toggle doesn't update timeline grid | Low | Doc 09 |
| Path traversal risk in upload filename | Security | Doc 10, Doc 15 |
| Multiple scan threads if button clicked rapidly | Low | Doc 09 |

---

## First Steps If Something Breaks

1. Check if both services are running:
   ```bash
   curl http://localhost:8000/api/health
   curl http://localhost:3000
   ```

2. Read the backend logs:
   ```bash
   journalctl -u synaps-backend -n 50
   ```

3. Check the database:
   ```bash
   sqlite3 backend/synaps.db "SELECT COUNT(*) FROM media_files;"
   ```

4. Open browser DevTools → Console + Network tabs

5. Consult [12_debugging_guide.md](./12_debugging_guide.md) for your specific symptom.
