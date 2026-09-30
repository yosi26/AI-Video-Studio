// Renders the 3D (WebGL) promo: node src/render3d.mjs [config.json] [output.mp4]
// Quick check without encoding: PREVIEW=2,7,12 node src/render3d.mjs  -> output/preview3d-<t>.png
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30, DURATION = 30;
const configPath = resolve(process.argv[2] || `${ROOT}/business.json`);
const outPath = resolve(process.argv[3] || `${ROOT}/output/promo-3d.mp4`);
const config = JSON.parse(readFileSync(configPath, "utf8"));
mkdirSync(dirname(outPath), { recursive: true });

// ES modules can't load from file://, so serve the repo on a local port
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json" };
const server = createServer((req, res) => {
  const file = join(ROOT, normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return "ffmpeg"; } catch {}
  return execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("pageerror", e => { console.error("page error:", e.message); process.exit(1); });
await page.goto(`${base}/src/3d/scene.html`);
await page.waitForFunction(() => window.ready3d);
await page.evaluate(cfg => window.init3d(cfg), config);

const frame = async t => { await page.evaluate(t => window.render3d(t), t); };

if (process.env.PREVIEW) {
  for (const t of process.env.PREVIEW.split(",").map(Number)) {
    await frame(t);
    await page.screenshot({ path: `${dirname(outPath)}/preview3d-${t}.png` });
  }
  console.log(`previews written to ${dirname(outPath)}`);
} else {
  const music = config.music ? resolve(dirname(configPath), config.music) : null;
  const args = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-"];
  if (music) args.push("-i", music, "-af", `afade=t=out:st=${DURATION - 2}:d=2`, "-c:a", "aac", "-b:a", "192k", "-shortest");
  args.push("-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", String(DURATION), outPath);
  const ffmpeg = spawn(findFfmpeg(), args, { stdio: ["pipe", "ignore", "inherit"] });
  const done = new Promise((ok, fail) => ffmpeg.on("close", c => c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`))));
  const started = Date.now();
  for (let f = 0; f < FPS * DURATION; f++) {
    await frame(f / FPS);
    const img = await page.screenshot({ type: "jpeg", quality: 93 });
    if (!ffmpeg.stdin.write(img)) await new Promise(r => ffmpeg.stdin.once("drain", r));
    if (f % FPS === 0) process.stdout.write(`\rrendering ${f / FPS}/${DURATION}s (${((Date.now() - started) / 1000).toFixed(0)}s elapsed)`);
  }
  ffmpeg.stdin.end();
  await done;
  console.log(`\ndone: ${outPath}`);
}
await browser.close();
server.close();
