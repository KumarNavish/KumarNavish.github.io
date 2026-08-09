#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

PRIMARY_URL = "https://upload.wikimedia.org/wikipedia/commons/2/28/Wohnraum_mit_Schimmelpilzbefall_an_der_Wand.jpg"
PRIMARY_SHA256 = "6a3f2cbeb270c21628f0d814d852895dbcff5e0cc8cf04502ca7d5cd7dfba732"
LATER_URLS = [
    "https://upload.wikimedia.org/wikipedia/commons/e/ef/Moldy_Window_%2832026056581%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/a/aa/Black_Mold_on_a_Wall_in_Brooklyn_08.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/d/db/Black_Mold_on_a_Wall_in_Brooklyn_07.jpg",
]


def download(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "CasePath photographic-evidence release builder"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    if len(payload) < 80_000:
        raise RuntimeError(f"Photographic source is unexpectedly small: {url} ({len(payload)} bytes)")
    return payload


def valid_photo(payload: bytes) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(payload))).convert("RGB")
    if image.width < 800 or image.height < 500:
        raise RuntimeError(f"Photographic source is too small: {image.size}")
    if sum(ImageStat.Stat(image).stddev) < 25:
        raise RuntimeError("Photographic source has insufficient visual variation")
    return image


def download_first(urls: list[str]) -> tuple[bytes, Image.Image, str]:
    failures: list[str] = []
    for url in urls:
        try:
            payload = download(url)
            return payload, valid_photo(payload), url
        except Exception as exc:
            failures.append(f"{url}: {exc}")
    raise RuntimeError("No approved photographic source could be downloaded. " + " | ".join(failures))


def cover_crop(image: Image.Image, target: tuple[int, int]) -> Image.Image:
    target_width, target_height = target
    target_ratio = target_width / target_height
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = int(image.height * target_ratio)
        left = max(0, (image.width - crop_width) // 2)
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = int(image.width / target_ratio)
        top = max(0, (image.height - crop_height) // 2)
        image = image.crop((0, top, image.width, top + crop_height))
    return image.resize(target, Image.Resampling.LANCZOS)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: replace_photographic_evidence.py <repository-or-runtime-root>")

    runtime = Path(sys.argv[1]).resolve()
    artifacts = runtime / "casepath-api" / "artifacts"
    package = runtime / "casepath-api" / "casepath_api"
    artifacts.mkdir(parents=True, exist_ok=True)

    primary_payload = download(PRIMARY_URL)
    primary_image = valid_photo(primary_payload)
    primary_hash = hashlib.sha256(primary_payload).hexdigest()
    if primary_hash != PRIMARY_SHA256:
        raise RuntimeError(
            "The flagship photographic source changed unexpectedly: "
            f"expected={PRIMARY_SHA256} actual={primary_hash}"
        )
    (artifacts / "bedroom-mould-2026-07-27.jpg").write_bytes(primary_payload)

    later_payload, later_image, later_url = download_first(LATER_URLS)
    later = cover_crop(later_image, (1500, 1000))
    later = ImageEnhance.Brightness(later).enhance(0.94)
    later = ImageEnhance.Contrast(later).enhance(1.06)
    later = later.filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=3))
    later_path = artifacts / "later-window-condensation-2026-08-12.jpg"
    later.save(later_path, format="JPEG", quality=91, optimize=True, subsampling=0)

    later_hash = hashlib.sha256(later_path.read_bytes()).hexdigest()
    if later_hash == primary_hash:
        raise RuntimeError("The two deployed evidence photographs are byte-identical")

    attribution = f"""# Evidence image attribution

CasePath uses licensed source photographs inside fictional research claim packages. The photographs are not represented as images from a real insured person or a real insurance claim.

## bedroom-mould-2026-07-27.jpg
- Source: {PRIMARY_URL}
- Credit: Bärbel Winkler, Wikimedia Commons
- Licence: CC BY-SA 4.0
- Processing: none; the source JPEG is stored byte-for-byte.

## later-window-condensation-2026-08-12.jpg
- Source: {later_url}
- Source SHA-256: {hashlib.sha256(later_payload).hexdigest()}
- Processing: orientation correction, centre crop, resizing, tonal adjustment and JPEG optimisation; no illustrated reconstruction.
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
            "primary_sha256": primary_hash,
            "later_size": later.size,
            "later_sha256": later_hash,
            "later_source": later_url,
            "data_module": data_file.name,
        },
    )


if __name__ == "__main__":
    main()
