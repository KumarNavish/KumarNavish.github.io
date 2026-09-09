from pathlib import Path
import re

ROOT = Path("immersive")


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Expected one patch target in {path}: {old[:90]!r}; found {text.count(old)}")
    path.write_text(text.replace(old, new, 1))


# Project pages and canonical trajectory -------------------------------------------------
p = ROOT / "src/Pages.tsx"
s = p.read_text()
s = s.replace(
    'import { Icon } from "./components/Icon";\n',
    'import { Icon } from "./components/Icon";\nimport { CanonicalTimeline, ProjectCausalSummary, TrajectorySelection, WorkPosition } from "./components/ResearchStoryBlocks";\n',
    1,
)
s = s.replace(
    '''      <div>\n        <h2>The contribution</h2>\n        <p className="contribution-text">{e.work.contribution}</p>\n        <p className="small">{e.work.role}</p>\n      </div>\n''',
    '',
    1,
)
s = s.replace(
    '''      </header>\n      <ScientificPanel exhibit={e} />\n      <EvidenceSection exhibit={e} />''',
    '''      </header>\n      <WorkPosition exhibit={e} />\n      <ProjectCausalSummary exhibit={e} />\n      <ScientificPanel exhibit={e} />\n      <section className="project-authorship">\n        <span>Navish’s contribution</span>\n        <p>{e.work.contribution}</p>\n        <small>{e.work.role}</small>\n      </section>\n      <EvidenceSection exhibit={e} />''',
    1,
)
s = re.sub(r'const RELATIONS: Record<string, string> = \{.*?\n\};\n', '', s, count=1, flags=re.S)
trajectory = '''export function TrajectoryPage() {
  const [selected, setSelected] = useState("");
  const [lens, setLens] = useState("time");
  const reduced = useReducedMotion();
  const exhibit = EXHIBITS.find((e) => e.work.id === selected);
  const config = useMemo<SceneConfig>(
    () => ({ kind: "trajectory", step: 4, value: 0, selected, comparison: lens, reduced }),
    [selected, lens, reduced],
  );
  return (
    <main id="main" className="trajectory-page page-width">
      <header className="page-heading trajectory-heading">
        <h1>Past → Now → <span>Frontier.</span></h1>
        <p>
          This is the canonical spine of the portfolio: what was established, what is active, and where the work is deliberately moving. Questions, methods, and domains are lenses on this same record.
        </p>
      </header>
      <CanonicalTimeline selected={selected} onSelect={setSelected} />
      {exhibit ? (
        <TrajectorySelection exhibit={exhibit} />
      ) : (
        <p className="trajectory-prompt canonical-prompt">
          Select a work in the timeline to reveal its contribution and intellectual position.
        </p>
      )}
      <section className="trajectory-lens-section">
        <header>
          <div>
            <span className="section-label">Secondary lenses</span>
            <h2>Reorganize the same body of work.</h2>
          </div>
          <p>
            Time remains canonical. These views expose recurring questions, methods, systems, and frontier connections without creating a second site architecture.
          </p>
        </header>
        <div className="trajectory-lenses" aria-label="Organize the research gallery">
          {["time", "questions", "methods", "systems", "frontier"].map((item) => (
            <button key={item} aria-pressed={lens === item} onClick={() => setLens(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
          <button className="reset-gallery" onClick={() => { setSelected(""); setLens("time"); }}>
            Reset overview
          </button>
        </div>
        <SceneStage
          config={config}
          description="The same ten works reorganize without replacing the canonical timeline. Select a research object to inspect it."
          className="trajectory-scene"
          callbacks={{ onPick: setSelected }}
        />
      </section>
      <section className="trajectory-audit-link">
        <div>
          <span className="section-label">Exact record</span>
          <h2>Publication status and evidence stay inspectable.</h2>
        </div>
        <Link className="text-link" href="/research">Open the research record <Icon name="arrow" /></Link>
      </section>
    </main>
  );
}
'''
start = s.index('export function TrajectoryPage()')
end = s.index('export function ResearchPage()', start)
s = s[:start] + trajectory + s[end:]

