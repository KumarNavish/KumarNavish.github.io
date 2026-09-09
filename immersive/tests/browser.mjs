import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
const base = (process.env.QA_BASE_URL || "http://127.0.0.1:4187").replace(
  /\/$/,
  "",
);
const out = process.env.QA_OUT || "/tmp/navish-immersive-qa";
await fs.mkdir(out, { recursive: true });
const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined);
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: [
    "--ignore-gpu-blocklist",
    ...(process.platform === "linux"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
  ],
});
const report = {
  base,
  startedAt: new Date().toISOString(),
  checks: [],
  routes: [],
  errors: [],
  screenshots: [],
  passed: false,
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.errors.push(message.text());
});
const check = async (name, fn) => {
  try {
    const detail = await fn();
    report.checks.push({ name, pass: true, detail });
    console.log("PASS " + name);
  } catch (error) {
    report.checks.push({ name, pass: false, error: error.message });
    throw error;
  }
};
const go = async (route, graphics = true) => {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, route + " HTTP status");
  await page.locator("h1").waitFor();
  if (graphics)
    await page
      .locator('.scene-stage[data-state="ready"]')
      .first()
      .waitFor({ timeout: 30000 });
};
const snap = async (name, fullPage = false) => {
  await page.screenshot({ path: path.join(out, name + ".png"), fullPage });
  report.screenshots.push(name + ".png");
};
const world = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("navish-spatial-world-v2")),
  );
