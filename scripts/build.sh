#!/bin/sh
# Build script that handles paths with special characters (e.g., #)
# Vite/Rollup cannot resolve modules when the project path contains '#'
# This script copies the client to a temp directory, builds, and copies dist back

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"

# Check if path contains problematic characters
case "$ROOT_DIR" in
  *\#*)
    echo "Path contains '#' - using temp directory for Vite build..."
    BUILD_DIR=$(mktemp -d)
    cp -r "$CLIENT_DIR/." "$BUILD_DIR/"
    cd "$BUILD_DIR" && npx vite build
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      rm -rf "$CLIENT_DIR/dist"
      cp -r "$BUILD_DIR/dist" "$CLIENT_DIR/dist"
    fi
    rm -rf "$BUILD_DIR"
    exit $EXIT_CODE
    ;;
  *)
    cd "$CLIENT_DIR" && npm run build
    ;;
esac