systems = '''export function SystemsPage() {
  const e = EXHIBITS.find((x) => x.work.id === "casepath")!;
  return (
    <main id="main" className="systems-page page-width">
      <header className="page-heading">
        <h1>Keep the evidence<br /><span>attached to the action.</span></h1>
        <p>
          CasePath explores the layer before judgment: reconstruct case state, expose missing evidence, and prepare a reviewable next step without letting a model become the decision-maker.
        </p>
      </header>
      <div className="system-context">
        <span>CasePath · system prototype</span>
        <p>Operational question: can a review packet proceed when two source records disagree about the inspection date?</p>
        <Link href="/systems/casepath">Project record <Icon name="arrow" /></Link>
      </div>
      <section className="case-decision-sequence" aria-label="CasePath failure and correction sequence">
        <article><span>01 · Source</span><strong>20 August</strong><p>An identifiable source supplies a bounded fact.</p></article>
        <article><span>02 · Conflict</span><strong>21 August</strong><p>A second source contradicts the same obligation.</p></article>
        <article className="is-hold"><span>03 · Gate</span><strong>HOLD</strong><p>Fluent interpretation cannot manufacture permission.</p></article>
        <article className="is-ready"><span>04 · Correction</span><strong>READY for review</strong><p>A superseding record replays only dependent state.</p></article>
      </section>
      <ScientificPanel exhibit={e} />
      <div className="system-boundaries">
        <div><h2>Model responsibility</h2><p>Propose bounded interpretations. Preserve the link back to the source. Never manufacture authority from fluency.</p></div>
        <div><h2>Kernel responsibility</h2><p>Evaluate explicit obligations and source relationships. Hold when the available records conflict.</p></div>
        <div><h2>Human responsibility</h2><p>Validate the evidence and the judgment. A consistent review packet does not establish real-world truth.</p></div>
      </div>
      <section className="project-authorship system-authorship">
        <span>Navish’s role</span>
        <p>{e.work.contribution}</p>
        <small>{e.work.role}</small>
      </section>
      <EvidenceSection exhibit={e} />
    </main>
  );
}
'''
start = s.index('export function SystemsPage()')
end = s.index('export function FrontierPage()', start)
s = s[:start] + systems + s[end:]
p.write_text(s)

# Scientific explanations ---------------------------------------------------------------
p = ROOT / "src/components/ScientificPanel.tsx"
s = p.read_text()
s = s.replace(
    'import { Icon } from "./Icon";\n',
    'import { Icon } from "./Icon";\nimport { narrativeFor } from "../data/workNarrative";\n',
    1,
)
s = s.replace(
    '  const current = exhibit.steps[step];\n',
    '  const current = exhibit.steps[step];\n  const narrative = narrativeFor(exhibit.work.id);\n',
    1,
)
needle = '''          <div className="story-step" aria-live="polite">\n            <span>\n              {mode === "guide" ? "Follow the idea" : "The mechanism"}\n            </span>\n            <h2>{mode === "guide" ? current.title : exhibit.question}</h2>\n            <p>\n              {mode === "guide" ? current.body : exhibit.work.explanation15}\n            </p>\n          </div>'''
replacement = needle + '''\n          {(mode !== "guide" || step >= Math.floor(exhibit.steps.length / 2)) && (\n            <div className="story-meaning">\n              <div><span>Observable effect</span><p>{narrative.observableConsequence}</p></div>\n              <div><span>Real-world meaning</span><p>{narrative.realWorldImplication}</p></div>\n            </div>\n          )}'''
if needle not in s:
    raise RuntimeError('Scientific story target missing')
s = s.replace(needle, replacement, 1)
p.write_text(s)

