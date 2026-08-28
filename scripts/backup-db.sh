#!/usr/bin/env bash
set -Eeuo pipefail

: "${BACKUP_DIR:=./backups/$(date -u +%Y%m%dT%H%M%SZ)}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=openteams}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD before running backup}"
: "${POSTGRES_DB:=openteams}"
: "${MINIO_ALIAS:=local}"
: "${MINIO_ENDPOINT:=http://localhost:9000}"
: "${MINIO_ACCESS_KEY:?Set MINIO_ACCESS_KEY before running backup}"
: "${MINIO_SECRET_KEY:?Set MINIO_SECRET_KEY before running backup}"
: "${MINIO_BUCKET:=openteams-files}"

mkdir -p "$BACKUP_DIR"
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_dump --format=custom --no-owner --no-privileges --host="$POSTGRES_HOST" --port="$POSTGRES_PORT" --username="$POSTGRES_USER" --file="$BACKUP_DIR/$POSTGRES_DB.dump" "$POSTGRES_DB"
unset PGPASSWORD

if command -v mc >/dev/null 2>&1; then
  mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
  mc mirror --preserve "$MINIO_ALIAS/$MINIO_BUCKET" "$BACKUP_DIR/minio/$MINIO_BUCKET"
else
  echo "mc is not installed; PostgreSQL backup completed, MinIO backup skipped" >&2
fi

sha256sum "$BACKUP_DIR/$POSTGRES_DB.dump" > "$BACKUP_DIR/SHA256SUMS"
printf 'Backup written to %s\n' "$BACKUP_DIR"
