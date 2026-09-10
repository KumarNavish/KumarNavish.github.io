import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const base = (process.env.QA_BASE_URL || "http://127.0.0.1:4187").replace(/\/$/, "");
const out = path.join(process.env.QA_OUT || "/tmp/navish-immersive-qa", "motion");
await fs.mkdir(out, { recursive: true });
const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined),
  args: [
    "--ignore-gpu-blocklist",
    ...(process.platform === "linux" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : []),
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
  recordVideo: { dir: out, size: { width: 1440, height: 1000 } },
});
const page = await context.newPage();
const report = { base, checks: [], errors: [], passed: false };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") report.errors.push(m.text()); });

const check = async (name, fn) => {
  const detail = await fn();
  report.checks.push({ name, pass: true, detail });
  console.log("PASS " + name);
};
const go = async (route) => {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, route);
  await page.locator("h1").waitFor();
};
const readyScene = async (root = page) => {
  const stage = root.locator(".scene-stage").first();
  await stage.scrollIntoViewIfNeeded();
  await stage.waitFor({ state: "visible" });
  await stage.locator('[data-state="ready"]').waitFor({ timeout: 30000 });
  return stage;
};
const activateHomeSpatial = async () => {
  if (await page.locator(".home-selected-spatial").count() === 0) {
    await page.locator(".hero-trajectory .canonical-timeline button").filter({ hasText: "Persistent worlds" }).click();
  }
  const root = page.locator(".home-selected-spatial");
  await root.waitFor();
  const stage = root.locator(".scene-stage");
  await stage.scrollIntoViewIfNeeded();
  await stage.locator('[data-state="ready"]').waitFor({ timeout: 30000 });
  return root;
};

try {
  await check("selected spatial work produces visible WebGL motion", async () => {
    await go("/");
    assert.equal(await page.locator(".scene-stage").count(), 0);
    const root = await activateHomeSpatial();
    const canvas = root.locator("canvas");
    const before = await canvas.screenshot();
    await root.getByRole("button", { name: "Rotate view right", exact: true }).click();
    await page.waitForTimeout(1200);
    const after = await canvas.screenshot();
    assert.notEqual(Buffer.compare(before, after), 0);
    await page.screenshot({ path: out + "/home-spatial-live.png" });
  });

  await check("selected spatial camera interpolation has intermediate state", async () => {
    const root = await activateHomeSpatial();
    const canvas = root.locator("canvas");
    const before = await canvas.getAttribute("data-camera");
    await root.getByRole("button", { name: "Rotate view left", exact: true }).click();
    await page.waitForFunction(
      (previous) => document.querySelector(".home-selected-spatial canvas")?.dataset.camera !== previous,
      before,
      { timeout: 3000 },
    );
    const middle = await canvas.getAttribute("data-camera");
    await page.waitForTimeout(1000);
    const after = await canvas.getAttribute("data-camera");
    assert.notEqual(before, middle);
    assert.notEqual(middle, after);
    return { before, middle, after };
  });

  await check("authored scientific step changes pixels and explanation", async () => {
    await go("/work/experience-replay-optimization/");
    await readyScene();
    await page.getByRole("button", { name: "Pause explanation", exact: true }).click();
    const canvas = page.locator("canvas").first();
    const before = await canvas.screenshot();
    await page.getByRole("button", { name: "Next explanation step", exact: true }).click();
    await page.waitForTimeout(1500);
    const after = await canvas.screenshot();
    assert.notEqual(Buffer.compare(before, after), 0);
    assert.match(await page.locator(".story-step h2").innerText(), /damage/);
    await page.screenshot({ path: out + "/replay-interference.png" });
  });

  await check("inactive rendering stops when the scientific stage is offscreen", async () => {
    const canvas = page.locator("canvas").first();
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const before = Number(await canvas.getAttribute("data-frames"));
    await page.waitForTimeout(900);
    const after = Number(await canvas.getAttribute("data-frames"));
    assert.equal(before, after);
    return { before, after };
  });

  await check("situated agent pauses, resumes and persists its reached position", async () => {
    await go("/frontier/spatial-intelligence/");
    await readyScene();
    await page.getByRole("button", { name: "Reset example", exact: true }).click();
    await page.locator(".world-stage").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Run agent", exact: true }).click();
    await page.waitForTimeout(1800);
    assert.match(await page.locator(".agent-box").innerText(), /Moving/);
    await page.getByRole("button", { name: "Pause agent", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("canvas")?.dataset.paused === "true", null, { timeout: 10000 });
    const canvas = page.locator("canvas").first();
    const before = await canvas.evaluate((c) => ({
      position: c.dataset.agentPosition,
      elapsed: c.dataset.elapsed,
      camera: c.dataset.camera,
      paused: c.dataset.paused,
    }));
    assert.equal(before.paused, "true"); assert.ok(before.position);
    await page.getByRole("button", { name: "Rotate view left", exact: true }).click();
    await page.waitForTimeout(1000);
    const after = await canvas.evaluate((c) => ({
      position: c.dataset.agentPosition,
      elapsed: c.dataset.elapsed,
      camera: c.dataset.camera,
      paused: c.dataset.paused,
    }));
    assert.equal(after.position, before.position, "agent must stay stationary while paused");
    assert.equal(after.elapsed, before.elapsed, "agent clock must not advance while paused");
    assert.notEqual(after.camera, before.camera, "camera must remain usable while agent is paused");
    await page.getByRole("button", { name: "Resume agent", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".agent-box small")?.textContent === "Complete",
      null,
      { timeout: 25000 },
    );
    const w = await page.evaluate(() => JSON.parse(localStorage.getItem("navish-spatial-world-v2")));
    assert.notDeepEqual(w.agentPosition, [-2.9, 0, 1.75]);
    assert.ok(w.history.some((h) => h.text.startsWith("Agent approached")));
    await page.screenshot({ path: out + "/agent-complete.png" });
    return { agentPosition: w.agentPosition, revision: w.revision };
  });

  await check("eye-level camera and night lighting are real scene changes", async () => {
    await page.getByRole("button", { name: "Eye level", exact: true }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: out + "/spatial-eye-level.png" });
    await page.getByRole("button", { name: "Make it night", exact: true }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: out + "/spatial-night.png" });
    assert.equal(await page.locator(".scene-stage").getAttribute("data-world-time"), "night");
  });

  await check("throttled selected-spatial startup never reverses its animation clock", async () => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        await go("/?clock-regression=" + attempt);
        const root = await activateHomeSpatial();
        const canvas = root.locator("canvas");
        let previous = 0;
        for (let frame = 0; frame < 12; frame++) {
          await page.waitForTimeout(100);
          const elapsed = Number(await canvas.getAttribute("data-elapsed"));
          assert.ok(Number.isFinite(elapsed) && elapsed >= previous, "elapsed time must remain monotonic after startup");
          previous = elapsed;
        }
      }
    } finally {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await cdp.detach();
    }
  });

  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  console.error(error);
  await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await fs.writeFile(out + "/report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
