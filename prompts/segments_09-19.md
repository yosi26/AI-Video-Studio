# Prompts for segments 9-19 — "אין ייאוש בעולם" — LTX 2.5 Fast (console.ltx.io)

Segment N = song seconds (N-1)*10 to N*10 (segment 19 = 180 -> 187.6 s). Vocal timings come from the Suno lyric
alignment of the song.

## Rules these prompts follow (important: no budget for retakes)

- **The reference image is the first frame.** In Image/Audio -> Video the image already fixes the man, outfit, colours,
  lighting and style, so the prompt does NOT re-describe the scene (re-describing it is the most common cause of drift).
  The prompt describes only what changes: movement, action, camera, sound.
- **Every prompt must match its first frame.** If a clip starts silent, the reference shows a closed mouth.
- One continuous take per clip. Camera movement is written in the prompt; leave the "Camera Motion" menu on None.
- In audio-to-video the model builds the lip-sync around the audio you supply and the audio sets the clip length.
- Sources of these rules: LTX/Runware/fal prompting guides (summaries; the official pages could not be opened from this environment).

## Settings per clip

| Clips | Console page | Inputs |
|---|---|---|
| 9, 10, 11, 12, 13, 14, 15, 17 | Audio -> Video | audio = `segment_NN.mp3`, start image = that clip's reference, the prompt below |
| 16, 18 | Image -> Video | First frame = reference, Duration 10 s |
| 19 | Image -> Video | First frame = reference, Last frame = `loop_end_frame_seg1_first.jpg`, Duration 8 s (the build tool cuts it at the end of the song) |

Model LTX-2.5 Fast, 16:9, 24 fps, Camera Motion None. Resolution 1080p (about $0.13/s; 4K is about $0.30/s).
Generate Audio can be Off in Image -> Video (the final soundtrack is the original song).

Song map: intro 0-13 instrumental | whispered intro 13-33 | instrumental 33-52 | verse 1 rap 52.6-65.7 |
chant 66.5-78.4 | chorus 81-91.6 | instrumental 91.6-108.5 | verse 2 108.5-115.6 | build-up 115.8-122.1 |
final chorus 122.7-136.6 | outro 136.6-142.4 | instrumental 142-164 | "אני כאן" 163.8-169 | instrumental to 187.6.

---

## 9 · 80-90 s · Chorus opens — "איי איי איי… תן לי לעוף…"
**Vocal timing in the clip:** quiet until 1.0 s · short "אי" 1.0-1.4 s · "איי איי איי… תן לי לעוף" 2.4-4.7 s · instrumental pause 4.7-8.0 s · "איי איי איי…" again from 8.0 s to the end.
**Reference image (first frame):** the man on a rocky mountain peak above a sea of golden clouds at sunrise, eyes closed, calm face, mouth closed, arms relaxed at his sides, medium shot, slight low angle.
**Prompt:**
```
He stands still for a moment, a light breeze moving his jacket. He opens his eyes, lifts his face to the sky and begins to sing, lips matching the vocal: first a short note, then a flowing melodic phrase as his chest opens and his arms slowly spread wide. In the instrumental pause his mouth closes, a soft smile appears and glowing golden-violet particles drift upward around him while his feet lift very slightly off the rock. When the vocal returns he sings again with a joyful, bright expression, head tilted up. Camera: slow dolly in, then a gentle tilt up. Single continuous shot. Audio: the provided song, melodic vocal "ay-ay-ay… let me fly", soft wind.
```

## 10 · 90-100 s · "…לראות את הטוב" then instrumental
**Vocal timing:** held note until 0.25 s · "לראות את הטוב" 0.27-1.64 s · then instrumental only.
**Reference image:** the man on the same peak, low angle, face lifted to the sky, arms slightly open, mouth slightly open mid-note, golden particles floating around him.
**Prompt:**
```
He holds the last note and finishes the line "to see the good" with a gentle smile, then his mouth closes and he stays silent. His arms open wider and he rises slowly off the peak, floating upward, calm and peaceful. Camera: pulls back and cranes up into a wide aerial view of the endless sea of clouds glowing gold and violet, the first stars appearing in the deepening sky, until he becomes a small figure in the luminous sky. Single continuous shot. Audio: the provided song, one short sung line at the very start, then instrumental music only.
```

