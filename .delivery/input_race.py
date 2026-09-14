from pathlib import Path
import hashlib
p=Path('modules/narrative/director.mjs');s=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='14abf1c2091b9980377cca4826bdcb279d3e7da12c44addfa23c459e2c9606c9'
s=s.replace('  const savedProgress=lastProgress,savedMode=lastMode,offset=lastScrollY-oldExplore;', '''  // A ResizeObserver callback can arrive after a new scroll but before its frame.
  // Preserve that newer input, not the obsolete rendered chapter. A real viewport
  // resize is different: its browser-induced scroll must retain the reader's p.
  const viewportChanged=layoutWidth!==innerWidth||layoutHeight!==innerHeight;
  const pendingScroll=before.length&&!viewportChanged&&Math.abs(scrollY-lastScrollY)>.5;
  const savedProgress=pendingScroll?progressFromAnchors(scrollY,before):lastProgress;
  const savedMode=pendingScroll?(scrollY>=oldExplore?'explore':'guide'):lastMode;
  const offset=(pendingScroll?scrollY:lastScrollY)-oldExplore;''')
s=s.replace('   lastScrollY=scrollY;\n  }', '''   // Further observer deliveries in this layout transaction inherit the same
   // reconciled position, even if the frame has not painted yet.
   lastProgress=savedProgress;lastMode=savedMode;lastScrollY=scrollY;
  }''')
p.write_text(s)
assert hashlib.sha256(p.read_bytes()).hexdigest()=='710c23b89d0253544241bec628a7a30abdd25bcc95b949e39fd98ea2d86c6745'
print('INPUT_RACE_PATCH_VERIFIED')
