"""Render a short coffee-shop commercial as an MP4 — no paid AI credits needed.

Four scenes (steaming cup, falling beans, latte art, end card) are drawn frame
by frame with Pillow, scored with a synthesized warm chord pad, and encoded
with the ffmpeg binary bundled in imageio-ffmpeg.

    pip install pillow numpy imageio-ffmpeg
    python video/coffee_ad.py --name "קפה השכונה" --hours "פתוח כל יום מ-7:00 עד 20:00"
"""

import argparse
import math
import os
import random
import subprocess
import tempfile
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, features

W, H, FPS = 1280, 720, 30
SCENE_SECONDS = 3.0
SCENES = 4
DURATION = SCENE_SECONDS * SCENES

CREAM = (245, 230, 208)
FOAM = (250, 242, 228)
COFFEE = (92, 52, 28)
ESPRESSO = (58, 32, 18)
GOLD = (222, 170, 92)
CUP = (248, 246, 242)
CUP_SHADE = (214, 206, 196)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]
RTL_SHAPING = features.check("raqm")


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def gradient(top, bottom):
    ramp = np.linspace(0, 1, H)[:, None, None]
    img = np.array(top) * (1 - ramp) + np.array(bottom) * ramp
    img = np.broadcast_to(img, (H, W, 3))
    # Warm vignette so the centre glows.
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    img = img * (1.15 - 0.6 * d[..., None])
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


BACKGROUNDS = [
    gradient((70, 40, 22), (24, 12, 6)),
    gradient((48, 28, 16), (16, 8, 4)),
    gradient((88, 56, 34), (30, 16, 8)),
    gradient((120, 76, 42), (40, 22, 10)),
]


