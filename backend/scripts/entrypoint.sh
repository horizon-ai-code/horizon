#!/bin/sh
python3 /app/scripts/detect_gpu.py
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
