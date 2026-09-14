"""Await the rendered inspection-close transition, never a fixed delay.
The prior failure captured selected=-1 but a still-painted index=4: its
100-ms wait did not observe the new frame. Keep every visibility threshold.
"""
from pathlib import Path
p=Path('scripts/referent_checks.py');s=p.read_text()
old="   page.locator('[data-select=\"eigenmode\"]').select_option('-1');page.wait_for_timeout(100)"
new="""   before_frame=int(page.locator('.world-canvas').get_attribute('data-frame') or 0)
   page.locator('[data-select="eigenmode"]').select_option('-1')
   page.wait_for_function("before=>{const overlay=document.querySelector('.n-scene-overlay'),canvas=document.querySelector('.world-canvas');return overlay.dataset.eigenmode==='null'&&+canvas.dataset.frame>before;}",arg=before_frame)
""".rstrip()
assert old in s;s=s.replace(old,new);p.write_text(s)
print('Inspection-close acceptance awaits its real rendered frame; thresholds unchanged.')
