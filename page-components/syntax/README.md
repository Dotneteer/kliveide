# Syntax Highlighting Grammar Files

This folder contains TextMate grammar files for custom language syntax highlighting in the Klive IDE documentation.

## Files

- `z80-assembly.tmLanguage.json` - TextMate grammar for Z80 assembly language syntax highlighting

## Usage

These grammar files are automatically loaded by the Next.js configuration in `next.config.mjs` to provide syntax highlighting for code blocks in the documentation.

## Grammar Structure

The Z80 assembly grammar includes patterns for:
- Comments (`;`, `//`, `/* */`)
- Strings (single and double quoted)
- Numbers (hexadecimal, binary, octal, decimal, real)
- Keywords (Z80 instructions)
- Statements (assembler directives)
- Pragmas (assembler commands)
- Registers (Z80 register names)
- Conditions (Z80 condition codes)
- Functions (assembler functions)
- Operators
- Labels
- Macro parameters

## Adding New Languages

To add a new language grammar:
1. Create a new `.tmLanguage.json` file in this folder
2. Update the `next.config.mjs` file to load the new grammar
3. Add the language to the `langs` array in the getHighlighter function
4. Export the grammar in the `index.ts` file if needed for other components
