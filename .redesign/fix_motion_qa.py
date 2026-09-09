from pathlib import Path

p = Path("immersive/tests/motion.mjs")
s = p.read_text()
old = '''      const canvas = page.locator("canvas").first(),
        before = await canvas.getAttribute("data-camera");
      await page
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();
      await page.waitForTimeout(150);
      const middle = await canvas.getAttribute("data-camera");
      await page.waitForTimeout(1000);
      const after = await canvas.getAttribute("data-camera");
      assert.notEqual(before, middle);
      assert.notEqual(middle, after);'''
new = '''      const canvas = page.locator(".home-stage canvas"),
        before = await canvas.getAttribute("data-camera");
      await page
        .locator(".home-stage")
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();
      await page.waitForFunction(
        (previous) => document.querySelector(".home-stage canvas")?.dataset.camera !== previous,
        before,
        { timeout: 3000 },
      );
      const middle = await canvas.getAttribute("data-camera");
      await page.waitForTimeout(1000);
      const after = await canvas.getAttribute("data-camera");
      assert.notEqual(before, middle);
      assert.notEqual(middle, after);'''
if old not in s:
    raise RuntimeError("Could not locate homepage camera motion sequence")
p.write_text(s.replace(old, new, 1))
print("Motion QA now scopes the hero renderer and waits for a genuine animated camera-state transition.")
