from pathlib import Path

p = Path("immersive/tests/motion.mjs")
s = p.read_text()
old = '''      const canvas = page.locator("canvas").first(),
        before = await canvas.getAttribute("data-camera");
      await page
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();'''
new = '''      const canvas = page.locator(".home-stage canvas"),
        before = await canvas.getAttribute("data-camera");
      await page
        .locator(".home-stage")
        .getByRole("button", { name: "Rotate view left", exact: true })
        .click();'''
if old not in s:
    raise RuntimeError("Could not locate homepage camera motion test")
p.write_text(s.replace(old, new, 1))
print("Motion QA now targets the hero renderer rather than the intentionally added causal-proof stage.")
