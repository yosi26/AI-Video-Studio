---
workflow: product-launch-video
flow: automation
storyboard: no
message: "תהפכו רעיון לסרט קולנועי — מטקסט או מתמונה"
destination: youtube
aspect: 1920x1080
language: he
length: 24s
angle: idea-to-film
---

## Intent

Short promo for **AI Video Studio** ("AI video generator — create cinematic videos
from text and images", per the repo README). The user asked for a promo of their
Netlify site, which this environment could not reach; they then said "make whatever
you want", so the subject is the AI Video Studio product itself. Tone: confident,
cinematic, modern.

## Notes

- No capture: the site host is blocked by the environment's network policy (no-capture mode).
- Silent: HeyGen TTS/BGM API is unreachable and no local engines are installed (`music: none`, no SCRIPT.md).
- GSAP and Heebo (Hebrew) fonts are vendored locally because the CDN is blocked.
- Hebrew copy, right-to-left. Make no claims beyond "cinematic videos from text and images".
