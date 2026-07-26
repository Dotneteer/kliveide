# React Document And Explorer Refactor Notes

- Keep document/explorer refactors narrow: extract one render cluster or one refresh/persistence responsibility at a time.
- For document tab changes, test both display naming and workspace persistence payloads; they are easy regressions to miss visually.
- When extracting helpers from stateful React components, preserve the component's real initialization shape. `DocumentsHeader` uses `null` before documents load, so pure helpers should accept `null | undefined` instead of assuming arrays.
- In `ExplorerPanel`, avoid putting `explorerViewVersion` in the cached folder-load effect and the uncached refresh effect at the same time.
- When splitting Explorer tree loading into a hook, skip the `explorerViewVersion` effect on initial mount; otherwise opening a folder performs both cached and uncached loads immediately.
- For refresh callbacks that need latest expansion state without refreshing on every expansion, prefer a ref over React state.
