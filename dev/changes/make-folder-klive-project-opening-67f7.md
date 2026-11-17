---
type: feature
issues: [1641]
---

**Make a folder a Klive project:** opening a folder that has no `klive.project` file (one made with another IDE, for example) now offers to make it a Klive project: choose the machine and model, a template (it brings the `build.ksx` that Compile, Run and Debug need) and the build root, and tick which of your files the template may replace. Or keep the folder as it is, and Klive does not ask again; **File › Make Klive Project...** and the Explorer's root folder menu convert it later. Klive no longer writes a `klive.project` file into a plain folder on its own, which made such a folder become a project only the second time it was opened, so **Promote to Build Root** stayed disabled the first time.
