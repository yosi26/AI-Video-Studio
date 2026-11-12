#!/usr/bin/env python3
"""Join music-video segments into one continuous clip, keeping each segment's audio.

Every segment is normalized (resolution, frame rate, pixel format, audio sample
rate / channels) before concatenation, so segments coming from different
generators or with slightly different encodings join without glitches.
A segment with no audio track gets silence of the same length.

Examples:
    python3 tools/join_segments.py seg1.mp4 seg2.mp4 seg3.mp4 -o full_song.mp4
    python3 tools/join_segments.py segments/ -o full_song.mp4          # natural filename order
    python3 tools/join_segments.py segments/ -o full_song.mp4 --crossfade 0.3
    python3 tools/join_segments.py segments/ -o full_song.mp3 --audio-only
    python3 tools/join_segments.py segments/ -o full_song.mp4 --trim-start 0.5   # drop overlap
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}


def natural_key(path: Path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", path.name)]


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    duration = float(data["format"].get("duration") or (video or audio or {}).get("duration") or 0)
    fps = None
    if video and video.get("avg_frame_rate", "0/0") != "0/0":
        num, den = video["avg_frame_rate"].split("/")
        fps = float(num) / float(den) if float(den) else None
    return {
        "path": path,
        "duration": duration,
        "has_video": video is not None,
        "has_audio": audio is not None,
        "width": video and video.get("width"),
        "height": video and video.get("height"),
        "fps": fps,
    }


def collect_inputs(items: list[str]) -> list[Path]:
    files: list[Path] = []
    for item in items:
        p = Path(item)
        if p.is_dir():
            files.extend(sorted((f for f in p.iterdir() if f.suffix.lower() in VIDEO_EXTS), key=natural_key))
        elif p.is_file():
            files.append(p)
        else:
            sys.exit(f"Not found: {item}")
    if len(files) < 2:
        sys.exit("Need at least two segments to join.")
    return files


def build_command(segs, out: Path, args) -> list[str]:
    audio_only = args.audio_only
    W = args.width or segs[0]["width"] or 1280
    H = args.height or segs[0]["height"] or 720
    W, H = W - W % 2, H - H % 2
    fps = args.fps or round(max((s["fps"] or 0) for s in segs) or 30, 3)
    cf = args.crossfade
    ts, te = args.trim_start, args.trim_end

    cmd = ["ffmpeg", "-hide_banner", "-y"]
    for s in segs:
        cmd += ["-i", str(s["path"])]
    # Silent audio source for segments that have no audio track.
    silence_idx = len(segs)
    if any(not s["has_audio"] for s in segs):
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]

    filters, vlabels, alabels, durations = [], [], [], []
    for i, s in enumerate(segs):
        start = ts if i > 0 else 0.0          # trim-start applies to every segment except the first
        end_cut = te if i < len(segs) - 1 else 0.0  # trim-end applies to every segment except the last
        dur = max(s["duration"] - start - end_cut, 0.1)
        durations.append(dur)
        trim = f"trim=start={start}:duration={dur}"
        atrim = f"atrim=start={start}:duration={dur}"
        if not audio_only:
            filters.append(
                f"[{i}:v]{trim},setpts=PTS-STARTPTS,"
                f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,"
                f"fps={fps},format=yuv420p,settb=AVTB[v{i}]"
            )
            vlabels.append(f"[v{i}]")
        src = f"[{i}:a]{atrim}," if s["has_audio"] else f"[{silence_idx}:a]atrim=duration={dur},"
        filters.append(
            f"{src}asetpts=PTS-STARTPTS,aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo[a{i}]"
        )
        alabels.append(f"[a{i}]")

    n = len(segs)
    if cf > 0:
        # Chain xfade / acrossfade pairwise.
        if not audio_only:
            prev, offset = vlabels[0], 0.0
            for i in range(1, n):
                offset += durations[i - 1] - cf
                label = "[vout]" if i == n - 1 else f"[vx{i}]"
                filters.append(f"{prev}{vlabels[i]}xfade=transition=fade:duration={cf}:offset={offset:.3f}{label}")
                prev = label
        prev = alabels[0]
        for i in range(1, n):
            label = "[aout]" if i == n - 1 else f"[ax{i}]"
            filters.append(f"{prev}{alabels[i]}acrossfade=d={cf}:c1=tri:c2=tri{label}")
            prev = label
    else:
        if audio_only:
            filters.append("".join(alabels) + f"concat=n={n}:v=0:a=1[aout]")
        else:
            pairs = "".join(v + a for v, a in zip(vlabels, alabels))
            filters.append(pairs + f"concat=n={n}:v=1:a=1[vout][aout]")

    cmd += ["-filter_complex", ";".join(filters)]
    if audio_only:
        cmd += ["-map", "[aout]"]
        if out.suffix.lower() == ".wav":
            cmd += ["-c:a", "pcm_s16le"]
        elif out.suffix.lower() in {".m4a", ".aac"}:
            cmd += ["-c:a", "aac", "-b:a", "256k"]
        else:
            cmd += ["-c:a", "libmp3lame", "-b:a", "320k"]
    else:
        cmd += [
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "medium", "-crf", str(args.crf),
            "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart",
        ]
    cmd.append(str(out))
    return cmd


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", help="Segment files in playback order, or a folder (sorted by name)")
    ap.add_argument("-o", "--output", required=True, help="Output file (.mp4 for video, .mp3/.wav/.m4a with --audio-only)")
    ap.add_argument("--crossfade", type=float, default=0.0, help="Seconds of video+audio crossfade between segments (default: hard cut)")
    ap.add_argument("--trim-start", type=float, default=0.0, help="Seconds to cut from the start of every segment after the first (removes overlap)")
    ap.add_argument("--trim-end", type=float, default=0.0, help="Seconds to cut from the end of every segment before the last")
    ap.add_argument("--audio-only", action="store_true", help="Output only the joined song audio")
    ap.add_argument("--width", type=int, help="Output width (default: first segment's width)")
    ap.add_argument("--height", type=int, help="Output height (default: first segment's height)")
    ap.add_argument("--fps", type=float, help="Output frame rate (default: highest segment frame rate)")
    ap.add_argument("--crf", type=int, default=18, help="x264 quality, lower is better (default: 18)")
    args = ap.parse_args()

    files = collect_inputs(args.inputs)
    segs = [probe(f) for f in files]
    if not args.audio_only and not all(s["has_video"] for s in segs):
        sys.exit("Some inputs have no video stream; use --audio-only or remove them.")

    print("Segments in order:")
    total = 0.0
    for i, s in enumerate(segs, 1):
        total += s["duration"]
        print(f"  {i:2d}. {s['path'].name}  {s['duration']:.2f}s  "
              f"{s['width']}x{s['height']} @ {s['fps'] and round(s['fps'], 2)}fps  "
              f"audio={'yes' if s['has_audio'] else 'NO (silence added)'}")
    print(f"Sum of segment lengths: {total:.2f}s")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(build_command(segs, out, args), check=True)
    final = probe(out)
    print(f"\nDone: {out}  ({final['duration']:.2f}s)")


if __name__ == "__main__":
    main()
