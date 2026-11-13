# AI-Video-Studio
AI video generator - create cinematic videos from text and images

## Tools

Both tools need `ffmpeg` and `python3`; `build_music_video.py` also needs `numpy`.

### `tools/build_music_video.py` — rebuild a music video from segments + the original song

AI video generators usually return a bit less than the window you ask for (e.g. 9.7 s
of every 10 s of the song), so just joining the segments leaves a small hole in the
song at every join. If you have the **original full song**, use this tool:

```bash
python3 tools/build_music_video.py song.mp3 segments/ -o music_video.mp4
python3 tools/build_music_video.py song.mp3 segments/ -o out_1080p.mp4 --height 1080
python3 tools/build_music_video.py song.mp3 segments/ -o out.mp4 --dry-run   # only show the plan
```

- Finds where each segment sits in the song by matching the segment's own audio
  (sample-accurate; the file names / numbering don't matter, the order is detected).
- Uses the original song as one continuous soundtrack, untouched.
- Keeps every segment exactly in sync with the song and fills each gap between
  segments with a short dissolve of exactly the missing length (overlaps are trimmed).
- Refuses to silently bridge large gaps (default > 2 s) because that usually means a
  segment is missing; pass `--allow-large-gaps` to bridge them anyway.
- The video ends where the last segment ends, with a short audio fade-out (`--fade-out 0` to disable).

### `tools/join_segments.py` — join segments when you don't have the original song

Concatenates segments (natural filename order) keeping each segment's own audio, with
normalised resolution / frame rate / audio format, optional crossfade, overlap trimming
and audio-only output. Note: it cannot restore audio that the generator cut off.

```bash
python3 tools/join_segments.py segments/ -o full.mp4
python3 tools/join_segments.py segments/ -o full.mp3 --audio-only
```
