// Seedance 2.5 text-to-video client for the Higgsfield API.
// Docs: https://dash.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/llms.txt

export const MODEL_ID = 'bytedance/seedance-2.5/text-to-video';
export const API_BASE = 'https://api.higgsfield.ai';
export const ENDPOINT = `${API_BASE}/${MODEL_ID}`;

// Mirrors the model's input JSON schema.
export const OPTIONS = {
  duration: { min: 4, max: 30, default: 5 },
  resolution: { values: ['480p', '720p', '1080p'], default: '720p' },
  aspect_ratio: { values: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], default: '16:9' },
  bitrate_mode: { values: ['standard', 'high'], default: 'high' },
  output_format: { values: ['mp4', 'mov'], default: 'mp4' },
  generate_audio: { default: true },
};

export const TERMINAL_STATUSES = new Set(['completed', 'failed', 'nsfw', 'canceled']);

export class SeedanceError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'SeedanceError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Validates user input against the model schema and fills in defaults.
 * Throws SeedanceError (status 400) listing every problem found.
 */
export function buildInput(raw = {}) {
  const errors = [];
  const known = new Set(['prompt', ...Object.keys(OPTIONS)]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) errors.push(`unknown parameter "${key}"`);
  }

  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!prompt) errors.push('prompt is required');

  let duration = raw.duration ?? OPTIONS.duration.default;
  if (typeof duration === 'string' && duration.trim() !== '') duration = Number(duration);
  if (!Number.isInteger(duration) || duration < OPTIONS.duration.min || duration > OPTIONS.duration.max) {
    errors.push(`duration must be an integer between ${OPTIONS.duration.min} and ${OPTIONS.duration.max}`);
  }

  const input = { prompt, duration };
  for (const key of ['resolution', 'aspect_ratio', 'bitrate_mode', 'output_format']) {
    const value = raw[key] ?? OPTIONS[key].default;
    if (!OPTIONS[key].values.includes(value)) {
      errors.push(`${key} must be one of: ${OPTIONS[key].values.join(', ')}`);
    }
    input[key] = value;
  }

  let audio = raw.generate_audio ?? OPTIONS.generate_audio.default;
  if (audio === 'true') audio = true;
  if (audio === 'false') audio = false;
  if (typeof audio !== 'boolean') errors.push('generate_audio must be a boolean');
  input.generate_audio = audio;

  if (errors.length) throw new SeedanceError(`Invalid input: ${errors.join('; ')}`, { status: 400 });
  return input;
}

// 16:9 pixel dimensions implied by the published per-second prices.
const PIXELS_16x9 = { '480p': 854 * 480, '720p': 1280 * 720, '1080p': 1920 * 1080 };
// USD per 1,000 video tokens.
const TOKEN_RATE = { '480p': 0.0214, '720p': 0.0214, '1080p': 0.0234 };

/**
 * Estimates the cost of a text-to-video request (no video input).
 * Billable tokens = ceil(width × height × duration × 24 / 1024).
 * Exact for 16:9; other aspect ratios assume a similar pixel count, so treat
 * them as approximate. Rates are before any customer discount.
 */
export function estimateCost({ resolution = OPTIONS.resolution.default, duration = OPTIONS.duration.default, aspect_ratio = OPTIONS.aspect_ratio.default } = {}) {
  const pixels = PIXELS_16x9[resolution];
  if (!pixels) throw new SeedanceError(`Unknown resolution "${resolution}"`, { status: 400 });
  const tokens = Math.ceil((pixels * duration * 24) / 1024);
  const usd = (tokens / 1000) * TOKEN_RATE[resolution];
  return { tokens, usd: Math.round(usd * 10000) / 10000, exact: aspect_ratio === '16:9' };
}

export function isHiggsfieldUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'higgsfield.ai' || hostname.endsWith('.higgsfield.ai'));
  } catch {
    return false;
  }
}

export function resolveCredentials(env = process.env) {
  const key = env.HF_KEY || env.HF_CREDENTIALS;
  if (!key) throw new SeedanceError('Missing credentials: set HF_KEY (or HF_CREDENTIALS) to KEY_ID:KEY_SECRET');
  if (!key.includes(':')) throw new SeedanceError('Credentials must be in KEY_ID:KEY_SECRET form');
  return key;
}

export function createClient({ credentials = resolveCredentials(), fetch: fetchImpl = globalThis.fetch } = {}) {
  const headers = {
    Authorization: `Key ${credentials}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  async function request(url, init = {}) {
    const res = await fetchImpl(url, { ...init, headers: { ...headers, ...init.headers } });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      const detail = body.detail || body.error || body.message || text || res.statusText;
      throw new SeedanceError(`Higgsfield API ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, { status: res.status, body });
    }
    return body;
  }

  // Only follow status/cancel URLs on Higgsfield hosts, so the credentials
  // header is never sent elsewhere.
  function assertApiUrl(url) {
    if (!isHiggsfieldUrl(url)) throw new SeedanceError(`Refusing to call non-Higgsfield URL: ${url}`);
    return url;
  }

  /** Submits a generation request. Resolves to the queued request status. */
  async function submit(rawInput) {
    const input = buildInput(rawInput);
    return request(ENDPOINT, { method: 'POST', body: JSON.stringify(input) });
  }

  async function status(statusUrl) {
    return request(assertApiUrl(statusUrl));
  }

  async function cancel(cancelUrl) {
    return request(assertApiUrl(cancelUrl), { method: 'POST' });
  }

  /**
   * Polls a request's status_url until it reaches a terminal state.
   * `onUpdate` is called with every status payload.
   */
  async function waitFor(statusUrl, { intervalMs = 5000, timeoutMs = 20 * 60 * 1000, onUpdate, signal } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      signal?.throwIfAborted();
      const current = await status(statusUrl);
      onUpdate?.(current);
      if (TERMINAL_STATUSES.has(current.status)) return current;
      if (Date.now() + intervalMs > deadline) {
        throw new SeedanceError(`Timed out waiting for request ${current.request_id}`);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /** Submits and waits for a terminal result; throws unless completed. */
  async function subscribe(rawInput, pollOptions = {}) {
    const queued = await submit(rawInput);
    pollOptions.onUpdate?.(queued);
    if (!TERMINAL_STATUSES.has(queued.status) && !queued.status_url) {
      throw new SeedanceError('Submit response did not include a status_url', { body: queued });
    }
    const result = TERMINAL_STATUSES.has(queued.status) ? queued : await waitFor(queued.status_url, pollOptions);
    if (result.status !== 'completed') {
      const reason = result.error || (result.status === 'nsfw' ? 'content flagged as NSFW' : result.status);
      throw new SeedanceError(`Generation ${result.status}: ${reason}`, { body: result });
    }
    return result;
  }

  return { submit, status, cancel, waitFor, subscribe };
}
