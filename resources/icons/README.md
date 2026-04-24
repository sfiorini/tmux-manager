# TMUX Manager Icons

## Research summary

Research date: 2026-04-24

Candidate sources checked:

1. **Official tmux repository/logo assets**
   - Source: https://github.com/tmux/tmux/tree/master/logo
   - License: https://github.com/tmux/tmux/blob/master/logo/LICENSE
   - License summary: permissive ISC-style license by Jason Long; modification and redistribution are allowed if the copyright/license notice is included.
   - Decision: suitable from a copyright perspective, but not used directly for the final TMUX Manager artwork to avoid implying official tmux project affiliation.

2. **Simple Icons terminal-related icons**
   - Source: https://github.com/simple-icons/simple-icons
   - License: https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md
   - License summary: CC0 1.0 Universal.
   - Decision: suitable for many brand icons, but no direct `tmux` icon was found in the slug list checked. Not used for the final artwork.

## Final decision

The committed icons are original TMUX Manager artwork created for this project and are intended to be MIT-compatible with the rest of the repository. They use a terminal-window/pane-grid motif and do not copy the official tmux logo.

Files:

- `resources/icons/icon.png` - package/Marketplace icon generated from the original pane-grid motif.
- `resources/icons/tmux.svg` - VS Code activity bar icon. This path is intentionally retained for manifest stability; the file now contains original TMUX Manager artwork, not a copied tmux logo.
- `resources/icons/source/tmux-manager.svg` - source vector artwork for future regeneration. Source files are committed for maintainers but excluded from the packaged VSIX.

## Regeneration

`icon.png` can be regenerated with:

```bash
python3 resources/icons/source/generate-icon.py
```

The generator uses only the Python standard library and the same pane-grid geometry documented in `tmux-manager.svg`. The activity-bar `tmux.svg` is hand-authored and edited directly.
