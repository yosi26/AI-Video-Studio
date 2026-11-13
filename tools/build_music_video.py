#!/usr/bin/env python3
"""Rebuild a music video from AI-generated segments plus the ORIGINAL full song.

Problem this solves: video generators usually return slightly less than the
window you asked for (e.g. 9.7 s of every 10 s of the song), so simply
concatenating the segments leaves a small hole in the song at every join.

What this tool does:
  1. Finds where every segment sits inside the original song, by matching the
     segment's own audio against the song (sample-accurate, no naming rules).
  2. Builds the soundtrack from the original song, untouched and continuous.
  3. Keeps every segment exactly in sync with the song and fills each gap
     between segments with a short dissolve (the length of the missing time).
     If two segments overlap, the start of the later one is trimmed.
  4. Encodes one video (optionally scaled), with a short fade-out at the end.

Needs: ffmpeg, ffprobe, python3, numpy.

Examples:
    python3 tools/build_music_video.py song.mp3 seg1.mp4 seg2.mp4 ... -o out.mp4
    python3 tools/build_music_video.py song.mp3 segments/ -o out.mp4 --dry-run
    python3 tools/build_music_video.py song.mp3 segments/ -o out_1080p.mp4 --height 1080
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 16000  # sample rate used only for locating segments in the song
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}


def natural_key(p: Path):
    m = re.search(r"(\d+)\.[^.]+$", p.name)  # trailing number, e.g. "abc123-7.mp4" -> 7
    if m:
        return (0, int(m.group(1)), p.name)
    return (1, [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p.name)], p.name)


def run(cmd):
    subprocess.run(cmd, check=True)


def probe(path: Path) -> dict:
    d = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=True, capture_output=True, text=True).stdout)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    if v is None:
        sys.exit(f"No video stream in {path}")
    num, den = v["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    dur = float(v.get("duration") or d["format"]["duration"])
    nb = v.get("nb_frames")
    frames = int(nb) if nb and nb.isdigit() else round(dur * fps)
    return {"path": path, "w": v["width"], "h": v["height"], "fps": fps,
            "fps_expr": v["r_frame_rate"], "frames": frames,
            "has_audio": any(s["codec_type"] == "audio" for s in d["streams"])}


def decode_mono(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


def locate(song: np.ndarray, seg: np.ndarray):
    """Return (start_seconds, normalized_correlation, runner_up_correlation)."""
    n = 1 << int(np.ceil(np.log2(len(song) + len(seg))))
    seg0 = seg - seg.mean()
    cc = np.fft.irfft(np.fft.rfft(song, n) * np.conj(np.fft.rfft(seg0, n)), n)[: len(song) - len(seg) + 1]
    cs = np.concatenate([[0], np.cumsum(song)])
    cs2 = np.concatenate([[0], np.cumsum(song ** 2)])
    m = len(seg)
    var = (cs2[m:] - cs2[:-m]) - (cs[m:] - cs[:-m]) ** 2 / m
    r = cc / np.sqrt(np.maximum(var, 1e-12) * np.sum(seg0 ** 2))
    k = int(np.argmax(r))
    r2 = r.copy()
    r2[max(0, k - SR): k + SR] = -1
    return k / SR, float(r[k]), float(r2.max())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("song", help="The original full song (mp3/wav/m4a...)")
    ap.add_argument("segments", nargs="+", help="Segment videos, or a folder of them (order is detected from the song)")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--height", type=int, help="Scale output to this height (default: size of the first segment)")
    ap.add_argument("--crf", type=int, default=17, help="x264 quality, lower = better (default 17)")
    ap.add_argument("--preset", default="fast", help="x264 preset (default fast)")
    ap.add_argument("--fade-out", type=float, default=0.5, help="Seconds of audio fade-out at the end (0 = none)")
    ap.add_argument("--max-gap", type=float, default=2.0,
                    help="Largest gap between segments (seconds) that is bridged automatically (default 2.0)")
    ap.add_argument("--allow-large-gaps", action="store_true", help="Bridge gaps larger than --max-gap anyway")
    ap.add_argument("--min-corr", type=float, default=0.5, help="Minimum audio match to accept a segment (default 0.5)")
    ap.add_argument("--dry-run", action="store_true", help="Only show where each segment sits and the plan")
    ap.add_argument("--keep-temp", action="store_true")
    args = ap.parse_args()

    # ---- collect segments
    files = []
    for item in args.segments:
        p = Path(item)
        if p.is_dir():
            files += sorted((f for f in p.iterdir() if f.suffix.lower() in VIDEO_EXTS), key=natural_key)
        elif p.is_file():
            files.append(p)
        else:
            sys.exit(f"Not found: {item}")
    if not files:
        sys.exit("No segments given.")
    given_order = list(files)

    infos = [probe(f) for f in files]
    fps = infos[0]["fps"]
    fps_expr = infos[0]["fps_expr"]
    W, H = infos[0]["w"], infos[0]["h"]
    if args.height:
        W = round(W * args.height / H / 2) * 2
        H = args.height
    W, H = W - W % 2, H - H % 2

    # ---- locate every segment in the song
    print("Reading song and locating segments (audio match)...")
    song = decode_mono(Path(args.song))
    print(f"Song length: {len(song) / SR:.2f}s")
    for info in infos:
        if not info["has_audio"]:
            sys.exit(f"{info['path'].name} has no audio, so it cannot be located in the song.")
        start, corr, second = locate(song, decode_mono(info["path"]))
        if corr < args.min_corr:
            sys.exit(f"Could not find {info['path'].name} in the song (match {corr:.2f}). Is it from this song?")
        info["start"], info["corr"], info["second"] = start, corr, second
        if second > 0.8 * corr:
            print(f"  warning: {info['path'].name} also matches another place in the song "
                  f"({second:.2f} vs {corr:.2f}) - repetitive music? check the result.")

    infos.sort(key=lambda i: i["start"])
    if [i["path"] for i in infos] != given_order:
        print("  note: detected song order differs from the order of the files you gave. Using the detected order.")

    # ---- plan the timeline (frame-exact, errors never accumulate)
    t0 = infos[0]["start"]
    plan, pos = [], 0
    for n, info in enumerate(infos):
        tgt = round((info["start"] - t0) * fps)
        skip = 0
        if n > 0:
            gap = tgt - pos
            gap_s = gap / fps
            if gap > 0:
                if gap_s > args.max_gap and not args.allow_large_gaps:
                    sys.exit(f"{infos[n-1]['path'].name} -> {info['path'].name}: {gap_s:.2f}s of the song has no video "
                             f"(song {tgt / fps + t0 - gap_s:.1f}s-{tgt / fps + t0:.1f}s). Missing segments? "
                             f"Use --allow-large-gaps to bridge it anyway.")
                plan.append({"kind": "bridge", "frames": gap, "before": n - 1, "after": n})
                pos += gap
            elif gap < 0:
                skip = min(-gap, info["frames"] - 1)
        info["skip"] = skip
        plan.append({"kind": "seg", "idx": n})
        pos += info["frames"] - skip
    total_frames = pos
    total_s = total_frames / fps

    print(f"\nOutput: {W}x{H} @ {fps:g} fps, {total_s:.2f}s, song {t0:.2f}s -> {t0 + total_s:.2f}s")
    print(" #  file                           song start   frames  corr   note")
    for n, info in enumerate(infos):
        note = []
        if info["skip"]:
            note.append(f"overlap, first {info['skip']} frames trimmed")
        b = next((p for p in plan if p["kind"] == "bridge" and p["after"] == n), None)
        if b:
            note.append(f"{b['frames']}-frame dissolve ({b['frames'] / fps:.3f}s) before it")
        print(f" {n + 1:<2d} {info['path'].name[:30]:<30s} {info['start']:9.3f}s  {info['frames']:6d}  {info['corr']:.3f}  {'; '.join(note)}")
    if args.dry_run:
        return

    # ---- build bridges (lossless, one at a time to keep memory low)
    norm = (f"fps={fps_expr},scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p")
    tmp = Path(tempfile.mkdtemp(prefix="musicvideo_"))
    try:
        def grab(info, frame_idx, out):
            run(["ffmpeg", "-v", "error", "-y", "-i", str(info["path"]),
                 "-vf", f"{norm},select=eq(n\\,{frame_idx})", "-frames:v", "1", "-c:v", "ffv1", str(out)])

        for bi, b in enumerate(p for p in plan if p["kind"] == "bridge"):
            a, c = infos[b["before"]], infos[b["after"]]
            fa, fb, out = tmp / f"a{bi}.mkv", tmp / f"b{bi}.mkv", tmp / f"bridge{bi}.mkv"
            grab(a, a["frames"] - 1, fa)
            grab(c, c["skip"], fb)
            g = b["frames"]
            print(f"  building bridge {bi + 1}: {a['path'].name} -> {c['path'].name} ({g} frames)")
            run(["ffmpeg", "-v", "error", "-y", "-i", str(fa), "-i", str(fb), "-filter_complex",
                 f"[0:v]loop=loop={g + 1}:size=1,setpts=N/({fps_expr})/TB[a];"
                 f"[1:v]loop=loop={g + 1}:size=1,setpts=N/({fps_expr})/TB[b];"
                 f"[a][b]blend=all_expr='A*(1-(N+1)/{g + 1})+B*(N+1)/{g + 1}',format=yuv420p",
                 "-frames:v", str(g), "-r", fps_expr, "-c:v", "ffv1", str(out)])
            b["file"] = out
            fa.unlink(); fb.unlink()

        # ---- final encode
        cmd = ["ffmpeg", "-hide_banner", "-y"]
        labels, graph, idx = "", [], 0
        for p in plan:
            if p["kind"] == "seg":
                info = infos[p["idx"]]
                cmd += ["-i", str(info["path"])]
                trim = (f",trim=start_frame={info['skip']},setpts=PTS-STARTPTS" if info["skip"] else "")
                graph.append(f"[{idx}:v]{norm}{trim}[v{idx}]")
            else:
                cmd += ["-i", str(p["file"])]
                graph.append(f"[{idx}:v]format=yuv420p[v{idx}]")
            labels += f"[v{idx}]"
            idx += 1
        cmd += ["-i", args.song]
        fade = (f",afade=t=out:st={max(total_s - args.fade_out, 0):.3f}:d={args.fade_out}" if args.fade_out > 0 else "")
        graph.append(f"{labels}concat=n={idx}:v=1:a=0,setpts=N/({fps_expr})/TB[v]")
        graph.append(f"[{idx}:a]atrim=start={t0:.6f}:end={t0 + total_s:.6f},asetpts=PTS-STARTPTS{fade},aresample=48000[a]")
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        cmd += ["-filter_complex", ";".join(graph), "-map", "[v]", "-map", "[a]", "-r", fps_expr,
                "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf), "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-t", f"{total_s:.6f}", str(out)]
        print("\nEncoding...")
        run(cmd)
    finally:
        if args.keep_temp:
            print(f"Temp files kept in {tmp}")
        else:
            shutil.rmtree(tmp, ignore_errors=True)

    final = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
         "stream=nb_read_frames,duration", "-of", "json", str(out)], check=True, capture_output=True, text=True).stdout)["streams"][0]
    print(f"\nDone: {out}  ({final['nb_read_frames']} frames, expected {total_frames}, {float(final['duration']):.3f}s)")


if __name__ == "__main__":
    main()
