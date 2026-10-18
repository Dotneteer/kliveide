---
type: fix
issues: [1460]
---
Annotations: changes another program made to an open annotation file (a text editor or a script)
did not show until Klive restarted, and the next edit in the IDE overwrote them. The IDE now
reloads the file when it changes on disk.
