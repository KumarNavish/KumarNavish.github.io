import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const base = (process.env.QA_BASE_URL || "http://127.0.0.1:4187").replace(
  /\/$/,
  "",
);
const out = path.join(
  process.env.QA_OUT || "/tmp/navish-immersive-qa",
  "motion",
);
await fs.mkdir(out, { recursive: true });
const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined),
  args: [
    "--ignore-gpu-blocklist",
    ...(process.platform === "linux"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
  recordVideo: { dir: out, size: { width: 1440, height: 1000 } },
});
const page = await context.newPage(),
  report = { base, checks: [], errors: [], passed: false };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const check = async (name, fn) => {
  const detail = await fn();
  report.checks.push({ name, pass: true, detail });
  console.log("PASS " + name);
};
const go = async (route) => {
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page
    .locator('.scene-stage[data-state="ready"]')
    .first()
    .waitFor({ timeout: 30000 });
};
try {
  await check("bounded introductory WebGL motion", async () => {
    await go("/");
    const canvas = page.locator("canvas").first(),
      before = await canvas.screenshot();
    await page.waitForTimeout(1200);
    const after = await canvas.screenshot();
    assert.notEqual(Buffer.compare(before, after), 0);
    await page.screenshot({ path: out + "/home-live.png" });
  });
  await check(
    "camera interpolation produces distinct intermediate and final views",
    async () => {
      const canvas = page.locator("canvas").first(),
        before = await canvas.getAttribute("data-camera");
      await page
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();
      await page.waitForTimeout(150);
      const middle = await canvas.getAttribute("data-camera");
      await page.waitForTimeout(1000);
      const after = await canvas.getAttribute("data-camera");
      assert.notEqual(before, middle);
      assert.notEqual(middle, after);
      return { before, middle, after };
    },
  );
  await check(
    "authored scientific step changes both pixels and explanation",
    async () => {
      await go("/work/experience-replay-optimization/");
      await page
        .getByRole("button", { name: "Pause explanation", exact: true })
        .click();
      const before = await page.locator("canvas").screenshot();
      await page
        .getByRole("button", { name: "Next explanation step", exact: true })
        .click();
      await page.waitForTimeout(1500);
      const after = await page.locator("canvas").screenshot();
      assert.notEqual(Buffer.compare(before, after), 0);
      assert.match(await page.locator(".story-step h2").innerText(), /damage/);
      await page.screenshot({ path: out + "/replay-interference.png" });
    },
  );
  await check(
    "inactive rendering stops while the stage is offscreen",
    async () => {
      await page.locator("footer").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const before = Number(
        await page.locator("canvas").getAttribute("data-frames"),
      );
      await page.waitForTimeout(900);
      const after = Number(
        await page.locator("canvas").getAttribute("data-frames"),
      );
      assert.equal(before, after);
      return { before, after };
    },
  );
  await check(
    "visible agent playback pauses, resumes and persists a reached position",
    async () => {
      await go("/frontier/spatial-intelligence/");
      await page
        .getByRole("button", { name: "Reset example", exact: true })
        .click();
      await page.locator(".world-stage").scrollIntoViewIfNeeded();
      await page
        .getByRole("button", { name: "Run agent", exact: true })
        .click();
      await page.waitForTimeout(1800);
      assert.match(await page.locator(".agent-box").innerText(), /Moving/);
      await page
        .getByRole("button", { name: "Pause agent", exact: true })
        .click();
      await page.waitForTimeout(250);
      const canvas = page.locator("canvas");
      const before = await canvas.evaluate((c) => ({
        position: c.dataset.agentPosition,
        elapsed: c.dataset.elapsed,
        camera: c.dataset.camera,
        paused: c.dataset.paused,
      }));
      assert.equal(before.paused, "true");
      assert.ok(before.position);
      // Pausing the agent must not lock the visitor out of inspecting the scene.
      await page
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();
      await page.waitForTimeout(1000);
      const after = await canvas.evaluate((c) => ({
        position: c.dataset.agentPosition,
        elapsed: c.dataset.elapsed,
        camera: c.dataset.camera,
        paused: c.dataset.paused,
      }));
      assert.equal(
        after.position,
        before.position,
        "the rendered agent must remain stationary while paused",
      );
      assert.equal(
        after.elapsed,
        before.elapsed,
        "the agent simulation clock must not advance while paused",
      );
      assert.notEqual(
        after.camera,
        before.camera,
        "the camera must remain usable while the agent is paused",
      );
      await page
        .getByRole("button", { name: "Resume agent", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector(".agent-box small")?.textContent ===
          "Complete",
        null,
        { timeout: 25000 },
      );
      const w = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("navish-spatial-world-v2")),
      );
      assert.notDeepEqual(w.agentPosition, [-2.9, 0, 1.75]);
      assert.ok(w.history.some((h) => h.text.startsWith("Agent approached")));
      await page.screenshot({ path: out + "/agent-complete.png" });
      return { agentPosition: w.agentPosition, revision: w.revision };
    },
  );
  await check(
    "eye-level camera and night lighting are real scene changes",
    async () => {
      await page
        .getByRole("button", { name: "Eye level", exact: true })
        .click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: out + "/spatial-eye-level.png" });
      await page
        .getByRole("button", { name: "Make it night", exact: true })
        .click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: out + "/spatial-night.png" });
      assert.equal(
        await page.locator(".scene-stage").getAttribute("data-world-time"),
        "night",
      );
    },
  );
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
