#!/bin/bash
set -e

echo "==> Building dashboard..."
cd dashboard
npm install
npx vite build
echo "==> Dashboard built successfully"

echo "==> Copying to server/public..."
mkdir -p ../server/public
cp -r dist/. ../server/public/
echo "==> Files copied"

echo "==> Installing server dependencies..."
cd ../server
npm install
echo "==> Build complete!"