def draw_text(img, text, y, size, alpha, color=CREAM):
    """Centered, fading, right-to-left aware text with a soft shadow."""
    if alpha <= 0:
        return
    font = load_font(size)
    kwargs = {"direction": "rtl"} if RTL_SHAPING else {}
    if not RTL_SHAPING and any("\u0590" <= c <= "\u05ff" for c in text):
        text = text[::-1]
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    box = d.textbbox((0, 0), text, font=font, **kwargs)
    x = (W - (box[2] - box[0])) / 2 - box[0]
    a = int(255 * alpha)
    d.text((x + 3, y + 3), text, font=font, fill=(0, 0, 0, a // 2), **kwargs)
    d.text((x, y), text, font=font, fill=color + (a,), **kwargs)
    img.alpha_composite(layer)


def text_alpha(local):
    """Fade in over 0.6s, hold, fade out in the last 0.4s of a scene."""
    return ease(local / 0.6) * (1 - ease((local - (SCENE_SECONDS - 0.4)) / 0.4))


def draw_cup(d, cx, cy, s, fill=COFFEE):
    d.ellipse((cx - 190 * s, cy + 70 * s, cx + 190 * s, cy + 130 * s), fill=CUP_SHADE)
    d.ellipse((cx - 170 * s, cy + 60 * s, cx + 170 * s, cy + 115 * s), fill=CUP)
    d.ellipse((cx + 95 * s, cy - 40 * s, cx + 175 * s, cy + 40 * s), outline=CUP, width=int(18 * s))
    d.chord((cx - 120 * s, cy - 150 * s, cx + 120 * s, cy + 90 * s), 0, 180, fill=CUP)
    d.rectangle((cx - 120 * s, cy - 40 * s, cx + 120 * s, cy - 30 * s), fill=CUP)
    d.ellipse((cx - 120 * s, cy - 60 * s, cx + 120 * s, cy - 10 * s), fill=CUP_SHADE)
    d.ellipse((cx - 108 * s, cy - 54 * s, cx + 108 * s, cy - 16 * s), fill=fill)


def scene_cup(img, local, t):
    d = ImageDraw.Draw(img)
    s = 1.0 + 0.05 * ease(local / SCENE_SECONDS)
    cx, cy = W / 2, H / 2 + 110
    draw_cup(d, cx, cy, s)
    steam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(steam)
    for k in range(3):
        pts = []
        for i in range(40):
            v = i / 39
            x = cx + (k - 1) * 60 * s + 14 * v * math.sin(v * 6 + t * 2.4 + k)
            y = cy - 70 * s - v * 230
            pts.append((x, y))
        sd.line(pts, fill=(255, 255, 255, 70), width=14, joint="curve")
    img.alpha_composite(steam.filter(ImageFilter.GaussianBlur(9)))
    draw_text(img, "בוקר טוב מתחיל כאן", 70, 64, text_alpha(local))


random.seed(7)
BEANS = [
    (random.uniform(60, W - 60), random.uniform(-900, -40), random.uniform(0.6, 1.3),
     random.uniform(0, 6.28), random.uniform(-2, 2), random.uniform(220, 320))
    for _ in range(38)
]


def draw_bean(img, x, y, scale, angle):
    bw, bh = int(70 * scale), int(48 * scale)
    bean = Image.new("RGBA", (bw + 8, bh + 8), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bean)
    bd.ellipse((4, 4, bw + 4, bh + 4), fill=(110, 62, 30, 255))
    bd.ellipse((10, 8, bw - 6, bh - 6), fill=(132, 78, 40, 255))
    bd.arc((bw * 0.15, bh * 0.1, bw * 0.95, bh * 1.2), 200, 340, fill=(52, 28, 12, 255), width=max(2, int(5 * scale)))
    bean = bean.rotate(math.degrees(angle), resample=Image.BICUBIC, expand=True)
    img.alpha_composite(bean, (int(x - bean.width / 2), int(y - bean.height / 2)))


def scene_beans(img, local, t):
    for x, y0, sc, a0, spin, speed in BEANS:
        y = y0 + speed * local * 1.6
        if -80 < y < H + 80:
            draw_bean(img, x, y, sc, a0 + spin * local)
    draw_text(img, "פולים קלויים טריים, כל יום", H / 2 - 50, 60, text_alpha(local))


def scene_latte(img, local, t):
    d = ImageDraw.Draw(img)
    cx, cy, r = W / 2, H / 2 + 60, 210
    d.ellipse((cx - r - 40, cy - r - 40, cx + r + 40, cy + r + 40), fill=CUP_SHADE)
    d.ellipse((cx - r - 28, cy - r - 28, cx + r + 28, cy + r + 28), fill=CUP)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(150, 92, 48))
    # Pour: a white heart grows out of the centre.
    g = ease((local - 0.3) / 2.0)
    if g > 0:
        hs = 150 * g
        heart = [
            (cx + hs * 16 * math.sin(u) ** 3 / 16,
             cy - hs * (13 * math.cos(u) - 5 * math.cos(2 * u) - 2 * math.cos(3 * u) - math.cos(4 * u)) / 16)
            for u in np.linspace(0, 2 * math.pi, 120)
        ]
        d.polygon(heart, fill=FOAM)
    ring = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((cx - r, cy - r, cx + r, cy + r), outline=(90, 50, 24, 160), width=18)
    img.alpha_composite(ring.filter(ImageFilter.GaussianBlur(6)))
    draw_text(img, "כל כוס — עשויה באהבה", 40, 60, text_alpha(local))


def scene_endcard(img, local, t, name, hours):
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    r = 260 + 20 * math.sin(t * 2)
    ImageDraw.Draw(glow).ellipse((W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r), fill=GOLD + (60,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(80)))
    a = ease(local / 0.7)
    draw_text(img, name, 230, 96, a, GOLD)
    draw_text(img, "קפה. מאפה. רגע של שקט.", 370, 46, ease((local - 0.5) / 0.7))
    draw_text(img, hours, 450, 38, ease((local - 1.0) / 0.7))


def render_frame(i, name, hours):
    t = i / FPS
    scene = min(int(t // SCENE_SECONDS), SCENES - 1)
    local = t - scene * SCENE_SECONDS
    img = BACKGROUNDS[scene].convert("RGBA")
    if scene == 0:
        scene_cup(img, local, t)
    elif scene == 1:
        scene_beans(img, local, t)
    elif scene == 2:
        scene_latte(img, local, t)
    else:
        scene_endcard(img, local, t, name, hours)
    # Dip to black between scenes and at both ends.
    fade = min(ease(local / 0.25), ease((SCENE_SECONDS - local) / 0.25) if scene < SCENES - 1 else 1.0)
    fade = min(fade, ease(t / 0.5), ease((DURATION - t) / 0.8))
    frame = np.asarray(img.convert("RGB"), dtype=np.float32) * fade
    return frame.astype(np.uint8)


def write_music(path, seconds, rate=44100):
    """Warm major-seventh pad (Cmaj7 → Am7 → Fmaj7 → G6) with a soft pulse."""
    chords = [(261.6, 329.6, 392.0, 493.9), (220.0, 261.6, 329.6, 392.0),
              (174.6, 220.0, 261.6, 329.6), (196.0, 246.9, 293.7, 329.6)]
    t = np.arange(int(seconds * rate)) / rate
    out = np.zeros_like(t)
    for n, chord in enumerate(chords):
        start, end = n * SCENE_SECONDS, (n + 1) * SCENE_SECONDS + 0.4
        env = np.clip((t - start) / 0.4, 0, 1) * np.clip((end - t) / 0.4, 0, 1)
        for f in chord:
            out += env * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t))
        bass = chord[0] / 2
        pulse = np.exp(-((t - start) % 0.75) * 5) * (t >= start) * (t < end)
        out += 1.4 * pulse * np.sin(2 * np.pi * bass * t)
    out *= np.clip(t / 0.5, 0, 1) * np.clip((seconds - t) / 1.0, 0, 1)
    out = (out / np.abs(out).max() * 0.6 * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(out.tobytes())


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--name", default="קפה השכונה", help="Cafe name for the end card")
    p.add_argument("--hours", default="פתוח כל יום מ-7:00 עד 20:00", help="Tagline under the name")
    p.add_argument("--out", default="output/coffee_shop_ad.mp4")
    args = p.parse_args()

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        audio = os.path.join(tmp, "music.wav")
        silent = os.path.join(tmp, "video.mp4")
        write_music(audio, DURATION)
        writer = imageio_ffmpeg.write_frames(silent, (W, H), fps=FPS, codec="libx264",
                                             quality=8, macro_block_size=16)
        writer.send(None)
        for i in range(int(DURATION * FPS)):
            writer.send(render_frame(i, args.name, args.hours))
        writer.close()
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error",
                        "-i", silent, "-i", audio, "-c:v", "copy", "-c:a", "aac",
                        "-b:a", "160k", "-shortest", "-movflags", "+faststart", args.out],
                       check=True)
    print(f"Wrote {args.out} ({DURATION:.0f}s, {W}x{H}@{FPS}fps)")


if __name__ == "__main__":
    main()
