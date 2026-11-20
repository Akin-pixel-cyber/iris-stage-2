#!/usr/bin/env bash
# Restore Iris data (database + profile pictures) from S3 onto this server.
#   ./scripts/restore.sh                       latest copy
#   ./scripts/restore.sh --at 2026-11-20T10:00:00Z   the database as it was at that time (UTC)
#   ./scripts/restore.sh --force               replace data that is already here (the old data is kept aside first)
# Needs: Docker, a filled-in .env (LITESTREAM_BUCKET, LITESTREAM_REGION) and the EC2 instance role with the Iris S3 policy.
set -euo pipefail
cd "$(dirname "$0")/.."

AT=""; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --at) AT="${2:?--at needs a UTC time like 2026-11-20T10:00:00Z}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

[ -f .env ] || { echo "No .env here. Copy .env.example to .env and fill it in first."; exit 1; }
# Read only the values we need (sourcing the whole file would break on values with spaces, like MAIL_FROM)
getenv() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r"'"'"'' || true; }
export LITESTREAM_BUCKET="$(getenv LITESTREAM_BUCKET)" LITESTREAM_REGION="$(getenv LITESTREAM_REGION)"
DATA_DIR="$(getenv DATA_DIR)"; DATA_DIR="${DATA_DIR:-./data}"
[ -n "$LITESTREAM_BUCKET" ] || { echo "Set LITESTREAM_BUCKET in .env"; exit 1; }
[ -n "$LITESTREAM_REGION" ] || { echo "Set LITESTREAM_REGION in .env"; exit 1; }
mkdir -p "$DATA_DIR"
DATA_ABS="$(cd "$DATA_DIR" && pwd)"

echo "Stopping Iris and the backup helpers..."
docker compose stop iris litestream uploads-sync >/dev/null 2>&1 || true

if [ -e "$DATA_ABS/iris.db" ]; then
  if [ "$FORCE" -ne 1 ]; then
    echo "There is already data in $DATA_ABS. Run again with --force to replace it (the old files are kept aside)."; exit 1
  fi
  STAMP="$(date +%Y%m%d-%H%M%S)"; ASIDE="$DATA_ABS/before-restore-$STAMP"
  mkdir -p "$ASIDE"; mv "$DATA_ABS"/iris.db* "$DATA_ABS"/.iris.db-litestream "$ASIDE"/ 2>/dev/null || true
  echo "Old database moved to $ASIDE"
fi

echo "Restoring the database from s3://$LITESTREAM_BUCKET/iris/db ..."
ARGS=(-config /etc/litestream.yml -o /data/iris.db)
[ -n "$AT" ] && ARGS+=(-timestamp "$AT")
docker run --rm \
  -e LITESTREAM_BUCKET -e LITESTREAM_REGION \
  -v "$DATA_ABS":/data -v "$PWD/litestream/litestream.yml":/etc/litestream.yml:ro \
  litestream/litestream:0.3.13 restore "${ARGS[@]}" /data/iris.db

echo "Restoring profile pictures..."
docker run --rm --entrypoint aws \
  -v "$DATA_ABS":/data \
  amazon/aws-cli:latest s3 sync "s3://$LITESTREAM_BUCKET/uploads" /data/uploads --region "$LITESTREAM_REGION" --only-show-errors || echo "No pictures found in the backup (that is fine if nobody uploaded one)."

# The app runs as user 1000 inside the container
chown -R 1000:1000 "$DATA_ABS" 2>/dev/null || sudo chown -R 1000:1000 "$DATA_ABS"

echo "Done. Start Iris again with:  docker compose up -d --build"
