import sys
from backend.database import SessionLocal
from backend.models import MediaFile

db = SessionLocal()
files = db.query(MediaFile).order_by(MediaFile.date_taken).limit(10).all()
for f in files:
    print(f.id, f.date_taken, f.directory, f.relative_path, f.path)
