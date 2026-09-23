import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const media = join(root, "media");
const videoPath = join(media, "trialscope-walkthrough.mp4");
const srtPath = join(media, "trialscope-walkthrough.srt");
const fps = 10;
const cues = [
  [0, 6, "The brief says six hours a week. The trial measured more."],
  [6, 15, "Check the original brief. Local rules show phrases to review; they do not decide contract meaning."],
  [15, 24, "Log the work that is easy to miss. Keep recurring work separate from one-off setup."],
  [24, 34, "Compare observed hours, trial output and the fee you entered. A short sample is only an early signal."],
  [34, 43, "Prepare an editable, neutral alignment note. Nothing is sent for you."],
  [43, 49, "Personal demo. Fictional café. Synthetic trial data. Saved in your browser."]
];
const edgeCandidates = process.platform === "win32"
  ? [process.env.EDGE_BIN, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"]
  : [process.env.EDGE_BIN, "chromium", "chromium-browser", "google-chrome"];
const edge = edgeCandidates.find((path) => path && (existsSync(path) || process.platform !== "win32"));
if (!edge) throw new Error("Microsoft Edge was not found; set EDGE_BIN to an installed Edge executable.");
if (typeof WebSocket !== "function") throw new Error("This script needs Node.js with built-in WebSocket support.");

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
const stamp = (seconds) => {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  return `${String(Math.floor(whole / 3600)).padStart(2, "0")}:${String(Math.floor(whole % 3600 / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};
const subtitleText = cues.map(([start, end, text], i) => `${i + 1}\n${stamp(start)} --> ${stamp(end)}\n${text}\n`).join("\n");

async function freePort() {
  const { createServer } = await import("node:net");
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
  const value = server.address().port;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return value;
}
async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(url); if (response.ok) return response; } catch { /* server is starting */ }
    await wait(120);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  await mkdir(media, { recursive: true });
  const temp = await mkdtemp(join(tmpdir(), "trialscope-record-"));
  const frames = join(temp, "frames");
  const profile = join(temp, "edge-profile");
  await mkdir(frames, { recursive: true });
  const captionFiles = [];
  for (let i = 0; i < cues.length; i++) {
    const path = join(temp, `caption-${String(i).padStart(2, "0")}.txt`);
    await writeFile(path, cues[i][2], "utf8");
    captionFiles.push(path);
  }
  const appPort = await freePort();
  const base = `http://127.0.0.1:${appPort}/`;
  const server = spawn(process.execPath, [join(root, "scripts", "serve.mjs")], { env: { ...process.env, HOST: "127.0.0.1", PORT: String(appPort) }, stdio: "ignore", windowsHide: true });
  const browserPort = await freePort();
  const browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--disable-sync", "--metrics-recording-only", "--remote-allow-origins=*", `--remote-debugging-port=${browserPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let socket;
  let sequence = 0;
  let frameIndex = 0;
  const pending = new Map();
  try {
    await waitFor(base);
    const versionResponse = await waitFor(`http://127.0.0.1:${browserPort}/json/version`);
    await versionResponse.json();
    const targetResponse = await fetch(`http://127.0.0.1:${browserPort}/json/new?${encodeURIComponent(base)}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error("Could not open an isolated walkthrough tab.");
    const target = await targetResponse.json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    socket.addEventListener("message", (event) => {
      const packet = JSON.parse(event.data);
      if (!packet.id) return;
      const waiter = pending.get(packet.id);
      if (!waiter) return;
      pending.delete(packet.id);
      packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result);
    });
    const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
      const id = ++sequence; pending.set(id, { resolve: resolveCommand, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(`Walkthrough check failed: ${result.exceptionDetails.text} ${(result.exceptionDetails.exception?.description ?? "").slice(0, 280)}`);
      return result.result.value;
    };
    const click = async (selector, index = 0) => {
      const didClick = await evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})][${index}];if(!el||el.disabled)return false;if(!el.matches('.step-tab'))el.scrollIntoView({block:'center',behavior:'instant'});el.click();return true})()`);
      if (!didClick) throw new Error(`Could not click ${selector}`);
      await wait(300);
    };
    const set = async (selector, value) => {
      const done = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
      if (!done) throw new Error(`Could not fill ${selector}`);
      await wait(150);
    };
    const assertIncludes = async (expression, expected, label) => {
      const actual = String(await evaluate(expression));
      if (!actual.includes(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    };
    await send("Page.enable"); await send("Runtime.enable");
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: temp }).catch(() => {});
    await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
    await send("Page.navigate", { url: base });
    for (let i = 0; i < 100; i++) {
      const title = await evaluate("document.title").catch(() => "");
      if (String(title).includes("TrialScope")) break;
      await wait(100);
    }
    await assertIncludes("document.title", "TrialScope", "App loaded");
    await evaluate("(()=>{const v=document.querySelector('#walkthrough-video');if(v){v.hidden=true}const card=document.querySelector('.hero-video');if(card){card.innerHTML='<div class=\"video-head\"><span class=\"video-label\">WALKTHROUGH RECORDING</span><span class=\"video-duration\">49 SEC</span></div><div style=\"display:grid;place-items:center;color:white;padding:18px;text-align:center;font:600 14px/1.5 Segoe UI,Arial,sans-serif\">The brief says six hours a week.<br>Let’s compare it with the trial.</div><div class=\"video-caption\"><strong>Fictional café example</strong><span>Measured work · no client data</span></div>'}})()");
    const capture = async (seconds) => {
      for (let i = 0; i < seconds * fps; i++) {
        const start = Date.now();
        const image = await send("Page.captureScreenshot", { format: "jpeg", quality: 82, fromSurface: true });
        await writeFile(join(frames, `${String(frameIndex++).padStart(6, "0")}.jpg`), Buffer.from(image.data, "base64"));
        const remaining = Math.max(0, 1000 / fps - (Date.now() - start));
        if (remaining) await wait(remaining);
      }
    };
    await capture(6);
    await click('.step-tab[data-view="brief"]');
    await assertIncludes("document.querySelector('#scan-findings').textContent", "Weekly client check-in", "source lines surfaced by brief check");
    await capture(9);
    await click('.step-tab[data-view="trial"]');
    await set("#entry-note", "Approval follow-up after delayed assets");
    await set("#entry-hours", "0.5");
    await evaluate("document.querySelector('#entry-form').requestSubmit()");
    await assertIncludes("document.querySelector('#notice').textContent", "Work block added", "work item logged");
    await capture(5);
    await evaluate("document.querySelector('#entry-form').scrollIntoView({block:'center',behavior:'instant'})");
    await wait(250);
    await capture(4);
    await evaluate("window.scrollTo({top:0,behavior:'instant'})");
    await wait(250);
    await click('.step-tab[data-view="compare"]');
    await assertIncludes("document.querySelector('.gap-marker').textContent", "Needs alignment", "comparison status");
    await capture(10);
    await click('.step-tab[data-view="handoff"]');
    await assertIncludes("document.querySelector('#handoff-preview').value", "Scope alignment", "editable handoff draft");
    await capture(4);
    await evaluate("document.querySelector('#handoff-preview').scrollIntoView({block:'center',behavior:'instant'})");
    await capture(5);
    await click('[data-action="download-handoff"]');
    await wait(700);
    const files = await readdir(temp);
    const reportFile = files.find((name) => name.endsWith("trialscope-scope-alignment.md"));
    if (!reportFile) throw new Error("Markdown handoff download was not produced.");
    const report = await readFile(join(temp, reportFile), "utf8");
    if (!report.includes("One-off setup recorded") || !report.includes("median")) throw new Error("Downloaded handoff is missing the trial calculations.");
    await capture(6);
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
    const width = Number(await evaluate("document.documentElement.scrollWidth"));
    if (width > 390) throw new Error(`Mobile layout overflows horizontally (${width}px at a 390px viewport).`);
    await send("Emulation.clearDeviceMetricsOverride");
    await writeFile(srtPath, subtitleText, "utf8");
    const fontPath = process.env.VIDEO_FONT || (process.platform === "win32" ? "C:\\Windows\\Fonts\\arial.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf");
    const filterPath = (value) => value.replaceAll("\\", "/").replaceAll(":", "\\:").replaceAll("'", "\\'");
    const filters = cues.map(([start, end], index) => `drawtext=fontfile='${filterPath(fontPath)}':textfile='${filterPath(captionFiles[index])}':fontcolor=white:fontsize=25:box=1:boxcolor=0x17353e@0.96:boxborderw=16:x=(w-text_w)/2:y=h-text_h-30:enable='between(t,${start},${end})'`);
    const ffmpeg = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps), "-i", join(frames, "%06d.jpg"), "-vf", `scale=1920:1080:flags=lanczos,${filters.join(",")},fps=30,format=yuv420p`, "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-movflags", "+faststart", "-an", videoPath], { stdio: "inherit", windowsHide: true });
    const exitCode = await new Promise((resolveExit, reject) => { ffmpeg.once("error", reject); ffmpeg.once("exit", resolveExit); });
    if (exitCode !== 0) throw new Error(`Video encoding failed with exit code ${exitCode}.`);
    process.stdout.write(`Captured ${frameIndex} real app frames; desktop flow and mobile overflow checks passed.\nSaved ${videoPath}\nSaved ${srtPath}\n`);
  } finally {
    try { socket?.close(); } catch { /* cleanup */ }
    try { browser.kill(); } catch { /* cleanup */ }
    try { server.kill(); } catch { /* cleanup */ }
    await wait(250);
    await rm(temp, { recursive: true, force: true });
  }
}

await main();
