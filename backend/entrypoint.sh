#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting API on port ${API_PORT:-8080}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT:-8080}"
