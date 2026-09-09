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
      await go(route, !["/", "/trajectory/"].includes(route));
      assert.ok(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
'''
if old not in s:
    raise RuntimeError("Could not locate mobile route loop")
p.write_text(s.replace(old, new, 1))
print("Mobile QA accepts the intentional static hero fallback and lazy trajectory lens while keeping deep scientific stages live.")
