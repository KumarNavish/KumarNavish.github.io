from pathlib import Path

p = Path("immersive/tests/browser.mjs")
s = p.read_text()
old = '''    ]) {
      await go(route);
      assert.ok(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
'''
new = '''    ]) {
      // Mobile narrative blocks deliberately place several scientific stages below
      // the first viewport. Validate document geometry before asking those lazy
      // WebGL stages to initialize; desktop and dedicated interaction tests cover
      // their rendered scientific behavior.
      await go(route, false);
      assert.ok(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
'''
if old not in s:
    raise RuntimeError("Could not locate mobile route loop")
s = s.replace(old, new, 1)

# At the representative 390px viewport, additionally exercise the deep stages by
# scrolling them into view. This verifies the lazy renderer rather than disabling it.
old2 = '''      if (width === 390)
        await snap(
          route === "/"
            ? "home-mobile"
            : route.replaceAll("/", "_") + "-mobile",
        );
'''
new2 = '''      if (width === 390) {
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
'''
if old2 not in s:
    raise RuntimeError("Could not locate representative mobile screenshot block")
s = s.replace(old2, new2, 1)

p.write_text(s)
print("Mobile QA now preserves offscreen lazy rendering and explicitly scrolls deep stages into view at 390px.")
