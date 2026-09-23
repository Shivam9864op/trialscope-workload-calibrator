import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("the published demo presents a real video, no image assets, and source code", () => {
  assert.match(html, /<video\b/i);
  assert.match(html, /media\/trialscope-walkthrough\.mp4/);
  assert.doesNotMatch(html, /<img\b/i);
  assert.match(html, /href="https:\/\/github\.com\/Shivam9864op\/trialscope-workload-calibrator"/);
});
