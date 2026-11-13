# Prompts for segments 9-19 — "אין ייאוש בעולם" — written for LTX 2.5 Fast

Segment N = song seconds (N-1)*10 to N*10 (segment 19 = 180 -> 187.6 s). Timings come from the Suno lyric
alignment of the song.

Song map: intro 0-13 instrumental | whispered intro 13-33 | instrumental 33-52 | verse 1 rap 52.6-65.7 |
chant 66.5-78.4 | chorus 81-91.6 | instrumental 91.6-108.5 | verse 2 108.5-115.6 | build-up 115.8-122.1 |
final chorus 122.7-136.6 | outro 136.6-142.4 | instrumental 142-164 | "אני כאן" 163.8-169 | instrumental to 187.6.

## How to run each clip on LTX 2.5 Fast

- **Clips with singing (9, 10, 11, 12, 13, 14, 15, 17)**: audio-to-video. Audio = that song window (cut exactly like
  clips 1-8), start image = that clip's own reference image of the character in that scene (see "Reference image" under each clip). In audio-to-video the clip length follows the audio.
- **Fully instrumental clips (16, 18, 19)**: image-to-video with a start image (the sound is replaced by the original
  song when the video is assembled, so the generated audio does not matter).
- **Clip 19**: image-to-video with its own wide Jerusalem reference as the start image and END image =
  `loop_end_frame_seg1_first.jpg` (first frame of segment 1), so the video loops. Ask for 8 s; the build tool cuts it
  at the end of the song (187.6 s).
- **Clip 16**: start image = `loop_end_frame_seg1_first.jpg` (same Jerusalem night view).
- **References**: every clip needs its own reference image with the character (your face reference attached), made in the same look as the earlier ones. Each prompt's opening matches its reference.
- **Why the 0.3 s gaps happened (hypothesis)**: LTX frame counts must be 8n+1. 10 s at 24 fps = 240 frames, so the
  nearest valid count is 233 frames = 9.708 s — exactly what segments 1-8 have. Try cutting the audio window 10.05 s
  long (second (N-1)*10 to N*10 + 0.05) so the model makes 241 frames = 10.04 s. The build tool trims any overlap.
- Prompt format: one flowing paragraph, present tense, in order of what happens, no timestamps, camera movement
  described separately from the subject's movement, and the sound described at the end.
- Negative prompt (if available): text, subtitles, watermark, extra people, distorted hands, flicker.

---

## 9 · 80-90 s · Chorus opens — "איי איי איי… תן לי לעוף…" (new location: mountain peak above the clouds)
**Reference image:** the man on a rocky mountain peak above a sea of golden clouds at sunrise, reaching his open hand toward the camera with a warm smile, headphones around his neck.
Medium shot of the man from the image standing on a rocky peak high above a sea of glowing golden clouds at sunrise, warm light and soft violet haze around him, a breeze moving his jacket. He starts with his eyes closed, then lifts his face to the sky and sings melodically along with the music, his chest opening as his arms slowly spread wide. In a quiet moment his mouth closes while glowing golden-violet particles begin to rise around him and his boots barely lift off the rock, then he sings again with a joyful smile, head tilted up. Camera: slow dolly in, then a gentle tilt up. Cinematic, ultra-detailed, saturated gold and violet light, painterly photoreal look. Audio: the song's melodic vocal and soft wind, his lip movements follow the vocal.

## 10 · 90-100 s · "…לראות את הטוב" then instrumental
**Reference image:** the man standing on the same peak, low angle, face lifted toward the sky, arms slightly open, a few golden particles floating around him.
Medium shot of the man from the image above the golden clouds. He finishes a sung line with a gentle smile, then closes his mouth and stays silent as he rises off the peak and floats upward with open arms and a peaceful expression. Camera: pull back and jib up into a wide aerial view of the endless sea of clouds lit gold and violet, the first stars appearing in a deepening sky, until he is a small figure in a luminous sky. Cinematic, ultra-detailed, saturated gold and violet light. Audio: one short sung line at the start, then instrumental music only, his mouth stays closed.

## 11 · 100-110 s · Instrumental, verse 2 starts at the very end — "נופל וקם, שוב מתחיל"
**Reference image:** the man in a narrow stone alley of Jerusalem's Old City at dusk, hanging lanterns glowing, walking toward the camera, calm expression, mouth closed.
Wide aerial shot gliding over Jerusalem's Old City at dusk, golden stone walls, glowing domes, hanging lanterns and violet mist. The man descends gently into a narrow stone alley lit by lanterns, lands softly and walks calmly toward the camera with his mouth closed. In the final moment he begins to rap quietly to the camera, low and hypnotic. Camera: smooth aerial descent that settles into a steady tracking shot in front of him. Cinematic, ultra-detailed, golden and violet light. Audio: instrumental music and soft ambience, the first rap line only at the very end, lip-synced.