## 11 · 100-110 s · Instrumental, verse 2 begins at 8.5 s — "נופל וקם, שוב מתחיל"
**Vocal timing:** instrumental until 8.5 s · rap from 8.5 s to the end.
**Reference image:** the man in a narrow stone alley of Jerusalem's Old City at dusk, hanging lanterns glowing, walking toward the camera, calm expression, mouth closed, violet mist along the ground.
**Prompt:**
```
He walks calmly toward the camera along the alley, the hanging lanterns flickering warmly on the stone walls and violet mist drifting along the ground, his mouth closed through the instrumental music. In the last second and a half he slows, looks into the camera and begins to rap quietly, low and hypnotic, lips matching the vocal. Camera: slow steady tracking shot backing away in front of him. Single continuous shot. Audio: the provided song, instrumental until the first rap line at the very end.
```

## 12 · 110-120 s · Verse 2 then the build-up — "אור… אור… אור…"
**Vocal timing:** rap 0.4-5.6 s ("קול קטן בתוכי מוביל" 0.4-2.0 · "מעל הזמן" 2.1-3.9 · "רק אתה יודע את הכול" 3.9-5.6) · whispered "אור… אור…" 5.8-10 s.
**Reference image:** medium close-up of the man in the lantern-lit stone alley, intense hypnotic gaze into the camera, mouth slightly open as if rapping, headphones around his neck.
**Prompt:**
```
He raps in a minimal rhythmic flow straight to the camera, lips matching the vocal. On the line about falling and getting up again his shoulders drop and he sways as if stumbling, then he straightens with determination. Behind him glowing clock-like rings and star trails slowly rotate in the air as he sings "above time". Then his voice softens to a whispered mantra, "light… light…", and a warm golden glow grows from his chest and open palms, brighter and brighter. Camera: slow dolly in. Single continuous shot. Audio: the provided song, low rap vocal, then a whispered chant over a building pulse.
```

## 13 · 120-130 s · "תן לי אמונה" then FINAL CHORUS — "אין ייאוש בעולם!"
**Vocal timing:** "אור" 0-0.8 s · "תן לי אמונה" 0.9-2.1 s · pause · "אין ייאוש בעולם!" 2.7-5.75 s · pause 5.75-7.85 s · "אין ייאוש בעולם!" 7.85-9.5 s · third shout starts at 9.76 s.
**Reference image:** the man in the same alley with arms slightly open and palms glowing with golden light, a golden glow around his chest, intense eyes, lanterns brighter than before.
**Prompt:**
```
He whispers the last words of the build-up, the glow at its maximum. At the downbeat of the chorus a burst of golden-violet light explodes outward from him, the lanterns flare and psychedelic fractal rings ripple through the stone walls. He sings with full power, lips matching the vocal, arms thrown wide, and the energy gathers into a column of light rising to the sky. In the pause between the shouts he holds still, chest heaving, the light pulsing around him. Camera: a quick snap zoom in on the explosion, then a slow dynamic orbit around him. Single continuous shot. Audio: the provided song, whispered build-up, then the explosive chorus vocal "there is no despair in the world".
```

