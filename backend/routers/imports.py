"""
Synaps Import Router — API endpoints for the Import Manager workflow.

Endpoints:
    POST /api/import/scan       Quick scan: file counts and sizes
    POST /api/import/preview    Full preview: destination mapping
    POST /api/import/execute    Start background import job
    GET  /api/import/progress/{job_id}   Poll job progress
    GET  /api/import/latest     Get the latest job status
"""

from fastapi import APIRouter, HTTPException
from import_manager import ImportManager

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/scan")
def scan_imports():
    """
    Quick scan of the import folder.
    Returns file counts, photo/video breakdown, and total size.
    Does NOT extract metadata — just counts files by extension.
    """
    try:
        result = ImportManager.scan()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview")
def preview_imports():
    """
    Full import preview.
    Extracts dates from every file and computes destination paths.
    Returns destination → file count mapping.
    Does NOT move any files.
    """
    try:
        result = ImportManager.preview()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute")
def execute_import():
    """
    Start a background import job.
    Returns the job ID immediately for progress polling.
    """
    # Check if an import is already running
    latest = ImportManager.get_latest_job()
    if latest and latest.status not in ("complete", "error"):
        return {
            "status": "already_running",
            "job_id": latest.id,
            "phase": latest.phase,
            "progress": latest.progress,
        }

    try:
        job = ImportManager.execute()
        return {
            "status": "started",
            "job_id": job.id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{job_id}")
def get_import_progress(job_id: str):
    """
    Poll the progress of an import job.
    Frontend calls this every ~2 seconds while import is running.
    """
    job = ImportManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@router.get("/latest")
def get_latest_import():
    """
    Get the most recent import job status.
    Useful when returning to the page to check if an import is in progress.
    """
    job = ImportManager.get_latest_job()
    if not job:
        return {"status": "none"}
    return job.to_dict()
