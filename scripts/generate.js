#!/usr/bin/env node
// CLI: generate a video with Seedance 2.5 and optionally download it.
//   npm run generate -- --prompt "A cinematic scene at sunset" --duration 8 --resolution 1080p --out outputs/sunset.mp4
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildInput, createClient, estimateCost } from '../src/seedance.js';

const { values } = parseArgs({
  options: {
    prompt: { type: 'string', short: 'p' },
    duration: { type: 'string', short: 'd' },
    resolution: { type: 'string', short: 'r' },
    'aspect-ratio': { type: 'string', short: 'a' },
    'bitrate-mode': { type: 'string' },
    format: { type: 'string', short: 'f' },
    'no-audio': { type: 'boolean' },
    out: { type: 'string', short: 'o' },
    estimate: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || !values.prompt) {
  console.log(`Usage: npm run generate -- --prompt "..." [options]

  -p, --prompt        Text prompt (required)
  -d, --duration      Seconds, 4-30 (default 5)
  -r, --resolution    480p | 720p | 1080p (default 720p)
  -a, --aspect-ratio  16:9 | 4:3 | 1:1 | 3:4 | 9:16 | 21:9 (default 16:9)
      --bitrate-mode  standard | high (default high)
  -f, --format        mp4 | mov (default mp4)
      --no-audio      Disable generated audio
  -o, --out           Download the finished video to this path
      --estimate      Print the cost estimate and exit`);
  process.exit(values.help ? 0 : 1);
}

try {
  const input = buildInput({
    prompt: values.prompt,
    duration: values.duration,
    resolution: values.resolution,
    aspect_ratio: values['aspect-ratio'],
    bitrate_mode: values['bitrate-mode'],
    output_format: values.format,
    generate_audio: !values['no-audio'],
  });
  const cost = estimateCost(input);
  console.log(`Estimated cost: ${cost.exact ? '' : '~'}$${cost.usd.toFixed(2)} (${cost.tokens.toLocaleString()} video tokens)`);
  if (values.estimate) process.exit(0);

  let last;
  const result = await createClient().subscribe(input, {
    onUpdate: (s) => {
      if (s.status !== last) console.log(`[${new Date().toLocaleTimeString()}] ${s.status} (${s.request_id})`);
      last = s.status;
    },
  });
  console.log(`Video: ${result.video.url}`);

  if (values.out) {
    const res = await fetch(result.video.url);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    await mkdir(dirname(values.out), { recursive: true });
    await writeFile(values.out, Buffer.from(await res.arrayBuffer()));
    console.log(`Saved to ${values.out}`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
