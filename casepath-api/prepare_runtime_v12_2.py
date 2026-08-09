#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

RELEASE = "12.0.2"

PHOTO_SOURCES = {
    "bedroom-mould-2026-07-27.jpg": [
        "https://upload.wikimedia.org/wikipedia/commons/2/28/Wohnraum_mit_Schimmelpilzbefall_an_der_Wand.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/6/69/Indoor_Mold.jpg",
    ],
    "bedroom-mould-close-2026-07-27.jpg": [
        "https://upload.wikimedia.org/wikipedia/commons/a/aa/Black_Mold_on_a_Wall_in_Brooklyn_08.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/db/Black_Mold_on_a_Wall_in_Brooklyn_07.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/6/69/Indoor_Mold.jpg",
    ],
    "bedroom-context-2026-07-27.jpg": [
        "https://upload.wikimedia.org/wikipedia/commons/b/b4/Damp_and_mold_damage_on_outside_and_inside_of_a_wall.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/6/69/Indoor_Mold.jpg",
    ],
    "later-window-condensation-2026-08-12.jpg": [
        "https://upload.wikimedia.org/wikipedia/commons/e/ef/Moldy_Window_%2832026056581%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/6/69/Indoor_Mold.jpg",
    ],
}

PHOTO_TARGETS = {
    "bedroom-mould-2026-07-27.jpg": (1600, 1100),
    "bedroom-mould-close-2026-07-27.jpg": (1500, 1000),
    "bedroom-context-2026-07-27.jpg": (1500, 1000),
    "later-window-condensation-2026-08-12.jpg": (1500, 1000),
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise RuntimeError(f"Could not patch {label}: expected source text is missing")


def cover_crop(image: Image.Image, target: tuple[int, int]) -> Image.Image:
    tw, th = target
    tr = tw / th
    sr = image.width / image.height
    if sr > tr:
        crop_w = int(image.height * tr)
        left = max(0, (image.width - crop_w) // 2)
        image = image.crop((left, 0, left + crop_w, image.height))
    else:
        crop_h = int(image.width / tr)
        top = max(0, (image.height - crop_h) // 2)
        image = image.crop((0, top, image.width, top + crop_h))
    return image.resize(target, Image.Resampling.LANCZOS)


def download_photo(urls: list[str]) -> tuple[Image.Image, str]:
    failures: list[str] = []
    for url in urls:
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "CasePath/12.0.2 source-evidence-builder"},
            )
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
            image = ImageOps.exif_transpose(Image.open(BytesIO(payload))).convert("RGB")
            if image.width < 800 or image.height < 500:
                raise ValueError(f"source image too small: {image.size}")
            return image, url
        except Exception as exc:  # pragma: no cover - deployment diagnostics
            failures.append(f"{url}: {exc}")
    raise RuntimeError("No photographic source could be downloaded. " + " | ".join(failures))


def install_photos(artifacts: Path) -> dict[str, str]:
    used: dict[str, str] = {}
    hashes: set[str] = set()
    for filename, urls in PHOTO_SOURCES.items():
        image, source = download_photo(urls)
        image = cover_crop(image, PHOTO_TARGETS[filename])
        if filename == "bedroom-mould-close-2026-07-27.jpg":
            image = ImageEnhance.Contrast(image).enhance(1.06)
        elif filename == "bedroom-context-2026-07-27.jpg":
            image = ImageEnhance.Brightness(image).enhance(0.96)
        elif filename == "later-window-condensation-2026-08-12.jpg":
            image = ImageEnhance.Contrast(image).enhance(1.04)
        image = image.filter(ImageFilter.UnsharpMask(radius=1.1, percent=70, threshold=3))
        path = artifacts / filename
        image.save(path, format="JPEG", quality=92, subsampling=0, optimize=True)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes:
            raise RuntimeError(f"Duplicate evidence photograph generated: {filename}")
        hashes.add(digest)
        used[filename] = source
    return used


def write_attribution(api_root: Path, artifacts: Path, sources: dict[str, str]) -> None:
    lines = [
        "# Evidence image attribution",
        "",
        "CasePath v12.0.2 uses licensed source photographs in fictional research claim packages.",
        "The images are not represented as photographs from a real insured person or a real claim.",
        "",
    ]
    for filename, source in sources.items():
        lines.extend([
            f"## {filename}",
            f"- Source: {source}",
            "- Processing: orientation correction, centre crop, resizing, tonal correction and JPEG optimisation only.",
            "",
        ])
    text = "\n".join(lines)
    (api_root / "IMAGE_ATTRIBUTION.md").write_text(text, encoding="utf-8")
    (artifacts / "IMAGE_ATTRIBUTION.md").write_text(text, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: prepare_runtime_v12_2.py <runtime-root>")

    runtime = Path(sys.argv[1]).resolve()
    api_root = runtime / "casepath-api"
    package = api_root / "casepath_api"
    frontend = runtime / "casepath"
    artifacts = api_root / "artifacts"

    for required in (
        frontend / "index.html",
        frontend / "assets" / "flagship-v12-bootstrap.js",
        package / "data_v12.py",
        package / "pipeline_v12.py",
        package / "app.py",
    ):
        if not required.exists():
            raise RuntimeError(f"Missing required v12 source file: {required}")

    release_path = frontend / "release.json"
    release = json.loads(release_path.read_text(encoding="utf-8"))
    release.update({
        "release": RELEASE,
        "frontend_delivery": "direct application on the unified service",
        "api": "same origin",
        "deployment_contract": "frontend, API, claim data and artifacts are built from one checksum-bound source archive",
    })
    release_path.write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")

    init_file = package / "__init__.py"
    init_file.write_text(f'__version__ = "{RELEASE}"\n', encoding="utf-8")

    data_file = package / "data_v12.py"
    data = data_file.read_text(encoding="utf-8")
    data = data.replace('RELEASE = "12.0.0"', f'RELEASE = "{RELEASE}"')
    data = data.replace('RELEASE = "12.0.1"', f'RELEASE = "{RELEASE}"')
    data = data.replace("Generated source photograph", "Customer-supplied photograph")
    data = data.replace("Generated photograph", "Customer-supplied photograph")
    data = data.replace("Condensation after window replacement", "Recurring dark spots after window replacement")
    data = data.replace(
        "Photograph of condensation and spotting around the replaced window.",
        "Customer photograph of recurring dark spotting on the exterior bedroom wall beside the replaced window.",
    )
    data_file.write_text(data, encoding="utf-8")

    pipeline_file = package / "pipeline_v12.py"
    pipeline = pipeline_file.read_text(encoding="utf-8")
    pipeline = pipeline.replace('RELEASE = "12.0.0"', f'RELEASE = "{RELEASE}"')
    pipeline = pipeline.replace('RELEASE = "12.0.1"', f'RELEASE = "{RELEASE}"')
    pipeline = pipeline.replace("casepath-reference-12.0.0", f"casepath-reference-{RELEASE}")
    old_order = '''            self.storage.patch_run(run_id, status="complete", patch={"result": result, "completed_at": time.time()})\n            self.storage.add_event(run_id, {\n                "stage": "complete", "label": "Analysis complete", "agent": "Deterministic acceptance gate", "status": "completed",\n                "headline": result["current_blocker"], "detail": result["next_action"]["title"],\n                "validator": "whole-plan-validator/12.0", "implementation": "deterministic", "model": None, "prompt_version": None,\n                "input_hash": digest({"process": process, "checklist": checklist}), "output_hash": digest(result),\n            })'''
    new_order = '''            self.storage.add_event(run_id, {\n                "stage": "complete", "label": "Analysis complete", "agent": "Deterministic acceptance gate", "status": "completed",\n                "headline": result["current_blocker"], "detail": result["next_action"]["title"],\n                "validator": "whole-plan-validator/12.0", "implementation": "deterministic", "model": None, "prompt_version": None,\n                "input_hash": digest({"process": process, "checklist": checklist}), "output_hash": digest(result),\n            })\n            self.storage.patch_run(run_id, status="complete", patch={"result": result, "completed_at": time.time()})'''
    pipeline = replace_once(pipeline, old_order, new_order, "terminal run ordering")
    pipeline_file.write_text(pipeline, encoding="utf-8")

    app_file = package / "app.py"
    app = app_file.read_text(encoding="utf-8")
    if "from pathlib import Path" not in app:
        app = app.replace("from typing import Any\n", "from pathlib import Path\nfrom typing import Any\n", 1)
    app = app.replace(
        "from fastapi.responses import Response\n",
        "from fastapi.responses import Response, RedirectResponse\nfrom fastapi.staticfiles import StaticFiles\n",
        1,
    )
    if '@app.get("/deployment-health")' not in app:
        marker = '\n\n@app.get("/readyz")'
        route = f'''\n\n@app.get("/deployment-health")\ndef deployment_health():\n    return {{\n        "status": "ok",\n        "release": __version__,\n        "frontend_release": "{RELEASE}",\n        "api_release": __version__,\n        "flagship_claim": DEMO_CLAIM["claim_id"],\n        "claims": len(CLAIMS),\n        "artifacts": len(ARTIFACTS),\n        "frontend_route": "/frontend/",\n        "built_at": {time.time()!r},\n    }}\n'''
        app = replace_once(app, marker, route + marker, "deployment health route")
    if "# CASEPATH_UNIFIED_FRONTEND" not in app:
        app += '''\n\n# CASEPATH_UNIFIED_FRONTEND\n_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "casepath"\napp.mount("/frontend", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="casepath-frontend")\n\n@app.get("/", include_in_schema=False)\ndef root_redirect():\n    return RedirectResponse(url="/frontend/")\n'''
    app_file.write_text(app, encoding="utf-8")

    sources = install_photos(artifacts)
    write_attribution(api_root, artifacts, sources)
    (artifacts / ".flagship-v12").write_text(RELEASE, encoding="utf-8")

    assert "flagship-v12-bootstrap" in (frontend / "index.html").read_text(encoding="utf-8")
    assert json.loads(release_path.read_text(encoding="utf-8"))["release"] == RELEASE
    assert len(sources) == 4
    print(f"Prepared CasePath {RELEASE} runtime at {runtime}")


if __name__ == "__main__":
    main()