const apply = async (text) => {
  await page.getByLabel("Describe the scene or the next change").fill(text);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator(".command-error").count(), 0);
};
try {
  const response = await context.request.get(base + "/release.json");
  assert.equal(response.status(), 200);
  const release = await response.json();
  report.release = release;
  await check("static canonical documents", async () => {
    for (const r of release.routes) {
      const response = await context.request.get(
        base + (r.route === "/" ? "/" : r.route + "/"),
      );
      assert.equal(response.status(), 200, r.route);
      const text = await response.text();
      assert.ok(text.includes("<h1"), r.route + " server content missing");
      assert.ok(
        text.includes('content="' + release.commit + '"'),
        r.route + " release marker missing",
      );
      assert.ok(
        text.includes('href="' + r.url + '"'),
        r.route + " canonical mismatch",
      );
    }
    return release.routes.length;
  });
  const canonical = release.routes.filter((r) => r.route === r.canonical);
  for (const r of canonical) {
    const graphics = !["/research", "/about", "/trajectory"].includes(r.route);
    await go(r.route === "/" ? "/" : r.route + "/", graphics);
    assert.equal(await page.locator("h1").count(), 1);
    assert.ok((await page.title()).includes("Navish Kumar"));
    assert.ok((await page.locator("body").innerText()).length > 250);
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
    assert.ok(
      (await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      )) <= 1,
      r.route + " overflow",
    );
    const canvas = await page.locator("canvas").count();
    let stats = null;
    if (canvas)
      stats = await page
        .locator("canvas")
        .first()
        .evaluate((c) => ({
          renderer: c.dataset.renderer,
          triangles: Number(c.dataset.triangles),
          camera: c.dataset.camera,
        }));
    if (graphics) {
      assert.equal(stats.renderer, "webgl2");
      if (stats.triangles == null) {
        const box = await page.locator(".scene-stage").first().boundingBox();
        assert.ok(box && box.y >= 900, r.route + " has an unrendered stage inside the active viewport");
      } else {
        assert.ok(stats.triangles > 100);
      }
    }
    report.routes.push({ route: r.route, pass: true, stats });
    if (
      [
        "/",
        "/work",
        "/trajectory",
        "/systems",
        "/frontier/spatial-intelligence",
        "/work/experience-replay-optimization",
        "/work/rank-feasibility",
        "/work/normalized-gain-laplacians",
      ].includes(r.route)
    )
      await snap(
        r.route === "/"
          ? "home-desktop"
          : r.route.replaceAll("/", "_").slice(1) + "-desktop",
      );
  }
  await check("homepage has one canonical temporal spine and one causal proof", async () => {
    await go("/");
    assert.equal(await page.locator(".hero-horizons a").count(), 3);
    assert.equal(await page.locator(".canonical-timeline .timeline-period").count(), 3);
    assert.equal(await page.locator(".canonical-timeline li").count(), 10);
    assert.equal(await page.locator(".proof-selector button").count(), 4);
    assert.equal(await page.locator(".causal-chain article").count(), 4);
    await page.locator(".proof-selector button").filter({ hasText: "Experience Replay" }).click();
    await page.locator('[data-work-id="experience-replay-optimization"]').waitFor();
    assert.match(await page.locator(".causal-chain").innerText(), /destructive change/i);
    return "Past/Now/Frontier plus a selected problem → intervention → consequence → meaning proof";
  });
  await check("deep work exposes position, causal meaning, and authorship before evidence", async () => {
    await go("/work/experience-replay-optimization/");
    assert.equal(await page.locator(".work-position > div").count(), 3);
    assert.equal(await page.locator(".project-causal-summary article").count(), 4);
    assert.equal(await page.locator(".project-authorship").count(), 1);
    assert.match(await page.locator(".work-position").innerText(), /Rank Feasibility/);
    return "came from → this work → leads toward is explicit";
  });
  await check("trajectory opens with canonical Past Now Frontier before secondary lenses", async () => {
    await go("/trajectory/");
    assert.equal(await page.locator(".canonical-timeline .timeline-period").count(), 3);
    assert.equal(await page.locator(".canonical-timeline li").count(), 10);
    const canonical = await page.locator(".canonical-timeline").boundingBox();
    const lenses = await page.locator(".trajectory-lens-section").boundingBox();
    assert.ok(canonical && lenses && canonical.y < lenses.y);
    await page.locator(".canonical-timeline button").filter({ hasText: "Rank Feasibility" }).click();
    assert.match(await page.locator(".trajectory-selection").innerText(), /correction/i);
    return "Time is canonical; question/method/system views remain secondary";
  });
  await check(
    "orbit and camera controls change a real WebGL camera",
    async () => {
      await go("/");
      const c = page.locator("canvas").first(),
        before = await c.getAttribute("data-camera");
      await page
        .locator(".home-stage")
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();
      await page.waitForTimeout(150);
      const after = await c.getAttribute("data-camera");
      assert.notEqual(before, after);
      return { before, after };
    },
  );
  await check("trajectory lenses reposition the same ten objects", async () => {
    await go("/trajectory/", false);
    await page.locator(".trajectory-lens-section").scrollIntoViewIfNeeded();
    await page.locator('.trajectory-scene[data-state="ready"]').waitFor({ timeout: 30000 });
    const canvas = page.locator(".trajectory-scene canvas");
    await page.waitForFunction(() => {
      const el = document.querySelector(".trajectory-scene canvas");
      return Boolean(el?.dataset.layout);
    });
    const before = JSON.parse(await canvas.getAttribute("data-layout"));
    assert.equal(before.length, 10);
    await page.getByRole("button", { name: "Questions", exact: true }).click();
    await page.waitForTimeout(900);
    const after = JSON.parse(await canvas.getAttribute("data-layout"));
    assert.notDeepEqual(before, after);
    assert.deepEqual(before.map((x) => x.id).sort(), after.map((x) => x.id).sort());
    await page.locator(".canonical-timeline button").filter({ hasText: "Experience Replay" }).click();
    await page.locator(".trajectory-selection").waitFor();
    return { objects: after.length };
  });
  await check(
    "gain phase changes cycle balance and recomputed eigenvalue",
    async () => {
      await go("/work/normalized-gain-laplacians/");
      const before = await page.locator(".readouts dd").first().innerText();
      await page.locator(".story-index button").nth(3).click();
      const after = await page.locator(".readouts dd").first().innerText();
      assert.ok(Number(after) > Number(before));
      assert.match(await page.locator(".readouts").innerText(), /Unbalanced/);
      await page.getByRole("button", { name: "Evidence", exact: true }).click();
      assert.equal(await page.locator("table.matrix td").count(), 36);
      return { before, after };
    },
  );
  await check(
    "replay dense baseline and deficient-buffer residual",
    async () => {
      await go("/work/experience-replay-optimization/");
      await page.getByRole("button", { name: "Explore", exact: true }).click();
      await page.getByLabel("Replay selection").selectOption("dense");
      const full = Number(
        await page.locator(".readouts dd").first().innerText(),
      );
      assert.ok(full < 0.001);
      await page.getByLabel("Restrict the buffer directions").check();
      const deficient = Number(
        await page.locator(".readouts dd").first().innerText(),
      );
      assert.ok(deficient > 0.2);
      return { full, deficient };
    },
  );
  await check("rank separates infeasible and usable corrections", async () => {
    await go("/work/rank-feasibility/");
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    const slider = page.getByRole("slider").first();
    await slider.focus();
    await slider.press("Home");
    assert.match(await page.locator(".readouts").innerText(), /Infeasible/);
    await slider.press("End");
    assert.match(
      await page.locator(".readouts").innerText(),
      /Feasible & usable/,
    );
    return "rank 1 infeasible; rank 3 usable";
  });
  await check(
    "CasePath holds conflict and retains superseded evidence",
    async () => {
      await go("/systems/");
      assert.equal(await page.locator(".case-decision-sequence article").count(), 4);
      assert.match(await page.locator(".case-decision-sequence").innerText(), /HOLD/);
      assert.match(await page.locator(".case-decision-sequence").innerText(), /READY for review/);
      await go("/systems/casepath/");
      for (let i = 0; i < 3; i++)
        await page
          .getByRole("button", { name: "Next explanation step", exact: true })
          .click();
      assert.match(await page.locator(".readouts").innerText(), /HOLD/);
      await page
        .getByRole("button", {
          name: "Apply superseding correction",
          exact: true,
        })
        .click();
      assert.match(await page.locator(".readouts").innerText(), /READY/);
      assert.equal(await page.locator(".superseded").count(), 1);
      await snap("casepath-corrected");
    },
  );
  await check(
    "spatial commands preserve identities, relations, changes and reload state",
    async () => {
      await go("/frontier/spatial-intelligence/");
      assert.equal(await page.locator(".world-compiler-rail article").count(), 5);
      assert.match(await page.locator(".world-compiler-rail").innerText(), /Language/);
      assert.match(await page.locator(".world-compiler-rail").innerText(), /World/);
      await page
        .getByRole("button", { name: "Clear objects", exact: true })
        .click();
      await apply(
        "Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.",
      );
      const first = await world();
      assert.ok(first.objects.length >= 5);
      assert.match(await page.locator(".world-compiler-rail").innerText(), /parsed edits/);
      assert.match(await page.locator(".world-inline-diff").innerText(), /added|created|environment|lighting/i);
      await apply("Add a second sample beside the microscope.");
      const second = await world();
      assert.equal(second.objects.length, first.objects.length + 1);
      assert.ok(
        first.objects.every((o) => second.objects.some((n) => n.id === o.id)),
      );
      await apply("Move the microscope beside the window.");
      const moved = await world(),
        before = second.objects.find((o) => o.kind === "microscope"),
        after = moved.objects.find((o) => o.id === before.id);
      assert.notDeepEqual(before.position, after.position);
      assert.ok(after.relation);
      await apply("Make it night.");
      const night = await world();
      assert.equal(night.time, "night");
      await page.getByRole("button", { name: "History", exact: true }).click();
      assert.ok((await page.locator(".world-history article").count()) >= 4);
      await snap("spatial-night-history");
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('.scene-stage[data-state="ready"]').waitFor();
      assert.deepEqual((await world()).objects, night.objects);
      return {
        initialObjects: first.objects.length,
        finalObjects: night.objects.length,
        revision: night.revision,
      };
    },
  );
  await check("direct manipulation changes an existing 3D object", async () => {
    await go("/frontier/spatial-intelligence/");
    await page
      .getByRole("button", { name: "Reset example", exact: true })
      .click();
    await page.getByRole("button", { name: "Plan view", exact: true }).click();
    await page
      .getByRole("button", { name: "Move objects", exact: true })
      .click();
    await page.waitForTimeout(250);
    const before = await world(),
      object = before.objects.find((o) => o.kind === "sample");
    const canvas = page.locator("canvas");
    const data = await canvas.evaluate((c) => ({
      camera: c.dataset.camera,
      target: c.dataset.target,
      fov: Number(c.dataset.fov),
      rect: {
        x: c.getBoundingClientRect().x,
        y: c.getBoundingClientRect().y,
        width: c.clientWidth,
        height: c.clientHeight,
      },
    }));
    const camera = new PerspectiveCamera(
      data.fov,
      data.rect.width / data.rect.height,
      0.1,
      160,
    );
    camera.position.fromArray(data.camera.split(",").map(Number));
    camera.lookAt(new Vector3(...data.target.split(",").map(Number)));
    camera.updateMatrixWorld();
    const v = new Vector3(
      object.position[0],
      object.position[1] + 0.05,
      object.position[2],
    ).project(camera);
    const x = data.rect.x + ((v.x + 1) * data.rect.width) / 2,
      y = data.rect.y + ((1 - v.y) * data.rect.height) / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 35, y + 8, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const after = await world();
    assert.notDeepEqual(
      after.objects.find((o) => o.id === object.id).position,
      object.position,
    );
    assert.equal(after.objects.length, before.objects.length);
    return {
      object: object.id,
      from: object.position,
      to: after.objects.find((o) => o.id === object.id).position,
    };
  });
  await check("unsupported command is rejected transactionally", async () => {
    const before = await world();
    await page
      .getByLabel("Describe the scene or the next change")
      .fill("Do not remove the microscope");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator(".command-error").waitFor();
    assert.deepEqual((await world()).objects, before.objects);
  });
  await check(
    "reduced-motion and no-WebGL views remain operational",
    async () => {
      await go("/work/rank-feasibility/?no3d", false);
      await page.locator('.scene-stage[data-state="fallback"]').waitFor();
      assert.equal(await page.locator("canvas").count(), 0);
      await page.getByRole("button", { name: "Next explanation step" }).click();
      assert.match(
        await page.locator(".story-step h2").innerText(),
        /conflict/,
      );
      await go("/frontier/spatial-intelligence/?no3d", false);
      await page.locator('.scene-stage[data-state="fallback"]').waitFor();
      await apply("Add a sample");
      assert.ok((await world()).objects.length > 0);
      return "Computed controls and persistent editing remain available without WebGL";
    },
  );
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of [
      "/",
      "/trajectory/",
      "/work/experience-replay-optimization/",
      "/frontier/spatial-intelligence/",
    ]) {
      // Mobile narrative blocks deliberately place several scientific stages below
      // the first viewport. Validate document geometry before asking those lazy
      // WebGL stages to initialize; desktop and dedicated interaction tests cover
      // their rendered scientific behavior.
      await go(route, false);
      assert.ok(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
        route + " overflow at " + width,
      );
      if (route === "/") {
        const menu = page.getByRole("button", { name: "Menu", exact: true });
        if (await menu.isVisible()) {
          await menu.click();
          assert.equal(await page.locator(".main-nav a:visible").count(), 6);
          await page
            .getByRole("button", { name: "Close", exact: true })
            .click();
        }
      }
      if (width === 390) {
        if (["/work/experience-replay-optimization/", "/frontier/spatial-intelligence/"].includes(route)) {
          const stage = page.locator(".scene-stage").first();
          await stage.scrollIntoViewIfNeeded();
          await stage.waitFor({ state: "visible" });
          await page.locator('.scene-stage[data-state="ready"]').first().waitFor({ timeout: 30000 });
        }
        await snap(
          route === "/"
            ? "home-mobile"
            : route.replaceAll("/", "_") + "-mobile",
        );
      }
      report.routes.push({ route, viewport: [width, height], pass: true });
    }
  }
  await check("automated accessibility audit", async () => {
    const results = [];
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of [
      "/",
      "/work/rank-feasibility/",
      "/frontier/spatial-intelligence/",
    ]) {
      await go(route);
      await page.addScriptTag({
        path: path.resolve("node_modules/axe-core/axe.min.js"),
      });
      const audit = await page.evaluate(
        async () =>
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          }),
      );
      const violations = audit.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      }));
      results.push({ route, violations });
    }
    await fs.writeFile(
      path.join(out, "accessibility.json"),
      JSON.stringify(results, null, 2),
    );
    assert.equal(
      results.flatMap((r) => r.violations).length,
      0,
      "Accessibility violations: " + JSON.stringify(results),
    );
    return results;
  });
  await check("browser runtime health", async () => {
    assert.deepEqual(report.errors, []);
    return "No page or console errors";
  });
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  console.error(error);
  await page
    .screenshot({ path: path.join(out, "failure.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await fs.writeFile(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      routes: report.routes.length,
      out,
    }),
  );
}
