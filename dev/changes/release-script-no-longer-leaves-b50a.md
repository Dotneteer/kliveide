---
type: internal
---

The release script no longer leaves a word on a line of its own in CHANGELOG.md: a changeset wrapped at 100 columns that the bullet's indent pushes over is now wrapped again as a whole paragraph, counting characters rather than UTF-16 units.