# Persistent-world explanatory pipeline -------------------------------------------------
p = ROOT / "src/SpatialLab.tsx"
s = p.read_text()
s = s.replace(
    '  const object = world.objects.find((o) => o.id === selected);\n',
    '''  const object = world.objects.find((o) => o.id === selected);\n  const lastChange = world.history.at(-1);\n  const lastDiff = lastChange ? describeHistory(lastChange, world) : [];\n  const relationCount = intent ? intent.move.length : 0;\n  const compilerSteps = [\n    ["Language", listening ? "Listening…" : command.trim() ? "Instruction ready" : "Awaiting instruction"],\n    ["Intent", intent ? `${intent.add.length + intent.move.length + intent.remove.length} parsed edits` : "Not parsed yet"],\n    ["Relations", intent ? `${relationCount} spatial relation${relationCount === 1 ? "" : "s"}` : "Not resolved yet"],\n    ["World", `Revision ${world.revision} · ${world.objects.length} objects`],\n    ["Agent", agent === "done" ? "Action completed" : agent === "walking" ? "Executing path" : world.goal ? "Goal resolved" : "No active goal"],\n  ] as const;\n''',
    1,
)
s = s.replace(
    '      <div className="lab-view-controls">\n',
    '''      <section className="world-compiler-rail" aria-label="Language to persistent world pipeline">\n        {compilerSteps.map(([label, value], index) => (\n          <article key={label} className={index <= (intent ? 4 : 0) ? "is-resolved" : ""}>\n            <span>{String(index + 1).padStart(2, "0")}</span>\n            <div><strong>{label}</strong><small>{value}</small></div>\n            {index < compilerSteps.length - 1 && <Icon name="arrow" size={14} />}\n          </article>\n        ))}\n      </section>\n      <div className="lab-view-controls">\n''',
    1,
)
s = s.replace(
    '          </form>\n          <div className="world-bottom-actions">',
    '''          </form>\n          <section className="world-inline-diff" aria-live="polite">\n            <span>State diff</span>\n            {lastDiff.length ? (\n              <ul>{lastDiff.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>\n            ) : (\n              <p>No edit has been applied yet. The next accepted command will change this same world.</p>\n            )}\n          </section>\n          <div className="world-bottom-actions">''',
    1,
)
p.write_text(s)

# Naming -------------------------------------------------------------------------------
p = ROOT / "src/data/exhibits.ts"
s = p.read_text().replace('  frontier: "Next",', '  frontier: "Frontier",', 1)
p.write_text(s)

# Browser acceptance -------------------------------------------------------------------
p = ROOT / "tests/browser.mjs"
s = p.read_text()
s = s.replace(
    '''    if (graphics) {\n      assert.equal(stats.renderer, "webgl2");\n      assert.ok(stats.triangles > 100);\n    }''',
    '''    if (graphics) {\n      assert.equal(stats.renderer, "webgl2");\n      if (stats.triangles == null) {\n        const box = await page.locator(".scene-stage").first().boundingBox();\n        assert.ok(box && box.y >= 900, r.route + " has an unrendered stage inside the active viewport");\n      } else {\n        assert.ok(stats.triangles > 100);\n      }\n    }''',
    1,
)
insert_at = s.index('  await check(\n    "orbit and camera controls change a real WebGL camera"')
new_checks = '''  await check("homepage has one canonical temporal spine and one causal proof", async () => {\n    await go("/");\n    assert.equal(await page.locator(".hero-horizons a").count(), 3);\n    assert.equal(await page.locator(".canonical-timeline .timeline-period").count(), 3);\n    assert.equal(await page.locator(".canonical-timeline li").count(), 10);\n    assert.equal(await page.locator(".proof-selector button").count(), 4);\n    assert.equal(await page.locator(".causal-chain article").count(), 4);\n    await page.locator(".proof-selector button").filter({ hasText: "Experience Replay" }).click();\n    await page.locator('[data-work-id="experience-replay-optimization"]').waitFor();\n    assert.match(await page.locator(".causal-chain").innerText(), /destructive change/i);\n    return "Past/Now/Frontier plus a selected problem → intervention → consequence → meaning proof";\n  });\n  await check("deep work exposes position, causal meaning, and authorship before evidence", async () => {\n    await go("/work/experience-replay-optimization/");\n    assert.equal(await page.locator(".work-position > div").count(), 3);\n    assert.equal(await page.locator(".project-causal-summary article").count(), 4);\n    assert.equal(await page.locator(".project-authorship").count(), 1);\n    assert.match(await page.locator(".work-position").innerText(), /Rank Feasibility/);\n    return "came from → this work → leads toward is explicit";\n  });\n  await check("trajectory opens with canonical Past Now Frontier before secondary lenses", async () => {\n    await go("/trajectory/");\n    assert.equal(await page.locator(".canonical-timeline .timeline-period").count(), 3);\n    assert.equal(await page.locator(".canonical-timeline li").count(), 10);\n    const canonical = await page.locator(".canonical-timeline").boundingBox();\n    const lenses = await page.locator(".trajectory-lens-section").boundingBox();\n    assert.ok(canonical && lenses && canonical.y < lenses.y);\n    await page.locator(".canonical-timeline button").filter({ hasText: "Rank Feasibility" }).click();\n    assert.match(await page.locator(".trajectory-selection").innerText(), /correction/i);\n    return "Time is canonical; question/method/system views remain secondary";\n  });\n'''
s = s[:insert_at] + new_checks + s[insert_at:]
s = s.replace(
    '''      await page\n        .getByRole("button", { name: "Rotate view left", exact: true })\n        .click();''',
    '''      await page\n        .locator(".home-stage")\n        .getByRole("button", { name: "Rotate view left", exact: true })\n        .click();''',
    1,
)
casepath = '      await go("/systems/casepath/");\n'
s = s.replace(
    casepath,
    '''      await go("/systems/");\n      assert.equal(await page.locator(".case-decision-sequence article").count(), 4);\n      assert.match(await page.locator(".case-decision-sequence").innerText(), /HOLD/);\n      assert.match(await page.locator(".case-decision-sequence").innerText(), /READY for review/);\n      await go("/systems/casepath/");\n''',
    1,
)
spatial = '      await go("/frontier/spatial-intelligence/");\n'
s = s.replace(
    spatial,
    '''      await go("/frontier/spatial-intelligence/");\n      assert.equal(await page.locator(".world-compiler-rail article").count(), 5);\n      assert.match(await page.locator(".world-compiler-rail").innerText(), /Language/);\n      assert.match(await page.locator(".world-compiler-rail").innerText(), /World/);\n''',
    1,
)
s = s.replace(
    '      assert.ok(first.objects.length >= 5);\n',
    '''      assert.ok(first.objects.length >= 5);\n      assert.match(await page.locator(".world-compiler-rail").innerText(), /parsed edits/);\n      assert.match(await page.locator(".world-inline-diff").innerText(), /added|created|environment|lighting/i);\n''',
    1,
)
p.write_text(s)

