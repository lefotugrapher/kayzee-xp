#!/bin/zsh
# Turns the rendered push-in frames (build/path/f000.png ...) into the two short films the room page plays:
# push-in.mp4 (chair -> monitor) and push-out.mp4 (the same frames reversed).
set -e
cd "$(dirname "$0")"
OUT=../site/room
VF="scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p"
ENC=(-c:v libx264 -preset slow -crf 17 -g 8 -bf 0 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -movflags +faststart -an)
ffmpeg -y -loglevel error -framerate 24 -i build/path/f%03d.png -vf "$VF" $ENC $OUT/push-in.mp4
ffmpeg -y -loglevel error -framerate 24 -i build/path/f%03d.png -vf "reverse,$VF" $ENC $OUT/push-out.mp4
ls -la $OUT/push-in.mp4 $OUT/push-out.mp4
