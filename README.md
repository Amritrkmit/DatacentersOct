# US Data Center Site Explorer — optimized

Run in VS Code PowerShell: `python -m http.server 8000` and open http://localhost:8000. No Node.js required.

## Performance changes
- Default Moratorium data loads first; other datasets are fetched during idle time or on first tab visit.
- Precomputed dropdown options: `data/filter-options.json`.
- Canvas-rendered circles for normal markers; SVG markers only for banned X symbols.
- Marker layers are cached per tab and reused when filters change.
- Removed unused D3/TopoJSON CDN scripts from the initial page load.
- Existing status colors, popups, read-more interactions, and filters retained.

## Updating data
When data JSON changes, run `python scripts/precompute.py` to regenerate filter options. This is only needed when source data changes, not on each page load.

The map still needs an internet connection for Leaflet and OpenStreetMap tiles. Browser-level performance measurements are not included.
