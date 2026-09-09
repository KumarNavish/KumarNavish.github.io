from pathlib import Path

p = Path("immersive/src/SpatialLab.tsx")
s = p.read_text()
old = '''  const lastChange = world.history.at(-1);
  const lastDiff = lastChange ? describeHistory(lastChange, world) : [];
'''
new = '''  const lastChange = [...world.history]
    .reverse()
    .find((entry) => !entry.text.startsWith("Agent approached ")) ?? world.history.at(-1);
  const lastDiff = lastChange ? describeHistory(lastChange, world) : [];
'''
if old not in s:
    raise RuntimeError("Could not find generated state-diff selection")
p.write_text(s.replace(old, new, 1))
print("State diff now keeps the latest user edit visible while agent completion remains in full history.")
