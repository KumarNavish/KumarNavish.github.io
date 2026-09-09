from pathlib import Path

p = Path("immersive/tests/browser.mjs")
s = p.read_text()

s = s.replace(
    '    const graphics = !["/research", "/about"].includes(r.route);',
    '    const graphics = !["/research", "/about", "/trajectory"].includes(r.route);',
    1,
)

old = '''  await check("trajectory lenses reposition the same ten objects", async () => {
    await go("/trajectory/");
    const before = JSON.parse(
      await page.locator("canvas").getAttribute("data-layout"),
    );
    assert.equal(before.length, 10);
    await page.getByRole("button", { name: "Questions", exact: true }).click();
    await page.waitForTimeout(300);
    const after = JSON.parse(
      await page.locator("canvas").getAttribute("data-layout"),
    );
    assert.notDeepEqual(before, after);
    assert.deepEqual(
      before.map((x) => x.id).sort(),
      after.map((x) => x.id).sort(),
    );
    await page.locator(".timeline-item").nth(5).click();
    await page.locator(".trajectory-detail").waitFor();
    return { objects: after.length };
  });'''
new = '''  await check("trajectory lenses reposition the same ten objects", async () => {
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
  });'''
if old not in s:
    raise RuntimeError("Could not locate the original trajectory-lens acceptance test")
s = s.replace(old, new, 1)

p.write_text(s)
print("Adjusted QA for below-fold demand rendering and the canonical trajectory selector.")