## 14 · 130-140 s · Peak — "אין ייאוש בעולם!… תאיר לי את העולם!" then calm
**Vocal timing:** third "אין ייאוש בעולם!" 0-2.2 s · "רבי נחמן… תאיר לי את העולם!" 2.6-6.6 s · "אור…" 6.6-7.2 s · then silence.
**Reference image:** the man small in the foreground on a rooftop terrace overlooking Jerusalem's Old City at night, three-quarter front view with his face visible, face lifted to the sky, arms beginning to rise.
**Prompt:**
```
He sings with full emotion, lips matching the vocal, his arms rising wide toward the sky as a huge column of light rises from the Old City behind him into the night sky and blooms into a radiant spiral galaxy of gold and violet. On the final line, "light up the world for me", his arms open fully. Then his arms lower with palms open to the sky, tears of joy and a soft smile, his mouth closing, as the light settles into slowly floating golden particles. Camera: crane up past the rooftops, then a slow pull back. Single continuous shot. No other person appears. Audio: the provided song, the chorus vocal reaching its peak, then fading to a calm echo.
```

## 15 · 140-150 s · Outro echoes
**Vocal timing:** a single whispered "אור" at 1.9-2.4 s · otherwise instrumental.
**Reference image:** the man sitting on an ancient stone city wall above Jerusalem at night, three-quarter view, eyes closed, calm, mouth closed, the moon over the domes behind him.
**Prompt:**
```
He breathes slowly with his eyes closed, soft particles of light floating around him. Once, at about two seconds, he whispers a single word, "light", barely moving his lips. The moon rises slowly over the domes and violet mist drifts by. Camera: very slow orbit around him. Single continuous shot. Audio: the provided song, one whispered word, soft echoing pads, quiet wind.
```

## 16 · 150-160 s · Instrumental — Image -> Video
**Reference image (first frame):** `loop_end_frame_seg1_first.jpg` (Jerusalem at night, full moon, violet mist, arch with lantern at the left). No man.
**Prompt:**
```
A slow cinematic glide forward over Jerusalem at night, no people. Violet mist drifts across the walls, the city lights twinkle softly and slow clouds pass across the full moon. Camera: slow dolly forward, drifting toward the glowing stone archway with the hanging lantern on the left, the lantern flame flickering gently. Single continuous shot. Audio: ambient instrumental music.
```

## 17 · 160-170 s · "אני כאן…"
**Vocal timing:** silent until 3.8 s · "אני כ…" 3.85-5.25 s · pause · "…אן" 7.4-9.1 s (one long whispered "I'm here" with a pause in the middle).
**Reference image:** the man standing inside the lantern-lit stone arch, looking into the camera with a warm calm smile, mouth closed, hand at his side.
**Prompt:**
```
He stands silent, looking into the camera with a warm calm smile, lantern light flickering on his face. He slowly reaches his open hand toward the camera in a welcoming gesture. At the whispered vocal he softly says "I'm here" in two parts, lips matching the vocal: "I'm he—", a pause, then "—re…", slow and breathy, and finishes with a gentle smile. Camera: static with a very slow dolly in. Single continuous shot. Audio: the provided song, ethereal echo and the whispered vocal.
```

## 18 · 170-180 s · Instrumental — Image -> Video
**Reference image:** the man in the lantern-lit arch, side view, hand just lowered, head turning away toward the alley, mouth closed.
**Prompt:**
```
He lowers his hand, turns fully and walks slowly away through the glowing archway into the alley, lantern light flickering on the stones. The camera slowly pulls back and rises to reveal the Jerusalem skyline under the full moon, violet mist swirling and city lights twinkling, while his figure becomes small and fades into the warm glow. Single continuous shot. Audio: instrumental music only, no singing.
```

## 19 · 180-187.6 s · Final shot, closes the loop — Image -> Video, First frame + Last frame
**First frame:** a slightly wider, different-angle view of Jerusalem at night with a full moon and violet mist, same style as the opening shot. No man.
**Last frame:** `loop_end_frame_seg1_first.jpg`.
**Prompt:**
```
A peaceful wide shot of Jerusalem at night: violet mist drifts, the city lights twinkle and the moon glows behind slow clouds. The camera drifts almost imperceptibly and settles into the final frame. Single continuous shot. Audio: ambient instrumental fade.
```

---

When the clips are ready:
`python3 tools/build_music_video.py song.mp3 segments/ -o out.mp4 --height 1080`
