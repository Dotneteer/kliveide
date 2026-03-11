# Z80 Assembly Editor Feature Ideas

Ranked by expected usefulness to developers, most valuable first.

---

## 1. Signature Help for Macros and Functions

When a developer types a macro invocation like `Delay(` or a built-in function like `substr(`, the editor should display a popup showing the parameter names, their order, and which parameter is currently being typed. As the cursor moves past each comma, the active parameter should be highlighted. This is especially valuable for macros with many optional parameters (e.g., `Push(r1, r2, r3, r4)`) and for the 40+ built-in functions (e.g., `attr(ink, paper, bright, flash)`).

## ~~2. Diagnostic Squiggles (Inline Errors and Warnings)~~ — Already Implemented

Show compiler errors and warnings directly in the editor as red/yellow squiggles under the offending text, with messages in the Problems panel. **This feature is already live** — background compilation sets Monaco decorations with red wavy underlines and inline error badges.

## ~~3. Macro Expansion Preview~~ — Already Implemented

When hovering over a macro invocation like `Delay(#24)`, show the expanded Z80 instructions that the compiler will emit. **This feature is now live** — hover over any macro name to see its body with parameter placeholders (e.g. `{{color}}`), giving you an immediate preview of the code the macro expands to.

## ~~4. Code Folding for Blocks~~ — Already Implemented

Enable folding regions for all block constructs: `.macro`/`.endm`, `.loop`/`.endl`, `.repeat`/`.until`, `.while`/`.endw`, `.for`/`.next`, `.proc`/`.endp`, `.struct`/`.ends`, `.if`/`.endif`, `.module`/`.endmodule`, and `#if`/`#endif` directives. **This feature is now live** — click the folding triangles in the editor gutter to collapse/expand blocks and focus on the code you're working on.

## ~~5. Rename Symbol~~ — Already Implemented

Allow developers to rename a label, macro, struct, variable, or `.equ` symbol and have all references across all files updated automatically. **This feature is now live** — press F2 on any symbol to open the rename widget, edit the name, and all occurrences (including cross-file references) are updated automatically with proper scoping awareness.

## 6. Struct Field Completion

When typing `Object2D.` after a struct name, the editor should suggest the available field names (`X`, `Y`, `DX`, `DY`). This saves time and prevents typos when accessing struct fields by offset. The hover for each field should show its byte offset within the struct.

## 7. Snippet Templates for Common Constructs

Provide snippet completions for assembler statements and patterns:
- `.macro(params) ... .endm` skeleton
- `.loop N ... .endl` skeleton
- `.repeat ... .until condition` skeleton
- `.while condition ... .endw` skeleton
- `.for var = start .to end ... .next` skeleton
- `.proc ... .endp` skeleton
- `.struct ... .ends` skeleton
- `.if ... .elif ... .else ... .endif` skeleton
- `#ifdef ... #endif` directive skeleton

Typing the keyword prefix should offer the full block template with tab stops for the user to fill in.

## 8. Address and Byte Count Display

Show the resolved address (`$` value) and byte count for each instruction or data pragma in an inline annotation or hover. For example, hovering over `ld hl,#4000` should show the machine code bytes (`21 00 40`) and the current address. This is critical for assembly developers who need to track memory layout.

## 9. Go to Included File

Make `#include "filename.z80asm"` paths clickable. Ctrl+Click or Go to Definition on the file string should open the referenced file. This improves navigation in multi-file projects that use `#include` directives.

## 10. Color Decorators for Attribute Values

When code uses `attr(ink, paper, bright, flash)`, `ink()`, `paper()`, or direct color values in `out (#fe),a` patterns, show a small color swatch in the gutter or inline that represents the ZX Spectrum color. This gives immediate visual feedback for screen attribute manipulation code.

## 11. Bracket Matching for Assembler Blocks

Highlight matching block pairs: when the cursor is on `.macro`, highlight the corresponding `.endm`; when on `.loop`, highlight `.endl`, etc. This helps developers navigate nested control flow structures and catch mismatched blocks.

## 12. Symbol Value Preview on Hover

For `.equ` symbols, variables (`.var`, `=`, `:=`), and the `$` current address token, show the computed value on hover. For example, hovering over `BorderColor` defined as `.equ 4` should show `BorderColor = 4`. For `$`, show the current address at that point in the code.

## 13. Inlay Hints for Hex/Decimal Conversions

Show unobtrusive inline hints next to numeric literals showing their alternate representation: hex values show decimal equivalents and vice versa. For example, next to `#FF` show `255`, next to `65535` show `$FFFF`. Binary literals could show both hex and decimal. This saves developers from mental arithmetic.

## 14. Semantic Syntax Highlighting

Differentiate token types with distinct colors: labels, macro names, struct names, macro parameter placeholders (`{{param}}`), `.equ` constants, variables, register names, instructions, directives, pragmas, and comments should each have distinguishable styling. The current basic syntax highlighting may not distinguish compiler-resolved categories.

## 15. Module-Qualified Symbol Completion

When working inside or referencing a `.module`, the editor should suggest module-qualified symbol names (e.g., `MyModule.Label`). When inside a module scope, offer local symbols first, then outer scope symbols, matching the compiler's resolution order.

## 16. Quick Fix Suggestions

Offer automatic corrections for common mistakes:
- Unknown symbol → suggest similarly-named symbols (did you mean `DelayLoop`?)
- Missing `.endm` / `.endl` / `.endif` → offer to insert the closing statement
- Case mismatch in reserved words (e.g., `Ld` → suggest `ld` or `LD`)
- Missing parentheses on macro invocation (e.g., `Delay` without `()`)