## 12 · 110-120 s · Verse 2 then the build-up — "אור… אור… אור…"
**Reference image:** medium close-up of the man in the lantern-lit stone alley, intense hypnotic gaze into the camera, mouth slightly open as if rapping, headphones around his neck.
Medium close-up of the man from the image in the narrow lantern-lit stone alley, intimate and hypnotic. He raps in a minimal rhythmic flow, lip-synced to the vocal; as the lyric says he falls and gets up again, he stumbles, drops to one knee on the stones and rises with determination. Behind him glowing clock-like rings and star trails slowly rotate in the air. Then he whispers a repeated mantra, "light… light… light…", while a golden glow grows from his chest and open palms, brighter and brighter. Camera: slow dolly in. Cinematic, golden and violet light. Audio: low rap vocal, then a whispered chant over a building pulse.

## 13 · 120-130 s · "תן לי אמונה" then the FINAL CHORUS — "אין ייאוש בעולם!"
**Reference image:** the man in the same alley with arms slightly open and palms glowing with golden light, a golden glow around his chest, intense eyes, lanterns brighter than before.
The man from the image stands in the lantern-lit stone alley, whispering the last words of the build-up while his glow is at its maximum. Then a burst of golden-violet light explodes outward from him, the lanterns flare and psychedelic fractal rings ripple through the stone walls. He sings powerfully in time with the chant, arms thrown wide, as the energy gathers into a column of light rising to the sky. Camera: a quick snap zoom in on the explosion, then a dynamic orbit around him. Cinematic, ultra-detailed, explosive gold and violet light. Audio: the explosive chorus vocal and rhythmic chant, lip-synced.

## 14 · 130-140 s · Peak — "אין ייאוש בעולם!… תאיר לי את העולם!" then calm
**Reference image:** the man small in the foreground on a rooftop terrace overlooking Jerusalem's Old City at night, seen slightly from behind and the side, face lifted to the sky, arms beginning to rise.
The camera cranes up past the Old City rooftops as a huge column of light rises into the night sky and blooms into a radiant spiral galaxy of gold and violet. The man from the image, small in the foreground on a rooftop terrace, sings with full emotion in time with the vocal, then lowers his arms, palms open to the sky, with tears of joy and a soft smile, his mouth closing. The light settles into slowly floating golden particles. No other person appears. Camera: crane up, then a slow pull back. Cinematic, ultra-detailed, gold and violet. Audio: the final chorus vocal reaching its peak, then fading to a calm echo.

## 15 · 140-150 s · Outro echoes
**Reference image:** the man sitting on an ancient stone city wall above Jerusalem at night, three-quarter view, eyes closed, calm, the moon over the domes behind him.
The man from the image sits on the ancient city wall above Jerusalem at night, seen in three-quarter view, eyes closed, breathing slowly, soft particles of light floating around him. Once, he softly whispers a single word, "light". Camera: slow orbit around him as the moon rises over the domes and violet mist drifts by. Peaceful, echoing atmosphere, cinematic violet and gold light. Audio: soft echoing pads, quiet wind, one whispered word.

## 16 · 150-160 s · Instrumental (image-to-video, start image = loop frame)
**Reference image:** no man. Jerusalem at night with a full moon and violet mist: use `loop_end_frame_seg1_first.jpg`.
Slow cinematic glide over Jerusalem at night, no people: lit stone walls, golden domes, cypress trees, violet mist, a full moon in a dramatic purple-clouded sky, a glowing stone archway with a hanging lantern at the left. Camera: slow dolly forward, drifting toward the glowing archway. Cinematic, ultra-detailed, golden and violet light. Audio: instrumental ambient music only.

## 17 · 160-170 s · "אני כאן…"
**Reference image:** the man standing inside the lantern-lit stone arch, looking into the camera with a warm calm smile, open hand reaching toward the camera.
The man from the image stands inside the lantern-lit stone arch, looks into the camera with a warm calm smile and gently reaches his open hand toward the camera in a welcoming gesture. At first he is silent, then he softly whispers "I'm here…", slow and breathy, his lips matching the vocal, and finishes with a smile. Camera: static, with a very slow dolly in. Cinematic, warm lantern light and violet mist. Audio: ethereal echo and the whispered vocal.

## 18 · 170-180 s · Instrumental (image-to-video)
**Reference image:** the man in the lantern-lit arch, side view, hand just lowered, head turning away toward the alley.
The man from the image lowers his hand, turns and walks slowly away through the glowing archway into the alley, lantern light flickering on the stones. Camera: slow pull back and jib up to reveal the Jerusalem skyline under the full moon, violet mist swirling, city lights twinkling, while the figure becomes small and fades into the warm glow. Cinematic, golden and violet light. Audio: instrumental music only, no singing, mouth closed.

## 19 · 180-187.6 s · Final shot, closes the loop (image-to-video, own wide Jerusalem reference, END = loop frame)
**Reference image:** no man. A slightly wider, different-angle view of Jerusalem at night with a full moon and violet mist, same style (start image). The END image is `loop_end_frame_seg1_first.jpg`.
Peaceful wide, almost static shot of Jerusalem at night: a full moon in a purple stormy sky, golden city lights, violet mist drifting, a stone archway with a glowing lantern at the left, purple bougainvillea flowers. Only gentle motion: drifting mist and twinkling lights. Camera: static with a barely perceptible drift. The final frame is the end image. Cinematic, ultra-detailed, golden and violet light. Audio: ambient instrumental fade.

---

When the clips are ready:
`python3 tools/build_music_video.py song.mp3 segments/ -o out.mp4`
