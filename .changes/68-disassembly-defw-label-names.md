---
type: feature
issues: [1466]
---
**Label names in `.defw` rows:** a `.defw` word that is a labelled address shows the label in the
operand colour, so jump tables and word tables read by name, and Go to Definition works on it.
`.defb` rows inside code (after `RST $08` and `RST $28`) take the data colour.
