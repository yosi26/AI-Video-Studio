# AI-Video-Studio
AI video generator: create cinematic videos from text with **Seedance 2.5** (`bytedance/seedance-2.5/text-to-video`) through the Higgsfield API.

## Setup

Requires Node.js 22.9+. There are no npm dependencies.

```bash
cp .env.example .env   # then set HF_KEY=YOUR_KEY_ID:YOUR_KEY_SECRET
```

Credentials stay on the server. The browser only talks to the local server, which proxies requests to Higgsfield.

## Web studio

```bash
npm start              # http://localhost:3000
```

Enter a prompt and pick the options. The page shows a live cost estimate, then submits the job, polls until it finishes and plays the result.

## CLI

```bash
npm run generate -- --prompt "A cinematic scene at sunset" --duration 8 --resolution 1080p --out outputs/sunset.mp4
npm run generate -- --prompt "..." --estimate      # print the cost only
npm run generate -- --help
```

## Library

```js
import { createClient } from './src/seedance.js';

const client = createClient(); // reads HF_KEY or HF_CREDENTIALS
const result = await client.subscribe({ prompt: 'A cinematic scene at sunset', duration: 5 });
console.log(result.video.url);
```

`submit`, `status`, `cancel` and `waitFor` are also available for manual lifecycle control.

## Parameters

| Parameter | Default | Values |
| --- | --- | --- |
| `prompt` | (required) | non-empty string |
| `duration` | `5` | integer, 4–30 seconds |
| `resolution` | `720p` | `480p`, `720p`, `1080p` |
| `aspect_ratio` | `16:9` | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9` |
| `bitrate_mode` | `high` | `standard`, `high` |
| `output_format` | `mp4` | `mp4`, `mov` |
| `generate_audio` | `true` | boolean |

Input is checked against the model's JSON schema before it is sent. Unknown parameters are rejected.

## Pricing estimate

Billable video tokens = `ceil(width × height × duration × 24 / 1024)`, at $0.0214 per 1,000 tokens (480p/720p) or $0.0234 per 1,000 tokens (1080p). For 16:9 that works out to about $0.21/s at 480p, $0.46/s at 720p and $1.14/s at 1080p. Estimates for other aspect ratios are approximate, and all rates are before any customer discount.

## Tests

```bash
npm test
```
