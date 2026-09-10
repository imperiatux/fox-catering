#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Fox Catering — deployment helper
# Run this script on the target machine after copying the deploy/ folder
# and the fox-catering-app.tar.gz image archive.
#
# Usage:
#   ./deploy.sh                 # load image + start stack
#   ./deploy.sh start           # start (or restart) the stack
#   ./deploy.sh stop            # stop the stack
#   ./deploy.sh logs            # tail logs
# ---------------------------------------------------------------------------
set -e

IMAGE_ARCHIVE="fox-catering-app.tar.gz"
COMPOSE_FILE="docker-compose.yml"

cmd="${1:-start}"

# --- helpers ----------------------------------------------------------------
require_env() {
  if [ ! -f ".env" ]; then
    echo ""
    echo "ERROR: .env file not found."
    echo "Copy .env.example to .env and fill in your values:"
    echo "  cp .env.example .env && nano .env"
    echo ""
    exit 1
  fi
}

# --- commands ---------------------------------------------------------------
case "$cmd" in
  start)
    require_env

    # Load image if the archive exists next to this script
    if [ -f "$IMAGE_ARCHIVE" ]; then
      echo "Loading image from $IMAGE_ARCHIVE …"
      docker load < "$IMAGE_ARCHIVE"
    fi

    echo "Starting Fox Catering …"
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "App running at http://localhost:3000"
    echo "Admin panel:  http://localhost:3000/admin/login"
    ;;

  stop)
    docker compose -f "$COMPOSE_FILE" down
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f app
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Usage: $0 [start|stop|logs]"
    exit 1
    ;;
esac
