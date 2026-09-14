from pathlib import Path
import hashlib
p=Path('narrative.css');assert hashlib.sha256(p.read_bytes()).hexdigest()=='8f287b5249e38d2aeec6c7b8fd35e75cf634f9d50e4fabe8c723a0323c47aca1'
p.write_text(p.read_text()+'''
/* Preserve the geometry's reading lane: metadata becomes a compact key.
   Redundant headings remain available to assistive technology. */
@media(max-width:520px){
 .scroll-narrative .n-budget{padding:6px 8px}
 .scroll-narrative .n-budget>.n-small,.scroll-narrative .n-buffer>.n-small,.scroll-narrative .n-buffer .n-independence{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
 .scroll-narrative .n-budget-cells{margin:4px 0}
 .scroll-narrative .n-budget>strong{display:block;font-size:10px;line-height:1.35}
 .scroll-narrative .n-buffer{left:9px;right:9px;top:9px;max-width:none;padding:6px 8px;display:flex;flex-wrap:wrap;align-items:center;gap:5px 9px}
 .scroll-narrative .n-buffer>div{margin:0;gap:4px}
 .scroll-narrative .n-buffer>strong{margin:0;font-size:9px}
 .scroll-narrative .n-buffer b{padding:3px 5px;font-size:10px}
}
''')
p=Path('modules/narrative/geometry-scenes.mjs');assert hashlib.sha256(p.read_bytes()).hexdigest()=='6b30382b66b15ce505283de22604e29ad6c7950b2c237d82250d988bbeacb79b'
s=p.read_text();old='${s.selected.length} memories · ${s.directions} independent directions';new='${s.selected.length} ${s.selected.length===1?\'memory\':\'memories\'} · ${s.directions} <span class="n-independence">independent </span>${s.directions===1?\'direction\':\'directions\'}';assert old in s;p.write_text(s.replace(old,new))
p=Path('scripts/annotation_checks.py');s=p.read_text();s=s.replace(';raise AssertionError(item)','')
s=s.replace("if work=='experience-replay' and at==1", "if work=='tic-lm' and at>=.8 or work=='experience-replay' and at==1")
s=s.replace('  assert not errors','  # Collect all final-size regressions in one pass, then reject the release.\n  assert not errors\n  assert all(item[\'passed\'] for item in checks),json.dumps([item for item in checks if not item[\'passed\']])')
p.write_text(s)
expected={'narrative.css':'ad7e4f149bbcfcbaeaf6f61d52f19b77200015ff591a020ebd9d1ed8a05263c3','modules/narrative/geometry-scenes.mjs':'1dc017aaa37ee879bf3e7cabcfe23736a9297538919f353e4a84d5f59b3edb3d','scripts/annotation_checks.py':'fdb4063a5b0e3980e2b2fbf1b15fcc077ffed1f8cbd097dfbf03bc6dea190a85'}
for f,h in expected.items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
print('COMPACT_READING_SOURCE_VERIFIED')
