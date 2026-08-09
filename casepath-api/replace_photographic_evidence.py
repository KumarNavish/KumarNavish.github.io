#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps, ImageStat

PRIMARY_URL = "https://upload.wikimedia.org/wikipedia/commons/4/46/Schimmel-hinter-Sofa.jpg"
PRIMARY_SHA1 = "2f2b0db8db9b16b2509f802f87dca6f2761f95db"
LATER_URL = "https://upload.wikimedia.org/wikipedia/commons/d/df/Mold_on_wall1.jpg"
LATER_SHA1 = "d65830510a5f556f5d1f993ef6af4e30fd2efb07"


def download(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "CasePath photographic-evidence release builder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    if len(payload) < 100_000:
        raise RuntimeError(f"Photographic source is unexpectedly small: {url} ({len(payload)} bytes)")
    return payload


def validate_photo(payload: bytes, expected_sha1: str, label: str) -> tuple[Image.Image, str, str]:
    sha1 = hashlib.sha1(payload).hexdigest()
    sha256 = hashlib.sha256(payload).hexdigest()
    if sha1 != expected_sha1:
        raise RuntimeError(
            f"{label} source changed unexpectedly: expected SHA-1 {expected_sha1}, actual {sha1}"
        )
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(payload))).convert("RGB")
    if image.width < 800 or image.height < 500:
        raise RuntimeError(f"{label} photograph is too small: {image.size}")
    if sum(ImageStat.Stat(image).stddev) < 25:
        raise RuntimeError(f"{label} photograph has insufficient visual variation")
    return image, sha1, sha256


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: replace_photographic_evidence.py <repository-or-runtime-root>")

    root = Path(sys.argv[1]).resolve()
    artifacts = root / "casepath-api" / "artifacts"
    package = root / "casepath-api" / "casepath_api"
    artifacts.mkdir(parents=True, exist_ok=True)

    primary_payload = download(PRIMARY_URL)
    primary_image, primary_sha1, primary_sha256 = validate_photo(
        primary_payload, PRIMARY_SHA1, "Flagship"
    )
    primary_path = artifacts / "bedroom-mould-2026-07-27.jpg"
    primary_path.write_bytes(primary_payload)

    later_payload = download(LATER_URL)
    later_image, later_sha1, later_sha256 = validate_photo(
        later_payload, LATER_SHA1, "Later-claim"
    )
    later_path = artifacts / "later-window-condensation-2026-08-12.jpg"
    later_path.write_bytes(later_payload)

    if primary_sha256 == later_sha256:
        raise RuntimeError("The two deployed evidence photographs are byte-identical")

    attribution = f"""# Evidence image attribution

CasePath uses licensed source photographs inside fictional research claim packages. The photographs are not represented as images from a real insured person or a real insurance claim.

## bedroom-mould-2026-07-27.jpg
- Source: {PRIMARY_URL}
- Source SHA-1: {primary_sha1}
- Source SHA-256: {primary_sha256}
- Credit: Energiesorgenfrei, Wikimedia Commons
- Licence: CC BY-SA 3.0 Germany
- Processing: none; the source JPEG is stored byte-for-byte.

## later-window-condensation-2026-08-12.jpg
- Source: {LATER_URL}
- Source SHA-1: {later_sha1}
- Source SHA-256: {later_sha256}
- Credit: שי אבידן, Wikimedia Commons
- Licence: CC BY-SA 4.0
- Processing: none; the source JPEG is stored byte-for-byte.
"""
    (artifacts / "IMAGE_ATTRIBUTION.md").write_text(attribution, encoding="utf-8")

    data_candidates = [package / "data_v12.py", package / "data.py"]
    data_file = next((candidate for candidate in data_candidates if candidate.exists()), None)
    if data_file is None:
        raise RuntimeError(f"No CasePath data module was found under {package}")
    data = data_file.read_text(encoding="utf-8")
    for old, new in [
        ("Generated source photograph", "Customer-supplied photograph"),
        ("Generated photograph", "Customer-supplied photograph"),
        ("generated source photograph", "customer-supplied photograph"),
        ("Generated source photograph of condensation", "Customer-supplied photograph of visible spotting"),
    ]:
        data = data.replace(old, new)
    data_file.write_text(data, encoding="utf-8")

    print(
        "Photographic evidence prepared",
        {
            "primary_size": primary_image.size,
            "primary_sha1": primary_sha1,
            "primary_sha256": primary_sha256,
            "later_size": later_image.size,
            "later_sha1": later_sha1,
            "later_sha256": later_sha256,
            "data_module": data_file.name,
        },
    )


if __name__ == "__main__":
    main()
