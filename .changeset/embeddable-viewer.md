---
'@tscad/viewer': minor
---

**Breaking:** the viewer renders kernel output (GLB) with plain three.js instead of React Three Fiber, and mounts into any element: `createViewer(container, { onParams, theme })`. It brings its parameter form (from the model's JSON Schema) and an analysis panel for plugin reports; styles come from `@tscad/viewer/style.css`.
