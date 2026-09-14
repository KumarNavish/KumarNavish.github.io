from pathlib import Path
import hashlib
p=Path('modules/narrative/context-scenes.mjs');s=p.read_text();assert 'The archive pulls toward an outdated mean' in s;p.write_text(s.replace('The archive pulls toward an outdated mean','Pulled toward the past'))
p=Path('modules/narrative/geometry-scenes.mjs');s=p.read_text();assert "metric('Surface height','Probability density')" in s;p.write_text(s.replace("metric('Surface height','Probability density')","metric('Surface height','Density')"))
expected={'modules/worlds/label-layout.mjs':'db1bb5f40514b015393325063ca9b96b19f423b4ea2b16734c888b75b8466c6d','tests/label-layout.test.mjs':'82940e9eb408966906f3256977ef1d05239967126e6296f424cc7784dbbc17ed','modules/narrative/context-scenes.mjs':'2986c1d74649837297108fd2533236a9532d3713329a53957b7d112372106cea','modules/narrative/geometry-scenes.mjs':'c5a9ed388caffcfa195a05d49715d064e30593576b097f6d3f2fb7326e949917'}
for f,h in expected.items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h,f
print('EXACT_BOUNDARY_LAYOUT_AND_COMPACT_SCIENTIFIC_LABELS_VERIFIED')
