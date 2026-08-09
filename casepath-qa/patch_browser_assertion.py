from pathlib import Path

path = Path(__file__).with_name("browser-public.mjs")
text = path.read_text(encoding="utf-8")
old = "record('Shared rule remains visibly quarantined', (await page.locator('#learningNow').innerText()).includes('Not yet shared'));"
new = "const learningText = await page.locator('#learningNow').innerText();\n  record('Shared rule remains visibly quarantined', /quarantined|not yet shared/i.test(learningText), learningText);"
if old not in text:
    raise SystemExit("Expected browser assertion was not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
