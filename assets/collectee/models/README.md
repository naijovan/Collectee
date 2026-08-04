# Item models — `<itemId>.glb`

Real 3D geometry, tier 1 of the chain in `src/config/modelRegistry.ts`.
Filename **is** the catalogue item id, same rule as the art pack.

Generated from our own concept art (`assets/collectee/items/<itemId>.png`).
These are **not** publisher assets — see PRD §11 F4 and §15.

## Budget

| | |
|---|---|
| File size | ≤ 2 MB |
| Triangles | ≤ 30k |
| Format | `.glb`, binary, textures embedded |
| Orientation | Y-up, facing +Z |

Scale and centring are corrected at runtime by `CollectibleGLTF`, so a model
that comes out oversized or off-origin still renders correctly — but the
budget is not corrected for you, and five oversized models will bloat the app.

## Adding one

1. Drop `<itemId>.glb` in this folder.
2. Uncomment / add its line in `src/config/modelRegistry.ts`.
3. Nothing else changes — the room and the inspector pick it up.
