// Renders preview clips for the experiment cards, frame by frame.
//   node scripts/capture-thumbs.mjs [id=warmSeconds,...]   (site running on localhost:3055)
// Writes public/thumbs/<id>.mp4 and .webp (poster). Needs playwright and ffmpeg.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3055";
const OUT = "public/thumbs";
const TMP = process.env.TMP_DIR ?? "/tmp/thumb-frames";
const W = 640, H = 400, FRAMES = 96;
// warm up: seconds of simulation before the clip starts, so something is happening
const DEFAULT = {
  "fly-looming-escape": 2.6, "fly-runner": 3, "fly-drives-a-car": 2, "worm-dish-edge": 3, "worm-food-search": 3,
  "gym-feeding": 4, "gym-backaway": 2, "gym-poker": 1, "gym-pong": 2, "gym-tmaze": 0.5, "gym-bandit": 0.3, "gym-flight": 1, "gym-chase": 2,
};
const args = process.argv.slice(2);
const jobs = args.length ? Object.fromEntries(args.map((a) => { const [k, v] = a.split("="); return [k, Number(v ?? DEFAULT[k] ?? 2)]; })) : DEFAULT;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [id, warm] of Object.entries(jobs)) {
  const dir = `${TMP}/${id}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto(`${BASE}/render/${id}?quality=high`, { waitUntil: "load", timeout: 120000 });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 180000, polling: 500 });
  await p.evaluate((ms) => window.__warm(ms), warm * 1000);
  for (let f = 0; f < FRAMES; f++) {
    await p.evaluate(() => window.__frame(1));
    await p.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
  }
  await p.close();
  const inp = ["-y", "-v", "error", "-framerate", "24", "-i", `${dir}/%04d.png`];
  execFileSync("ffmpeg", [...inp, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "slow", "-movflags", "+faststart", "-an", `${OUT}/${id}.mp4`]);

  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `${dir}/${String(Math.floor(FRAMES / 2)).padStart(4, "0")}.png`, "-q:v", "80", `${OUT}/${id}.webp`]);
  console.log(id, ["mp4", "webp"].map((e) => `${e} ${Math.round(fs.statSync(`${OUT}/${id}.${e}`).size / 1024)} kB`).join(", "));
}
await b.close();
