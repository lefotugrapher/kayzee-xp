#!/bin/zsh
# Copies site/ (including the room) into room-deploy/ and ships it to the separate Vercel project "kayzee-room".
# The main kayzee-xp project is NOT touched by this script.
set -e
cd "$(dirname "$0")"
rsync -a --delete --exclude .vercel --exclude node_modules --exclude '.env*' --exclude dev --exclude '*.md' --exclude .vercelignore \
  --exclude 'room/*.v3.*' --exclude 'room/room.v3.js' site/ room-deploy/
cd room-deploy
vercel deploy --prod --yes
