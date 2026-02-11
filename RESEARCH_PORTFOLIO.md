# Research Portfolio Maintenance

The homepage (`/`) is a custom research portfolio view.

## Key files

- `_pages/about.md`: homepage structure and sections
- `_layouts/research-home.html`: minimal layout wrapper
- `assets/css/research-portfolio.css`: portfolio design system
- `assets/js/research-portfolio.js`: data rendering, grouping, filtering, progression
- `assets/data/works_raw.json`: generated publication data from Google Scholar
- `assets/data/research-curation.json`: authored arc mapping, summaries, featured flags, related links
- `bin/sync_scholar.py`: script to refresh publication data from Scholar

## Refresh publications

Run from repository root:

```bash
python3 bin/sync_scholar.py --user BFCHfngAAAAJ
```

Then update curation in `assets/data/research-curation.json` as needed.
