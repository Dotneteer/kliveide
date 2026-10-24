---
type: fix
---

Dialogs: a field's label, its input box and its error message were packed too tightly - in the
Rename and New File dialogs the prompt and the error touched the box. Every dialog now spaces them
8px (label to field) and 6px (field to error), with 16px between fields.
