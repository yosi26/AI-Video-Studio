// Renders a 30s vertical (1080x1920) promo video from a business JSON config.
// Usage: node src/render.mjs [config.json] [output.mp4]
// Quick check without encoding: PREVIEW=2.5,7,12 node src/render.mjs  -> output/preview-<t>.png
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30;
const DURATION = 30;

const configPath = resolve(process.argv[2] || `${ROOT}/business.json`);
const outPath = resolve(process.argv[3] || `${ROOT}/output/promo.mp4`);
const config = JSON.parse(readFileSync(configPath, "utf8"));
const configDir = dirname(configPath);

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
const toDataUri = p => {
  const file = resolve(configDir, p);
  return `data:${MIME[extname(file).toLowerCase()] || "image/png"};base64,${readFileSync(file).toString("base64")}`;
};

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return "ffmpeg"; } catch {}
  try {
    return execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();
  } catch {
    throw new Error("ffmpeg not found: install ffmpeg, `pip install imageio-ffmpeg`, or set FFMPEG_PATH");
  }
}

const page_config = {
  ...config,
  logo: config.logo ? toDataUri(config.logo) : null,
  images: (config.images || []).map(toDataUri),
};

mkdirSync(dirname(outPath), { recursive: true });

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(`${ROOT}/src/template.html`).href);
  await page.evaluate(cfg => init(cfg), page_config);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

if (process.env.PREVIEW) {
  const browser = await chromium.launch();
  const page = await openPage(browser);
  for (const t of process.env.PREVIEW.split(",").map(Number)) {
    await page.evaluate(t => render(t), t);
    await page.screenshot({ path: `${dirname(outPath)}/preview-${t}.png` });
  }
  await browser.close();
  console.log(`previews written to ${dirname(outPath)}`);
  process.exit(0);
}
const music = config.music ? resolve(configDir, config.music) : null;
if (music && !existsSync(music)) throw new Error(`music file not found: ${music}`);

const args = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-"];
if (music) args.push("-i", music, "-af", `afade=t=out:st=${DURATION - 2}:d=2`, "-c:a", "aac", "-b:a", "192k", "-shortest");
args.push("-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", String(DURATION), outPath);
const ffmpeg = spawn(findFfmpeg(), args, { stdio: ["pipe", "ignore", "inherit"] });
const ffmpegDone = new Promise((ok, fail) => ffmpeg.on("close", code => code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`))));

const browser = await chromium.launch();
const page = await openPage(browser);

const total = FPS * DURATION;
for (let f = 0; f < total; f++) {
  await page.evaluate(t => render(t), f / FPS);
  const frame = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ffmpeg.stdin.write(frame)) await new Promise(r => ffmpeg.stdin.once("drain", r));
  if (f % FPS === 0) process.stdout.write(`\rrendering ${f / FPS}/${DURATION}s`);
}
ffmpeg.stdin.end();
await browser.close();
await ffmpegDone;
console.log(`\ndone: ${outPath}`);
