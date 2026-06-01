#!/usr/bin/env python3
"""
Synaps Database Cleaner
=======================
Scans all MediaFile records in the database and safely deletes any rows
where the file no longer exists on disk.
"""

import os
import logging
from database import SessionLocal
from models import MediaFile

logger = logging.getLogger("synaps.cleaner")

def setup_logging():
    formatter = logging.Formatter("%(asctime)s  %(levelname)-7s  %(message)s", datefmt="%H:%M:%S")
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(formatter)
    logger.setLevel(logging.INFO)
    logger.addHandler(ch)

def clean_database():
    logger.info(f"{'=' * 60}")
    logger.info("  Synaps Database Cleaner")
    logger.info(f"{'=' * 60}")

    db = SessionLocal()
    try:
        # Get all records
        all_media = db.query(MediaFile).all()
        total_records = len(all_media)
        logger.info(f"Checking {total_records} records in the database...")

        stale_records = []
        for media in all_media:
            if not os.path.exists(media.path):
                stale_records.append(media)

        if not stale_records:
            logger.info("Database is perfectly clean! No stale records found.")
            return

        logger.warning(f"Found {len(stale_records)} stale records (files missing on disk).")
        
        # Delete stale records
        for stale in stale_records:
            db.delete(stale)
            logger.debug(f"Deleted stale record: {stale.path}")

        db.commit()
        logger.info(f"✅ Successfully deleted {len(stale_records)} stale records from the database.")
        
    except Exception as e:
        logger.error(f"Error during database cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_logging()
    clean_database()
