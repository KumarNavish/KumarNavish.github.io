from pathlib import Path

scene = Path("immersive/src/components/SceneStage.tsx")
s = scene.read_text()
old = '''    <div
      ref={outer}
      className={`scene-stage ${className}`}
      data-state={status}
      data-world-time={config.world?.time}
    >
      <div className="stage-host" ref={host} aria-label={description} />'''
new = '''    <div
      ref={outer}
      className={`scene-stage ${className}`}
      data-state={status}
      data-world-time={config.world?.time}
      role="region"
      aria-label={description}
    >
      <div className="stage-host" ref={host} aria-hidden="true" />'''
if old not in s:
    raise RuntimeError("Could not locate SceneStage semantics target")
scene.write_text(s.replace(old, new, 1))

css = Path("immersive/src/base.css")
s = css.read_text()
s = s.replace("color: #687c8b;\n  letter-spacing: 0.025em;", "color: #526b7b;\n  letter-spacing: 0.025em;", 1)
# This rule is created by the comprehension patch. Keep unresolved pipeline stages
# visibly secondary, but never by dropping below text contrast requirements.
s = s.replace("border-left: 1px solid #dce5ec; color: #83919c;", "border-left: 1px solid #dce5ec; color: #526b7b;", 1)
css.write_text(s)
print("Moved the accessible scene name to a valid region and raised low-contrast informational text.")
