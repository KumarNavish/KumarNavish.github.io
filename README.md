# KumarNavish.github.io

Minimal Jekyll portfolio site for [kumarnavish.github.io](https://kumarnavish.github.io).

## Scope

The public site has two pages:

- `/` (`_pages/about.md`): research overview
- `/publications/` (`_pages/publications.md`): publication archive

## Project Structure

- `_layouts/intentional.html`: shared layout shell
- `assets/css/intentional.css`: global design system
- `assets/css/overview-craft.css`: overview-only styling
- `assets/js/research-core.js`: shared data loading + normalization
- `assets/js/research-portfolio.js`: overview rendering
- `assets/js/research-publications.js`: archive rendering
- `assets/data/works_raw.json`: synced Google Scholar data
- `assets/data/research-curation.json`: arc mapping + curation metadata

## Local Build

```bash
bundle install
bundle exec jekyll build
bundle exec jekyll serve
```

If native gem compilation fails on macOS command-line tools, build with SDK flags:

```bash
export SDKROOT="$(xcrun --show-sdk-path)"
export CFLAGS="-isysroot $SDKROOT"
export CPPFLAGS="-isysroot $SDKROOT"
export CXXFLAGS="-isysroot $SDKROOT"
bundle install
```

## Sync Google Scholar Data

```bash
python3 bin/sync_scholar.py --user BFCHfngAAAAJ --output assets/data/works_raw.json
```

Then review and update `assets/data/research-curation.json` if needed.

## Deployment

GitHub Actions deploys on pushes to `master`/`main` using `.github/workflows/deploy.yml`.
