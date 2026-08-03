# Collectee app-ready art pack

This is the card-optimized variant of the 20 original Collectee prototype assets.

- 16 hero/skin portraits: **660 x 440 PNG**, 3:2, head-and-shoulders crop driven by each asset's `focalPoint`.
- 4 objects/weapons: **620 x 620 PNG**, conservative dead-margin trim, full object preserved.
- Exactly one hero, item, or weapon per file.
- The original 4:5 portraits and 1:1 object renders are not modified.
- `asset-manifest.json` maps every file to its game, name, type, rarity, collections, and app placements.
- `VSCODE_CODING_AGENT_PROMPT.md` is ready to paste into the coding agent with this folder beside the app repository.

## Re-run the fit

Both scripts need ImageMagick. The shell version also needs `jq`.

```bash
./refit-art.sh ../collectee-asset-pack .
```

```powershell
./refit-art.ps1 -SourceRoot ../collectee-asset-pack -OutputRoot .
```

The scripts read portrait focal points from the source manifest. Object insets are intentionally conservative and defined by asset ID in the scripts.
