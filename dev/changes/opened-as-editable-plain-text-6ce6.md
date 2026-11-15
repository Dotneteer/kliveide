---
type: fix
---

`klive.project` opened as an editable file without JSON highlighting, and `build.ksx` showed the generic script icon instead of its own: files known by their exact name stopped matching their file type once the IDE looked file types up by full path. `klive.project` is read-only JSON again.
