import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const base = (process.env.QA_BASE_URL || "http://127.0.0.1:4187").replace(/\/$/, "");
const out = process.env.QA_OUT || "/tmp/navish-immersive-qa";
await fs.mkdir(out, { recursive: true });
const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || (existsSync(mac) ? mac : undefined),
  args: process.platform === "linux"
    ? ["--ignore-gpu-blocklist", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    : ["--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const report = { startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [], passed: false };
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });

async function check(name, fn) {
  try {
    const detail = await fn();
    report.checks.push({ name, pass: true, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, pass: false, error: error.message });
    throw error;
  }
}
async function go(route) {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, `${route} HTTP status`);
  await page.locator("h1").waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  assert.ok((await page.locator("body").innerText()).length > 250);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `${route} overflow`);
}
async function snap(name, fullPage = false) {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage });
  report.screenshots.push(`${name}.png`);
}
const metric = async (label) => {
  const item = page.locator(".readouts > div", { has: page.locator(`dt:text-is("${label}")`) });
  return item.locator("dd").innerText();
};
const world = () => page.evaluate(() => JSON.parse(localStorage.getItem("navish-spatial-world-v2")));
const apply = async (text) => {
  await page.getByLabel("Describe the scene or the next change").fill(text);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForTimeout(180);
  assert.equal(await page.locator(".command-error").count(), 0);
};
const homeChoice = (name) => page.locator(".hero-trajectory .canonical-timeline button").filter({ hasText: name });

