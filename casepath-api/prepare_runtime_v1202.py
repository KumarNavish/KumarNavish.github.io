#!/usr/bin/env python3
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

RELEASE = "12.0.2"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise RuntimeError(f"Could not patch {label}: expected source text is missing")
    return text.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: prepare_runtime_v1202.py <runtime-root>")

    runtime = Path(sys.argv[1]).resolve()
    repo = Path(__file__).resolve().parents[1]
    api_root = runtime / "casepath-api"
    package = api_root / "casepath_api"
    artifacts = api_root / "artifacts"

    # The canonical public site serves the complete application directly. The
    # API-mounted copy is a diagnostic fallback and must be byte-identical.
    frontend = runtime / "casepath"
    if frontend.exists():
        shutil.rmtree(frontend)
    shutil.copytree(repo / "casepath", frontend)

    (package / "__init__.py").write_text(f'__version__ = "{RELEASE}"\n', encoding="utf-8")

    data_file = package / "data_v12.py"
    if not data_file.exists():
        raise RuntimeError("The reconstructed runtime does not contain data_v12.py")
    data = data_file.read_text(encoding="utf-8")
    data = data.replace('RELEASE = "12.0.0"', f'RELEASE = "{RELEASE}"')
    data = data.replace('RELEASE = "12.0.1"', f'RELEASE = "{RELEASE}"')
    data = data.replace(
        '"Original email reporting condensation after window replacement."',
        '"Original email reporting recurring dark spotting beside the replaced bedroom window."',
    )
    data = data.replace('"Window-corner photograph"', '"Exterior-wall photograph"')
    data = data.replace(
        '"Photograph of condensation and spotting around the replaced window."',
        '"Customer photograph of recurring dark spotting on the exterior bedroom wall beside the replaced window."',
    )
    data = data.replace('"Condensation after window replacement"', '"Recurring dark spots after window replacement"')
    data = data.replace('"Condensation after window replacement."', '"Recurring mould beside a replaced window."')
    data_file.write_text(data, encoding="utf-8")

    pipeline_file = package / "pipeline_v12.py"
    if not pipeline_file.exists():
        raise RuntimeError("The reconstructed runtime does not contain pipeline_v12.py")
    pipeline = pipeline_file.read_text(encoding="utf-8")
    pipeline = pipeline.replace('RELEASE = "12.0.0"', f'RELEASE = "{RELEASE}"')
    pipeline = pipeline.replace('RELEASE = "12.0.1"', f'RELEASE = "{RELEASE}"')
    pipeline = pipeline.replace('casepath-reference-12.0.0', f'casepath-reference-{RELEASE}')
    pipeline = pipeline.replace('casepath-reference-12.0.1', f'casepath-reference-{RELEASE}')

    # Do not expose status=complete before the terminal event is durable. The
    # browser and test suite both wait for complete and then inspect the audit.
    old_order = '''            self.storage.patch_run(run_id, status="complete", patch={"result": result, "completed_at": time.time()})\n            self.storage.add_event(run_id, {\n                "stage": "complete", "label": "Analysis complete", "agent": "Deterministic acceptance gate", "status": "completed",\n                "headline": result["current_blocker"], "detail": result["next_action"]["title"],\n                "validator": "whole-plan-validator/12.0", "implementation": "deterministic", "model": None, "prompt_version": None,\n                "input_hash": digest({"process": process, "checklist": checklist}), "output_hash": digest(result),\n            })'''
    new_order = '''            self.storage.add_event(run_id, {\n                "stage": "complete", "label": "Analysis complete", "agent": "Deterministic acceptance gate", "status": "completed",\n                "headline": result["current_blocker"], "detail": result["next_action"]["title"],\n                "validator": "whole-plan-validator/12.0", "implementation": "deterministic", "model": None, "prompt_version": None,\n                "input_hash": digest({"process": process, "checklist": checklist}), "output_hash": digest(result),\n            })\n            self.storage.patch_run(run_id, status="complete", patch={"result": result, "completed_at": time.time()})'''
    if old_order in pipeline:
        pipeline = pipeline.replace(old_order, new_order, 1)
    pipeline_file.write_text(pipeline, encoding="utf-8")

    app_file = package / "app.py"
    app = app_file.read_text(encoding="utf-8")
    app = app.replace(
        'from .data import ARTIFACTS, CLAIMS, DEMO_CLAIM, LATER_CLAIM, public_artifact, public_claim',
        'from .data_v12 import ARTIFACTS, CLAIMS, DEMO_CLAIM, LATER_CLAIM, public_artifact, public_claim',
    )
    app = app.replace('from .pipeline import ClaimPipeline', 'from .pipeline_v12 import ClaimPipeline')
    if 'from pathlib import Path\n' not in app:
        app = app.replace('from __future__ import annotations\n\n', 'from __future__ import annotations\n\nfrom pathlib import Path\n')
    app = app.replace(
        'from fastapi.responses import Response\n',
        'from fastapi.responses import Response, RedirectResponse\nfrom fastapi.staticfiles import StaticFiles\n',
    )
    app = app.replace(
        'return {"items":[public_claim(DEMO_CLAIM),public_claim(LATER_CLAIM)]}',
        'return {"items":[public_claim(item) for item in CLAIMS.values()]}',
    )

    deployment_route = f'''\n\n@app.get("/deployment-health")\ndef deployment_health():\n    return {{\n        "status": "ok",\n        "release": __version__,\n        "frontend_release": __version__,\n        "api_release": __version__,\n        "flagship_claim": DEMO_CLAIM["claim_id"],\n        "claims": len(CLAIMS),\n        "artifacts": len(ARTIFACTS),\n        "frontend_route": "/frontend/",\n        "data_module": "data_v12",\n        "pipeline_module": "pipeline_v12",\n    }}\n'''
    if '@app.get("/deployment-health")' not in app:
        app = replace_once(app, '\n\n@app.get("/readyz")', deployment_route + '\n@app.get("/readyz")', "deployment health route")

    static_mount = '''\n\n# CASEPATH_STATIC_FRONTEND\n_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "casepath"\nif _FRONTEND_DIR.exists():\n    app.mount("/frontend", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="casepath-frontend")\n\n\n@app.get("/", include_in_schema=False)\ndef root_redirect():\n    return RedirectResponse(url="/frontend/")\n'''
    if "# CASEPATH_STATIC_FRONTEND" not in app:
        app += static_mount
    app_file.write_text(app, encoding="utf-8")

    # Replace the former vector-style later-claim illustration with a visibly
    # photographic crop of a source photo already included in the package.
    later_email = artifacts / "later-claim-email.eml"
    later_email.write_text(
        """From: Sam Keller <sam.keller@example.ch>\nTo: Protekta Legal Protection <claims@protekta.ch>\nDate: Fri, 14 Aug 2026 09:46:00 +0200\nSubject: Dark spots returned beside the replaced bedroom window\nMessage-ID: <later-claim-20260814@example.ch>\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\n\nHello,\n\nThe dark spots have returned on the outside bedroom wall beside the window that was replaced in May. I cleaned the wall once, but the marks came back after several humid days.\n\nThe property manager says that we probably do not air the room enough. Nobody has inspected the wall or measured the moisture. I attached a current photograph and the notice for the window works.\n\nCould you tell me what should happen next and what evidence is still needed?\n\nKind regards,\nSam Keller\n""",
        encoding="utf-8",
    )
    source = Image.open(artifacts / "bedroom-context-2026-07-27.jpg").convert("RGB")
    width, height = source.size
    later = source.crop((int(width * .08), int(height * .02), int(width * .92), int(height * .98)))
    later = later.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    later = ImageEnhance.Brightness(later).enhance(.92)
    later = ImageEnhance.Contrast(later).enhance(1.07)
    later = later.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=3))
    later.thumbnail((1500, 1000), Image.Resampling.LANCZOS)
    later.save(artifacts / "later-window-condensation-2026-08-12.jpg", format="JPEG", quality=88, optimize=True)

    (artifacts / ".flagship-v12").write_text(RELEASE, encoding="utf-8")

    index_text = (frontend / "index.html").read_text(encoding="utf-8")
    release_text = (frontend / "release.json").read_text(encoding="utf-8")
    assert "Waiting for the v12.0.1 workspace" not in index_text
    assert "frontend/index.html" not in index_text
    assert f'"release": "{RELEASE}"' in release_text
    assert 'from .data_v12 import' in app
    assert 'from .pipeline_v12 import' in app
    print(f"Prepared CasePath runtime {RELEASE} at {runtime}")


if __name__ == "__main__":
    main()
