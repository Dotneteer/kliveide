# React Document And Explorer Refactor Notes

- Keep document/explorer refactors narrow: extract one render cluster or one refresh/persistence responsibility at a time.
- For document tab changes, test both display naming and workspace persistence payloads; they are easy regressions to miss visually.
- In `ExplorerPanel`, avoid putting `explorerViewVersion` in the cached folder-load effect and the uncached refresh effect at the same time.
- For refresh callbacks that need latest expansion state without refreshing on every expansion, prefer a ref over React state.
