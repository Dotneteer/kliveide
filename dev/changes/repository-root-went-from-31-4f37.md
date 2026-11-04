---
type: internal
---

The repository root went from 31 entries to 19. The developer folders moved into dev/ (.ai/ to dev/ai/, .docs/ to dev/patterns/, .plans/ to dev/plans/, .changes/ to dev/changes/, scripts/, vendor/, _input/ to dev/research/, _experiments/ to dev/experiments/), the installer icons to build/icons/, the tool configs into package.json, build/ and .claude/, and local tool output into the git-ignored .local/. Scripts find the repository root through dev/scripts/repo-root.cjs.
