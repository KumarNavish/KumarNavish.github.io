"""One-time, deterministic upgrade of the pinned v1 source. No remote execution or model call.
New modules are ordinary repository files. This recipe avoids duplicating unchanged source
in transport; the final materialized files are byte-checked against the authored manifest.
"""
from pathlib import Path
import hashlib,json,re,subprocess
root=Path.cwd()
changes={
 'modules/app.mjs':[
  ("import {mountDemo} from './demos.mjs';","import {mountDemo} from './demos.mjs';\nimport {mountTimelineScenes} from './timeline-scenes.mjs';"),
  ("document.title='Navish Kumar — A body of work, in motion';","document.title='Navish Kumar — A body of work, in motion';dispose=mountTimelineScenes(main);")],
 'modules/content.mjs':[("The wide ellipse is a Gaussian approximation. The dashed ellipse is the target posterior in this analytic example.","The jade surface is the Gaussian approximation. Gold contours show the target posterior in this analytic example.")],
 'modules/demos.mjs':[
  ("import {esc} from './render.mjs';","import {esc} from './render.mjs';\nimport {mountProjectScene} from './studio.mjs';"),
  ('<div class="lab-visual" data-viz></div>','<div class="lab-visual"><div class="reference-visual" data-viz></div></div>'),
  ('JSON.stringify({steps,method,kl:s.kl,m:s.m,c:s.c})','JSON.stringify({steps,method,kl:s.kl,m:s.m,c:s.c,path:s.path})'),
  ('JSON.stringify(s);ui.viz.innerHTML=`<div class="time-strip">','JSON.stringify({...s,stable});ui.viz.innerHTML=`<div class="time-strip">'),
  ('return factory(root,onExplore);}', 'const model=factory(root,onExplore),scene=mountProjectScene(work,root);return {...model,dispose(){model.dispose?.();scene.dispose();}};}'),
  ('The ellipse and error trace come from the update equations.','The surface and its KL error come from the update equations.')],
 'modules/world.mjs':[
  ("}else if(i===2){selected='microscope-1';renderer?.rotate(.45);draw();", "}else if(i===2){if(!store.state.created)commit(createLaboratory(store.state),'Created laboratory');selected='microscope-1';renderer?.resetCamera();renderer?.rotate(.15);draw();"),
  ("say(diffWorld(store.state,next).join(' · ')||'Object moved; identity preserved.');", "say('Object moved; its identity is preserved. Inspect the recorded coordinate change below.');")],
 'scripts/build.mjs':[
  ('./styles.css?v=living-1','./styles.css?v=studio-2'),
  ('<title>Navish Kumar — A body of work, in motion</title>','<link rel="stylesheet" href="./studio.css?v=studio-2"><title>Navish Kumar — A body of work, in motion</title>'),
  ('./modules/app.mjs?v=living-1','./modules/app.mjs?v=studio-2'),
  ('<meta name="theme-color"','<meta name="portfolio-release" content="studio-2"><meta name="theme-color"')],
 'package.json':[( '"version":"1.0.0"','"version":"2.0.0"')],
 'sitemap.xml':[( '2026-09-12','2026-09-13')]
}

changes['modules/world.mjs'].append(('Drag to orbit · Scroll to zoom · Drag an object to move','Drag to orbit · + / − to zoom · Drag an object to move'))
changes['modules/studio.mjs']=[
 ("case'time':return {text:s.benefit>=0?", "case'time':return s.month>=10&&!s.stable&&s.benefit>=0?{text:'The drift-aware mixture is working here. Compare it with a fixed allocation.',action:'Try a fixed 50% replay mixture',target:'fixed-mixture'}:{text:s.benefit>=0?"),
 ("else if(id==='advance'){", "else if(id==='fixed-mixture')input('fraction',50);\n  else if(id==='advance'){"),
 ("'This is the computed Gaussian update, not an animated promise of convergence.'", "'The target stays fixed. The update moves the approximation toward it.'"),
 ("action:'Include the missing memory',target:'memories'", "action:'Complete the memory set',target:'memories'"),
 ("else if(id==='memories')input('memory-b',!state.memories[1],'change');", "else if(id==='memories'){if(state.missing>1e-9){input('memory-a',true,'change');input('memory-b',true,'change');}else input('memory-b',false,'change');}")]
changes['scripts/browser_acceptance.py']=[("page.locator('.experience').screenshot(path=str(out/(work+'-desktop.png')))", 'page.evaluate("document.activeElement?.blur();window.scrollTo({top:0,behavior:\'instant\'})");page.screenshot(path=str(out/(work+\'-desktop.png\')),full_page=True)'), ("page.locator('.experience').screenshot(path=str(out/(work+'-mobile.png')))", 'page.evaluate("document.activeElement?.blur();window.scrollTo({top:0,behavior:\'instant\'})");page.screenshot(path=str(out/(work+\'-mobile.png\')),full_page=True)'), (" go('spatial-world');page.locator('[data-reset]').click();before=state();", ' go(\'experience-replay\')\n for memories in [(False,False),(False,True),(True,False)]:\n  page.locator(\'[data-stage="2"]\').click()\n  for selector,selected in zip([\'#memory-a\',\'#memory-b\'],memories):page.locator(selector).set_checked(selected)\n  page.locator(\'[data-next]\').click();page.wait_for_timeout(100)\n  check(\'replay / complete memory set \'+str(memories),state()[\'missing\']==0 and all(state()[\'memories\']))\n go(\'spatial-world\');page.locator(\'[data-reset]\').click();before=state();')]
changes['tests/studio.test.mjs']=[("test('flow motion changes routed geometry without changing the underlying result',()=>{const s=examples.interaction;assert.notDeepEqual(buildScene('interaction',s,0).data,buildScene('interaction',s,1.4).data);assert.equal(s.messages,8);});\n", "test('flow motion changes routed geometry without changing the underlying result',()=>{const s=examples.interaction;assert.notDeepEqual(buildScene('interaction',s,0).data,buildScene('interaction',s,1.4).data);assert.equal(s.messages,8);});\ntest('a drift-adapted final time state suggests a different comparison, not an inert advance',()=>{const s=timeExample(10);const adapted=timeExample(10,s.optimalFraction);assert.equal(sceneAdvice('time',adapted).target,'fixed-mixture');assert.ok(timeExample(10,.5).error>adapted.error);});\n")]
for filename,pairs in changes.items():
 p=root/filename;s=p.read_text()
 for old,new in pairs:
  if s.count(old)!=1:raise RuntimeError(f'Unexpected source for {filename}: replacement count {s.count(old)}')
  s=s.replace(old,new)
 p.write_text(s)
for p in (root/'modules').glob('*.mjs'):
 s=p.read_text();s=re.sub(r"(['\"])(\./[\w-]+\.mjs)\1",lambda m:m[1]+m[2]+'?v=studio-2'+m[1],s);p.write_text(s)
subprocess.run(['node','scripts/build.mjs'],check=True)
manifest=json.loads((root/'.delivery/expected-source.json').read_text())
for filename,digest in manifest.items():
 actual=hashlib.sha256((root/filename).read_bytes()).hexdigest()
 if actual!=digest:raise RuntimeError(f'Authored-source mismatch: {filename}, got {actual}, expected {digest}')
print('AUTHORED_SOURCE_MATCH',len(manifest),'files')