try {
  await check("all canonical static routes serve real HTML", async () => {
    const response = await context.request.get(`${base}/release.json`);
    assert.equal(response.status(), 200);
    const release = await response.json();
    for (const route of release.routes.filter((item) => item.route === item.canonical)) {
      const r = await context.request.get(base + (route.route === "/" ? "/" : `${route.route}/`));
      assert.equal(r.status(), 200, route.route);
      const html = await r.text();
      assert.match(html, /<h1/);
      assert.ok(html.includes(`content="${release.commit}"`), `${route.route} release marker`);
      assert.ok(html.includes(`href="${route.url}"`), `${route.route} canonical`);
    }
    report.release = release;
    return `${release.routes.length} static routes`;
  });

  await check("homepage has one dominant Past Now Frontier spine", async () => {
    await go("/");
    assert.equal(await page.locator(".hero-trajectory .canonical-timeline").count(), 1);
    assert.equal(await page.locator(".hero-trajectory .timeline-period").count(), 3);
    assert.equal(await page.locator(".hero-trajectory .canonical-timeline button").count(), 10);
    assert.equal(await page.locator(".proof-selector").count(), 0);
    assert.equal(await page.locator(".home-spatial").count(), 0);
    assert.equal(await page.locator(".home-selected-work").count(), 0);
    assert.equal(await page.locator(".home-selection-prompt").count(), 1);
    const text = await page.locator(".hero-trajectory").innerText();
    assert.match(text, /Past/); assert.match(text, /Now/); assert.match(text, /Frontier/);
    const nav = await page.locator(".main-nav a").allTextContents();
    assert.deepEqual(nav, ["Trajectory", "Work", "Frontier", "About"]);
    const hrefs = await page.locator(".main-nav a").evaluateAll((items) => items.map((item) => item.getAttribute("href")));
    assert.deepEqual(hrefs, ["/trajectory", "/work", "/frontier", "/about"]);
    await snap("home-desktop", true);
    return "single ten-work timeline; no second selector and no preselected project";
  });

  await check("trajectory page keeps time canonical rather than introducing another visual system", async () => {
    await go("/trajectory/");
    assert.equal(await page.locator(".trajectory-page-v2 > .canonical-timeline").count(), 1);
    assert.equal(await page.locator(".trajectory-page-v2 > .canonical-timeline .timeline-period").count(), 3);
    assert.equal(await page.locator(".trajectory-page-v2 .scene-stage").count(), 0);
    const overview = await page.locator(".trajectory-orientation").innerText();
    assert.match(overview, /Past/); assert.match(overview, /Now/); assert.match(overview, /Frontier/);
    await page.locator(".trajectory-page-v2 > .canonical-timeline button").filter({ hasText: "Experience Replay" }).click();
    assert.equal(await page.locator(".trajectory-selected-v2 .work-position > div").count(), 3);
    return "one temporal timeline plus selected came-from/this-work/leads-toward context";
  });

  await check("all ten works share one homepage explanation slot", async () => {
    await go("/");
    const names = [
      "Interaction dynamics", "Gain graph structure", "Spectral certificates", "Urban micro-regions",
      "Optimization geometry", "Experience Replay", "Rank Feasibility", "Temporal replay value",
      "CasePath", "Persistent worlds",
    ];
    for (const name of names) {
      await homeChoice(name).click();
      const selected = page.locator(".home-selected-work");
      await selected.waitFor();
      assert.match(await selected.locator(".selected-work-intro").innerText(), new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      assert.equal(await page.locator(".home-selection-prompt").count(), 0);
      assert.equal(await page.locator(".home-selected-work").count(), 1);
      assert.equal(await selected.locator(".mechanism-pulse article").count(), 3);
      if (name === "Persistent worlds") {
        assert.equal(await selected.locator(".home-selected-spatial").count(), 1);
        assert.equal(await selected.locator(".scientific-panel").count(), 0);
      } else {
        assert.equal(await selected.locator(".scientific-panel").count(), 1);
      }
    }
    return "10/10 works selectable through the canonical timeline into one shared explanation region";
  });

  await check("gain graph turns one edge change into a measured global certificate", async () => {
    await go("/work/normalized-gain-laplacians/");
    const before = Number(await metric("Least eigenvalue"));
    await page.locator(".story-index button").nth(3).click();
    const after = Number(await metric("Least eigenvalue"));
    assert.ok(after > before);
    assert.match(await page.locator(".mechanism-pulse").innerText(), /unbalanced/i);
    assert.match(await page.locator(".mechanism-pulse").innerText(), /global spectral change/i);
    return { before, after };
  });

  await check("replay exposes destructive learning and the residual correction", async () => {
    await go("/work/experience-replay-optimization/");
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await page.getByLabel("Replay selection").selectOption("dense");
    const full = Number(await metric("Gradient residual"));
    assert.ok(full < 0.001);
    await page.getByLabel("Restrict the buffer directions").check();
    const deficient = Number(await metric("Gradient residual"));
    assert.ok(deficient > 0.2);
    const pulse = await page.locator(".mechanism-pulse").innerText();
    assert.match(pulse, /current-only update/i); assert.match(pulse, /old-task loss/i);
    return { full, deficient };
  });

  await check("rank distinguishes impossible, costly, and usable repair", async () => {
    await go("/work/rank-feasibility/");
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    const rank = page.getByRole("slider").first();
    await rank.focus(); await rank.press("Home");
    assert.match(await page.locator(".readouts").innerText(), /Infeasible/);
    assert.match(await page.locator(".mechanism-pulse").innerText(), /No optimizer can find a repair/i);
    await rank.press("End");
    assert.match(await page.locator(".readouts").innerText(), /Feasible & usable/);
    assert.match(await page.locator(".mechanism-pulse").innerText(), /contains a repair/i);
    return "rank 1 impossible; rank 3 usable under the illustrated budget";
  });

  await check("temporal replay lets history cross from useful to inertia", async () => {
    await go("/work/ticlm-replay-value/");
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    const sliders = page.getByRole("slider");
    await sliders.nth(0).focus(); await sliders.nth(0).press("Home");
    for (let i = 0; i < 6; i++) await sliders.nth(0).press("ArrowRight");
    await sliders.nth(1).focus(); await sliders.nth(1).press("Home"); await sliders.nth(1).press("ArrowRight");
    assert.match(await page.locator(".mechanism-pulse").innerText(), /earns its budget/i);
    await sliders.nth(1).press("End");
    assert.match(await page.locator(".mechanism-pulse").innerText(), /net inertia/i);
    return "same historical allocation changes interpretation as temporal shift increases";
  });

  await check("CasePath visibly refuses, corrects, and replays only dependent state", async () => {
    await go("/systems/casepath/");
    for (let index = 0; index < 3; index++) await page.getByRole("button", { name: "Next explanation step", exact: true }).click();
    assert.match(await page.locator(".readouts").innerText(), /HOLD/);
    assert.match(await page.locator(".mechanism-pulse").innerText(), /cannot become permission to act/i);
    await page.getByRole("button", { name: "Apply superseding correction", exact: true }).click();
    assert.match(await page.locator(".readouts").innerText(), /READY/);
    assert.equal(await page.locator(".case-replay-trace li").count(), 4);
    const trace = await page.locator(".case-replay-trace").innerText();
    assert.match(trace, /Dependent obligation/); assert.match(trace, /Unrelated state/);
    await snap("casepath-corrected");
    return "HOLD → superseding correction → scoped replay → READY for human review";
  });

  await check("homepage spatial explanation edits the same selected world", async () => {
    await go("/");
    assert.equal(await page.locator(".scene-stage").count(), 0);
    await homeChoice("Persistent worlds").click();
    const stage = page.locator(".home-selected-spatial");
    await stage.locator('.scene-stage[data-state="ready"]').waitFor({ timeout: 30000 });
    const stateLabel = stage.locator(".home-spatial-controls > span");
    const parse = async () => {
      const text = await stateLabel.innerText();
      const match = text.match(/(\d+) objects · revision (\d+)/);
      assert.ok(match, text);
      return { objects: Number(match[1]), revision: Number(match[2]) };
    };
    const before = await parse();
    await stage.getByRole("button", { name: "Move the microscope", exact: true }).click();
    const moved = await parse();
    assert.ok(moved.revision > before.revision);
    await stage.getByRole("button", { name: "Add a sample", exact: true }).click();
    const added = await parse();
    assert.ok(added.revision > moved.revision); assert.ok(added.objects > moved.objects);
    await stage.getByRole("button", { name: "Make it night", exact: true }).click();
    await page.locator('.home-selected-spatial .scene-stage[data-world-time="night"]').waitFor();
    assert.equal(await stage.locator(".mechanism-pulse article").count(), 3);
    return { before, moved, added };
  });

  await check("spatial lab preserves identity across language edits and exposes diffs", async () => {
    await go("/frontier/spatial-intelligence/");
    await page.getByRole("button", { name: "Clear objects", exact: true }).click();
    await apply("Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.");
    const first = await world(); assert.ok(first.objects.length >= 5);
    await apply("Add a second sample beside the microscope.");
    const second = await world();
    assert.ok(first.objects.every((item) => second.objects.some((candidate) => candidate.id === item.id)));
    const microscope = second.objects.find((item) => item.kind === "microscope");
    await apply("Move the microscope beside the window.");
    const moved = await world();
    const sameMicroscope = moved.objects.find((item) => item.id === microscope.id);
    assert.notDeepEqual(sameMicroscope.position, microscope.position); assert.ok(sameMicroscope.relation);
    assert.match(await page.locator(".world-inline-diff").innerText(), /changed|microscope/i);
    await apply("Make it night."); assert.equal((await world()).time, "night");
    await page.getByRole("button", { name: "History", exact: true }).click();
    assert.ok((await page.locator(".world-history article").count()) >= 4);
    await snap("spatial-persistent-world");
    return `preserved ${first.objects.length} original object identities across follow-up edits`;
  });

  await check("project pages preserve trajectory position, authorship, evidence, and boundary", async () => {
    await go("/work/experience-replay-optimization/");
    assert.equal(await page.locator(".work-position > div").count(), 3);
    assert.match(await page.locator(".work-position").innerText(), /Came from/);
    assert.match(await page.locator(".work-position").innerText(), /Leads toward/);
    assert.equal(await page.locator(".project-live-intro").count(), 1);
    assert.equal(await page.locator(".project-causal-summary").count(), 0);
    assert.equal(await page.locator(".project-authorship").count(), 1);
    assert.equal(await page.locator(".work-evidence .boundary").count(), 1);
    return "came from → this work → leads toward plus live-first explanation, contribution and limitation";
  });

  await check("mobile keeps the ten-work temporal spine legible", async () => {
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
      await page.setViewportSize({ width, height });
      await go("/");
      assert.equal(await page.locator(".hero-trajectory .timeline-period").count(), 3);
      assert.equal(await page.locator(".hero-trajectory .canonical-timeline button").count(), 10);
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      if (await menu.isVisible()) {
        await menu.click(); assert.equal(await page.locator(".main-nav a:visible").count(), 4);
        await page.getByRole("button", { name: "Close", exact: true }).click();
      }
      if (width === 390) await snap("home-mobile", true);
    }
    return "320, 390 and 768 px viewports";
  });

  await check("automated accessibility audit", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const results = [];
    for (const route of ["/", "/work/rank-feasibility/", "/systems/casepath/", "/frontier/spatial-intelligence/"]) {
      await go(route);
      await page.addScriptTag({ path: path.resolve("node_modules/axe-core/axe.min.js") });
      const audit = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
      results.push({ route, violations: audit.violations.map((item) => item.id) });
    }
    await fs.writeFile(path.join(out, "accessibility.json"), JSON.stringify(results, null, 2));
    assert.equal(results.flatMap((item) => item.violations).length, 0, JSON.stringify(results));
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
  await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, out }));
}
