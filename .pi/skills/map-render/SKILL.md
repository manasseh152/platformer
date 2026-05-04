---
name: map-render
description: Render and validate this platformer project's tilemap as a full-size PNG. Use when CI/validation needs a visual map artifact or when level/rendering changes should be reviewed as one complete image.
---

# Map Render

Use the project-local `render_full_map_png` extension tool when available.

Default artifact:

```text
.temp/full-map.png
```

CLI fallback:

```bash
npm run validate:map-render
```

Custom output:

```bash
node tools/render-map.js .temp/my-map.png
```

After rendering, report the output path and dimensions printed by the tool/script.
