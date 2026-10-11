---
'@tscad/modeling': minor
---

**Breaking:** `@tscad/modeling` is now an OpenSCAD-style API on its own CSG tree instead of re-exports of `@jscad/modeling`. Functions keep OpenSCAD's names (`cube`, `translate`, `linear_extrude`, `rotate_extrude`, `offset`, …) but take vectors and options as objects (`translate({ z: 5 }, …)`), and `defineModel({ parameters, body })` takes a Standard Schema such as zod. The `/runtime`, `/convert`, `/colors` and `/primitives` entry points are gone.