# Comprehension-first visual system ------------------------------------------------------
p = ROOT / "src/base.css"
s = p.read_text()
marker = '/* comprehension-first-20260909 */'
if marker not in s:
    s += r'''

/* comprehension-first-20260909 */
.section-label {
  display: block;
  margin-bottom: 14px;
  color: #315fe8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.comprehension-home .hero { padding-bottom: 36px; }
.hero-horizons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid #dce5ec;
}
.hero-horizons a {
  min-width: 0;
  padding: 18px 16px 19px;
  border-left: 1px solid #dce5ec;
}
.hero-horizons a:first-child { border-left: 0; }
.hero-horizons span, .work-position span, .project-causal-summary span,
.project-authorship span, .case-decision-sequence span, .world-inline-diff > span,
.world-compiler-rail article > span, .trajectory-selection span {
  display: block;
  color: #526b7b;
  font-size: 10px;
  letter-spacing: .075em;
  text-transform: uppercase;
}
.hero-horizons strong { display: block; margin-top: 6px; font-size: 13px; line-height: 1.45; }
.hero-horizons small { display: block; margin-top: 7px; color: #526b7b; font-size: 11px; }
.home-journey { padding-top: 84px; }
.journey-heading, .proof-heading, .home-current > header, .trajectory-lens-section > header {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, .75fr) auto;
  gap: 42px;
  align-items: end;
  padding-bottom: 28px;
}
.journey-heading h2, .proof-heading h2, .home-current h2, .home-atlas-entry h2,
.trajectory-lens-section h2, .trajectory-audit-link h2 {
  font-size: clamp(30px, 3vw, 43px);
  line-height: 1.12;
  letter-spacing: -.05em;
  font-weight: 540;
}
.journey-heading > p, .proof-heading > p, .home-current > header > p,
.trajectory-lens-section > header > p {
  color: #526b7b;
  font-size: 14px;
  line-height: 1.7;
}
.canonical-timeline {
  display: grid;
  grid-template-columns: 1.35fr 1.2fr .75fr;
  border-top: 1px solid #dce5ec;
  border-bottom: 1px solid #dce5ec;
}
.timeline-period { min-width: 0; padding: 28px 26px 20px; border-left: 1px solid #dce5ec; }
.timeline-period:first-child { border-left: 0; }
.timeline-period > header { padding-bottom: 22px; border-bottom: 2px solid #18232c; }
.timeline-period.period-current > header { border-color: #315fe8; }
.timeline-period.period-frontier > header { border-color: #416f64; }
.timeline-period h2 { font-size: 19px; font-weight: 620; }
.timeline-period header p { margin-top: 5px; color: #526b7b; font-size: 12px; }
.timeline-period ol { list-style: none; margin: 0; padding: 0; }
.timeline-period li + li { border-top: 1px solid #e4eaf0; }
.timeline-period a, .timeline-period button {
  width: 100%; min-height: 68px; display: grid; grid-template-columns: 48px 1fr auto;
  gap: 13px; align-items: center; padding: 12px 0; border: 0; background: transparent;
  color: inherit; text-align: left;
}
.timeline-period button[aria-pressed="true"] { color: #315fe8; }
.timeline-period a > span, .timeline-period button > span { color: #526b7b; font-size: 11px; }
.timeline-period strong { display: block; font-size: 13px; line-height: 1.35; }
.timeline-period small { display: block; margin-top: 3px; color: #526b7b; font-size: 10px; }
.home-proof { padding-top: 106px; }
.proof-selector { display: flex; gap: 0; overflow-x: auto; border-top: 1px solid #dce5ec; border-bottom: 1px solid #dce5ec; }
.proof-selector button {
  flex: 1; min-width: 160px; min-height: 50px; padding: 0 18px; border: 0; border-bottom: 2px solid transparent;
  background: #fff; color: #60717e; text-align: left; font-size: 12px;
}
.proof-selector button[aria-selected="true"] { color: #18232c; border-color: #315fe8; font-weight: 620; }
.causal-chain, .project-causal-summary, .case-decision-sequence {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid #dce5ec;
}
.causal-chain article, .project-causal-summary article, .case-decision-sequence article {
  min-width: 0; padding: 26px 20px; border-left: 1px solid #dce5ec;
}
.causal-chain article:first-child, .project-causal-summary article:first-child, .case-decision-sequence article:first-child { border-left: 0; }
.causal-chain span, .project-causal-summary span { color: #315fe8; font-weight: 700; }
.causal-chain p, .project-causal-summary p, .case-decision-sequence p {
  margin-top: 18px; color: #354e60; font-size: 13px; line-height: 1.62;
}
.proof-stage { padding-top: 30px; }
.proof-stage .scientific-panel { margin-top: 0; }
.proof-contribution, .project-authorship {
  display: grid; grid-template-columns: 150px minmax(0, 1fr) minmax(220px, .55fr) auto;
  gap: 32px; align-items: start; padding: 26px 20px 26px 0; border-top: 1px solid #dce5ec; border-bottom: 1px solid #dce5ec;
}
.proof-contribution p, .project-authorship p { color: #283e4e; font-size: 18px; line-height: 1.5; }
.proof-contribution small, .project-authorship small { color: #526b7b; font-size: 12px; line-height: 1.6; }
.proof-contribution a { display: inline-flex; gap: 8px; align-items: center; min-height: 44px; font-size: 12px; white-space: nowrap; }
.home-current { padding-top: 104px; }
.current-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid #dce5ec; }
.current-list a { position: relative; min-height: 178px; padding: 23px 48px 28px 0; border-bottom: 1px solid #dce5ec; }
.current-list a:nth-child(odd) { border-right: 1px solid #dce5ec; padding-right: 34px; }
.current-list a:nth-child(even) { padding-left: 34px; }
.current-list span { color: #526b7b; font-size: 11px; }
.current-list h3 { margin-top: 10px; font-size: 19px; font-weight: 580; }
.current-list p { margin-top: 12px; max-width: 510px; color: #526b7b; font-size: 13px; line-height: 1.65; }
.current-list svg { position: absolute; top: 25px; right: 14px; }
.home-atlas-entry, .trajectory-audit-link {
  display: flex; justify-content: space-between; gap: 40px; align-items: end;
  margin-top: 86px; padding: 44px 0; border-top: 1px solid #dce5ec; border-bottom: 1px solid #dce5ec;
}
.home-atlas-entry p { max-width: 690px; margin-top: 14px; color: #526b7b; font-size: 14px; line-height: 1.7; }
.work-position { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0 0 24px; border-top: 1px solid #dce5ec; border-bottom: 1px solid #dce5ec; }
.work-position > div { min-height: 108px; padding: 22px; border-left: 1px solid #dce5ec; }
.work-position > div:first-child { border-left: 0; }
.work-position .is-current { background: #f2f6ff; }
.work-position strong { display: block; margin-top: 15px; font-size: 13px; line-height: 1.45; }
.project-causal-summary { margin: 0 0 42px; border-top: 1px solid #dce5ec; }
.project-authorship { margin-top: 40px; grid-template-columns: 150px minmax(0, 1fr) minmax(240px, .55fr); }
.work-evidence { grid-template-columns: 1.2fr .8fr; }
.story-meaning { margin-top: 22px; border-top: 1px solid #dce5ec; }
.story-meaning > div { padding: 14px 0; border-bottom: 1px solid #e7edf3; }
.story-meaning span { color: #315fe8; font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.story-meaning p { margin-top: 8px; color: #526b7b; font-size: 12px; line-height: 1.55; }
.trajectory-heading h1 span { color: #416f64; }
.trajectory-page > .canonical-timeline { margin-top: 0; }
.canonical-prompt { margin: 22px 0 0; }
.trajectory-selection { display: grid; grid-template-columns: 1fr 1fr; gap: 70px; padding: 28px 22px; border-bottom: 1px solid #dce5ec; background: #f7f9fc; }
.trajectory-selection h2 { margin-top: 12px; font-size: 25px; line-height: 1.25; font-weight: 540; letter-spacing: -.03em; }
.trajectory-selection p { margin-top: 12px; color: #526b7b; font-size: 13px; line-height: 1.65; }
.trajectory-selection a { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 12px; font-weight: 620; }
.trajectory-lens-section { margin-top: 96px; }
.trajectory-lens-section > header { grid-template-columns: 1fr .8fr; }
.trajectory-lens-section .trajectory-scene { margin-top: 20px; }
.trajectory-audit-link { margin-top: 72px; }
.case-decision-sequence { margin: 28px 0 54px; border-top: 1px solid #dce5ec; }
.case-decision-sequence strong { display: block; margin-top: 17px; font-size: 20px; }
.case-decision-sequence .is-hold strong { color: #aa4933; }
.case-decision-sequence .is-ready strong { color: #416f64; }
.system-authorship { margin-top: 50px; }
.world-compiler-rail { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 8px 0 26px; border-top: 1px solid #dce5ec; border-bottom: 1px solid #dce5ec; }
.world-compiler-rail article { display: grid; grid-template-columns: 25px 1fr auto; gap: 10px; align-items: center; min-height: 76px; padding: 12px 14px; border-left: 1px solid #dce5ec; color: #83919c; }
.world-compiler-rail article:first-child { border-left: 0; }
.world-compiler-rail article.is-resolved { color: #18232c; }
.world-compiler-rail article > span { color: #315fe8; }
.world-compiler-rail strong { display: block; font-size: 12px; }
.world-compiler-rail small { display: block; margin-top: 3px; color: #526b7b; font-size: 10px; line-height: 1.35; }
.world-inline-diff { display: grid; grid-template-columns: 95px 1fr; gap: 18px; padding: 18px 0; border-bottom: 1px solid #dce5ec; }
.world-inline-diff ul { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0; padding: 0; list-style: none; }
.world-inline-diff li, .world-inline-diff p { color: #526b7b; font-size: 12px; line-height: 1.55; }

@media (max-width: 900px) {
  .journey-heading, .proof-heading, .home-current > header, .trajectory-lens-section > header { grid-template-columns: 1fr; gap: 18px; }
  .canonical-timeline { grid-template-columns: 1fr; }
  .timeline-period { border-left: 0; border-top: 1px solid #dce5ec; }
  .timeline-period:first-child { border-top: 0; }
  .causal-chain, .project-causal-summary, .case-decision-sequence { grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid #dce5ec; }
  .causal-chain article:nth-child(odd), .project-causal-summary article:nth-child(odd), .case-decision-sequence article:nth-child(odd) { border-left: 0; }
  .causal-chain article:nth-child(n+3), .project-causal-summary article:nth-child(n+3), .case-decision-sequence article:nth-child(n+3) { border-top: 1px solid #dce5ec; }
  .proof-contribution, .project-authorship { grid-template-columns: 125px 1fr; }
  .proof-contribution small, .project-authorship small, .proof-contribution a { grid-column: 2; }
  .world-compiler-rail { grid-template-columns: repeat(3, 1fr); }
  .world-compiler-rail article:nth-child(4) { border-left: 0; border-top: 1px solid #dce5ec; }
  .world-compiler-rail article:nth-child(5) { border-top: 1px solid #dce5ec; }
}

@media (max-width: 720px) {
  .home-journey, .home-proof, .home-current { padding-top: 64px; }
  .hero-horizons { margin-top: 0; }
  .home-journey .canonical-timeline { display: block; }
  .current-list { grid-template-columns: 1fr; }
  .current-list a, .current-list a:nth-child(odd), .current-list a:nth-child(even) { border-right: 0; padding: 20px 42px 22px 0; }
  .work-position { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .work-position > div { min-height: 96px; padding: 16px 12px; }
  .work-position strong { font-size: 11px; }
  .trajectory-selection { grid-template-columns: 1fr; gap: 25px; }
  .home-atlas-entry, .trajectory-audit-link { display: grid; align-items: start; }
}

@media (max-width: 480px) {
  .comprehension-home .hero { display: block; padding: 32px 20px 16px; }
  .comprehension-home .hero-copy h1 { font-size: 41px; line-height: 1.08; }
  .comprehension-home .hero-identity { margin-top: 22px; font-size: 16px; }
  .comprehension-home .hero-description, .comprehension-home .hero-footnote { display: none; }
  .comprehension-home .hero-actions { margin-top: 22px; gap: 10px 16px; }
  .comprehension-home .hero-gallery { margin-top: 24px; }
  .comprehension-home .home-stage { display: none; }
  .comprehension-home .hero-horizons { grid-template-columns: repeat(3, 1fr); }
  .comprehension-home .hero-horizons a { min-height: 124px; padding: 10px 9px; }
  .comprehension-home .hero-horizons strong { font-size: 11px; line-height: 1.32; }
  .comprehension-home .hero-horizons small, .comprehension-home .hero-horizons span { font-size: 9px; }
  .journey-heading h2, .proof-heading h2, .home-current h2, .home-atlas-entry h2 { font-size: 30px; }
  .canonical-timeline { display: block; }
  .timeline-period { padding: 24px 0 14px; }
  .timeline-period a, .timeline-period button { min-height: 64px; grid-template-columns: 48px 1fr auto; }
  .proof-selector button { min-width: 145px; }
  .causal-chain, .project-causal-summary { grid-template-columns: repeat(2, 1fr); }
  .causal-chain article, .project-causal-summary article { padding: 20px 12px; }
  .causal-chain p, .project-causal-summary p { font-size: 12px; }
  .proof-contribution, .project-authorship { grid-template-columns: 1fr; gap: 12px; padding: 22px 0; }
  .proof-contribution small, .project-authorship small, .proof-contribution a { grid-column: 1; }
  .proof-stage .science-layout { grid-template-columns: 1fr; }
  .work-position > div { padding: 14px 10px; }
  .work-position span { font-size: 8px; }
  .work-position strong { font-size: 10px; }
  .case-decision-sequence { grid-template-columns: repeat(2, 1fr); }
  .case-decision-sequence article { padding: 20px 12px; }
  .world-compiler-rail { grid-template-columns: repeat(3, 1fr); }
  .world-compiler-rail article { min-height: 74px; grid-template-columns: 22px 1fr; padding: 10px 8px; }
  .world-compiler-rail article svg { display: none; }
  .world-compiler-rail article:nth-child(4) { grid-column: 1 / 2; }
  .world-inline-diff { grid-template-columns: 1fr; gap: 9px; }
}
'''
p.write_text(s)

print("Applied comprehension-first architecture and explanatory layers.")
