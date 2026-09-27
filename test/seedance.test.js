import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENDPOINT, SeedanceError, buildInput, createClient, estimateCost, isHiggsfieldUrl } from '../src/seedance.js';

test('buildInput applies schema defaults', () => {
  assert.deepEqual(buildInput({ prompt: '  A cinematic scene at sunset ' }), {
    prompt: 'A cinematic scene at sunset',
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
    bitrate_mode: 'high',
    output_format: 'mp4',
    generate_audio: true,
  });
});

test('buildInput coerces CLI/form strings', () => {
  const input = buildInput({ prompt: 'x', duration: '30', generate_audio: 'false' });
  assert.equal(input.duration, 30);
  assert.equal(input.generate_audio, false);
});

test('buildInput rejects invalid values', () => {
  for (const bad of [
    {},
    { prompt: '' },
    { prompt: 'x', duration: 3 },
    { prompt: 'x', duration: 31 },
    { prompt: 'x', duration: 5.5 },
    { prompt: 'x', resolution: '4k' },
    { prompt: 'x', aspect_ratio: '2:1' },
    { prompt: 'x', bitrate_mode: 'low' },
    { prompt: 'x', output_format: 'webm' },
    { prompt: 'x', generate_audio: 'yes' },
    { prompt: 'x', seed: 1 },
  ]) {
    assert.throws(() => buildInput(bad), (err) => err instanceof SeedanceError && err.status === 400, JSON.stringify(bad));
  }
});

test('estimateCost matches published 16:9 per-second prices', () => {
  assert.ok(Math.abs(estimateCost({ resolution: '480p', duration: 1 }).usd - 0.2056) < 0.001);
  assert.ok(Math.abs(estimateCost({ resolution: '720p', duration: 1 }).usd - 0.4622) < 0.001);
  assert.ok(Math.abs(estimateCost({ resolution: '1080p', duration: 1 }).usd - 1.1372) < 0.001);
  // 1280 × 720 × 5 × 24 / 1024 = 108000 tokens
  assert.deepEqual(estimateCost({ resolution: '720p', duration: 5 }), { tokens: 108000, usd: 2.3112, exact: true });
  assert.equal(estimateCost({ resolution: '720p', aspect_ratio: '9:16' }).exact, false);
});

test('isHiggsfieldUrl only allows https Higgsfield hosts', () => {
  assert.ok(isHiggsfieldUrl('https://api.higgsfield.ai/requests/1/status'));
  assert.ok(!isHiggsfieldUrl('http://api.higgsfield.ai/requests/1/status'));
  assert.ok(!isHiggsfieldUrl('https://evilhiggsfield.ai/x'));
  assert.ok(!isHiggsfieldUrl('https://higgsfield.ai.evil.com/x'));
  assert.ok(!isHiggsfieldUrl('not a url'));
});

function mockFetch(responses) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const [status, body] = responses.shift();
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

test('subscribe submits with Key auth and polls until completed', async () => {
  const statusUrl = 'https://api.higgsfield.ai/requests/abc/status';
  const { fetch, calls } = mockFetch([
    [200, { request_id: 'abc', status: 'queued', status_url: statusUrl }],
    [200, { request_id: 'abc', status: 'in_progress', status_url: statusUrl }],
    [200, { request_id: 'abc', status: 'completed', video: { url: 'https://cdn.example/v.mp4' } }],
  ]);
  const client = createClient({ credentials: 'id:secret', fetch });
  const seen = [];
  const result = await client.subscribe({ prompt: 'sunset' }, { intervalMs: 1, onUpdate: (s) => seen.push(s.status) });

  assert.equal(result.video.url, 'https://cdn.example/v.mp4');
  assert.deepEqual(seen, ['queued', 'in_progress', 'completed']);
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Key id:secret');
  assert.equal(JSON.parse(calls[0].init.body).prompt, 'sunset');
  assert.equal(calls[1].url, statusUrl);
});

test('subscribe throws on failed and nsfw results', async () => {
  const statusUrl = 'https://api.higgsfield.ai/requests/abc/status';
  for (const [terminal, message] of [
    [{ status: 'failed', error: 'boom' }, /failed: boom/],
    [{ status: 'nsfw' }, /NSFW/],
  ]) {
    const { fetch } = mockFetch([
      [200, { request_id: 'abc', status: 'queued', status_url: statusUrl }],
      [200, { request_id: 'abc', ...terminal }],
    ]);
    const client = createClient({ credentials: 'id:secret', fetch });
    await assert.rejects(client.subscribe({ prompt: 'x' }, { intervalMs: 1 }), message);
  }
});

test('API errors surface status and detail', async () => {
  const { fetch } = mockFetch([[401, { detail: 'Invalid credentials' }]]);
  const client = createClient({ credentials: 'id:secret', fetch });
  await assert.rejects(client.submit({ prompt: 'x' }), (err) => err.status === 401 && /Invalid credentials/.test(err.message));
});

test('status refuses to send credentials to foreign hosts', async () => {
  const { fetch, calls } = mockFetch([]);
  const client = createClient({ credentials: 'id:secret', fetch });
  await assert.rejects(client.status('https://example.com/steal'), /non-Higgsfield/);
  assert.equal(calls.length, 0);
});
