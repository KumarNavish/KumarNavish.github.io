#!/usr/bin/env python3
"""Sync Google Scholar works into assets/data/works_raw.json for the site."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from typing import Dict, List

BASE_URL = "https://scholar.google.com/citations"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def fetch_html(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:  # nosec B310
        body = response.read()
        encoding = response.headers.get_content_charset() or "ISO-8859-1"
    return body.decode(encoding, errors="replace")


def clean_text(raw: str) -> str:
    text = re.sub(r"<script.*?</script>", "", raw, flags=re.S)
    text = re.sub(r"<style.*?</style>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    return " ".join(html.unescape(text).split())


def parse_profile(profile_html: str, user_id: str) -> Dict[str, object]:
    profile_name = ""
    affiliation = ""
    description = ""

    name_match = re.search(r'<div id="gsc_prf_in">(.*?)</div>', profile_html, re.S)
    if name_match:
        profile_name = clean_text(name_match.group(1))

    aff_match = re.search(r'<div class="gsc_prf_il">(.*?)</div>', profile_html, re.S)
    if aff_match:
        affiliation = clean_text(aff_match.group(1))

    desc_match = re.search(r'<meta name="description" content="(.*?)">', profile_html)
    if desc_match:
        description = html.unescape(desc_match.group(1))

    rows = re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', profile_html, re.S)
    works: List[Dict[str, object]] = []

    for row in rows:
        anchor_match = re.search(r"<a[^>]*class=\"gsc_a_at\"[^>]*>.*?</a>", row, re.S)
        if not anchor_match:
            continue

        anchor = anchor_match.group(0)
        href_match = re.search(r'href="([^"]+)"', anchor)
        title_match = re.search(r'class="gsc_a_at"[^>]*>(.*?)</a>', anchor, re.S)
        gray_lines = re.findall(r'<div class="gs_gray">(.*?)</div>', row, re.S)
        cited_match = re.search(r'class="gsc_a_ac gs_ibl">(.*?)</a>', row, re.S)
        year_match = re.search(r'<span class="gsc_a_h gsc_a_hc gs_ibl">(\d{4})</span>', row)

        citation_id = None
        scholar_link = html.unescape(href_match.group(1)) if href_match else ""
        if scholar_link:
            id_match = re.search(rf"citation_for_view={re.escape(user_id)}:([A-Za-z0-9_-]+)", scholar_link)
            if id_match:
                citation_id = id_match.group(1)

        citation_count = clean_text(cited_match.group(1)) if cited_match else ""
        citation_count_int = int(citation_count) if citation_count.isdigit() else 0

        works.append(
            {
                "id": citation_id,
                "title": clean_text(title_match.group(1)) if title_match else "",
                "authors": clean_text(gray_lines[0]) if len(gray_lines) > 0 else "",
                "venue": clean_text(gray_lines[1]) if len(gray_lines) > 1 else "",
                "year": int(year_match.group(1)) if year_match else None,
                "citations": citation_count_int,
                "scholar_citation_url": urllib.parse.urljoin(BASE_URL, scholar_link) if scholar_link else "",
            }
        )

    return {
        "profile": {
            "name": profile_name,
            "affiliation": affiliation,
            "meta_description": description,
        },
        "works": works,
    }


def parse_detail_page(detail_html: str) -> Dict[str, str]:
    title_link_match = re.search(r'class="gsc_oci_title_link"[^>]*href="([^"]+)"', detail_html)
    pdf_link_match = re.search(
        r'<a href="([^"]+)"[^>]*>\s*<span class=\'gsc_vcd_title_ggt\'>\[PDF\]</span>',
        detail_html,
        re.S,
    )

    fields: Dict[str, str] = {}
    for key_raw, value_raw in re.findall(
        r'<div class="gsc_oci_field">(.*?)</div><div class="gsc_oci_value"[^>]*>(.*?)</div></div>',
        detail_html,
        re.S,
    ):
        key = clean_text(key_raw)
        value = clean_text(value_raw)
        if key:
            fields[key] = value

    return {
        "external_url": html.unescape(title_link_match.group(1)) if title_link_match else "",
        "pdf_url": html.unescape(pdf_link_match.group(1)) if pdf_link_match else "",
        "publication_date": fields.get("Publication date", ""),
        "journal": fields.get("Journal", ""),
        "book": fields.get("Book", ""),
        "conference": fields.get("Conference", ""),
        "description": fields.get("Description", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync works from a Google Scholar profile")
    parser.add_argument("--user", required=True, help="Scholar user id (e.g., BFCHfngAAAAJ)")
    parser.add_argument("--lang", default="en", help="Scholar language code")
    parser.add_argument("--output", default="assets/data/works_raw.json", help="Output JSON path")
    parser.add_argument("--pause", type=float, default=0.4, help="Pause seconds between detail requests")
    parser.add_argument(
        "--save-html-dir",
        default="assets/data/scholar_cache",
        help="Directory where fetched HTML pages are cached",
    )
    args = parser.parse_args()

    save_dir = pathlib.Path(args.save_html_dir)
    save_dir.mkdir(parents=True, exist_ok=True)

    profile_params = {
        "user": args.user,
        "hl": args.lang,
        "view_op": "list_works",
        "sortby": "pubdate",
    }
    profile_url = f"{BASE_URL}?{urllib.parse.urlencode(profile_params)}"

    try:
        profile_html = fetch_html(profile_url)
    except Exception as exc:  # pragma: no cover - network path
        print(f"Failed to fetch profile page: {exc}", file=sys.stderr)
        return 1

    (save_dir / "profile.html").write_text(profile_html, encoding="utf-8")

    parsed = parse_profile(profile_html, args.user)
    works = parsed["works"]

    for work in works:
        citation_id = work.get("id")
        if not citation_id:
            work.update(
                {
                    "external_url": "",
                    "pdf_url": "",
                    "publication_date": "",
                    "journal": "",
                    "book": "",
                    "conference": "",
                    "description": "",
                }
            )
            continue

        detail_params = {
            "view_op": "view_citation",
            "hl": args.lang,
            "oe": "ASCII",
            "user": args.user,
            "sortby": "pubdate",
            "citation_for_view": f"{args.user}:{citation_id}",
        }
        detail_url = f"{BASE_URL}?{urllib.parse.urlencode(detail_params)}"
        detail_path = save_dir / f"{citation_id}.html"

        try:
            detail_html = fetch_html(detail_url)
            detail_path.write_text(detail_html, encoding="utf-8")
            work.update(parse_detail_page(detail_html))
        except Exception as exc:  # pragma: no cover - network path
            print(f"Warning: failed to fetch details for {citation_id}: {exc}", file=sys.stderr)
            work.update(
                {
                    "external_url": "",
                    "pdf_url": "",
                    "publication_date": "",
                    "journal": "",
                    "book": "",
                    "conference": "",
                    "description": "",
                }
            )

        time.sleep(max(args.pause, 0.0))

    payload = {
        "fetched_at": dt.date.today().isoformat(),
        "source": profile_url,
        "profile": parsed["profile"],
        "works": works,
    }

    output_path = pathlib.Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Fetched {len(works)} works -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
