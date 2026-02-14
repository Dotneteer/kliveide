# Custom Token Color Configuration

Klive IDE supports custom syntax highlighting colors for each programming language. You can customize the token colors by creating JSON configuration files in your Klive settings folder.

## Location

Custom token files should be placed in:
- **macOS/Linux**: `~/Klive/`
- **Windows**: `C:\Users\<YourUsername>\Klive\`

## File Naming Convention

Token files must follow this naming pattern: `<languageId>.tokens.json`

### Supported Language IDs

- `kz80-asm.tokens.json` - Klive Z80 Assembly
- `6510-asm.tokens.json` - 6510 Assembly
- `zxbasm.tokens.json` - ZX Basic Assembly
- `zxbas.tokens.json` - ZX Basic
- `ksx.tokens.json` - Klive Script
- `sjasmp.tokens.json` - SjASM Plus Assembly

## File Format

The token file uses a simple JSON structure with two main sections:

```json
{
  "darkTheme": {
    "tokenName": "foregroundColor",
    "anotherToken": {
      "foreground": "color",
      "fontStyle": "bold"
    }
  },
  "lightTheme": {
    "tokenName": "foregroundColor",
    ...
  }
}
```

### Structure

- **darkTheme**: Token colors for dark theme
- **lightTheme**: Token colors for light theme

### Token Values

Each token can be defined in two ways:

1. **Simple string** (foreground color only):
   ```json
   "comment": "6a9955"
   ```

2. **Object** (foreground color and font style):
   ```json
   "keyword": {
     "foreground": "569cd6",
     "fontStyle": "bold"
   }
   ```

### Color Format

Colors are specified as 6-digit hexadecimal values without the `#` prefix:
- `"6a9955"` (greenish gray)
- `"569cd6"` (blue)
- `"af00db"` (purple)

### Font Styles

Available font styles:
- `"bold"`
- `"italic"`
- `"underline"`
- Or combinations: `"bold italic"`

## Common Token Names

### Z80 Assembly Languages (kz80-asm, 6510-asm, zxbasm, sjasmp)

- `comment` - Comments
- `keyword` - CPU instructions (LD, ADD, SUB, etc.)
- `statement` - Assembler directives and statements
- `pragma` - Pragma directives
- `identifier` - Labels and identifiers
- `register` - CPU registers (A, B, C, HL, etc.)
- `condition` - Condition flags (Z, NZ, C, NC, etc.)
- `function` - Built-in functions
- `macroparam` - Macro parameters
- `escape` - Escape sequences in strings

### ZX Basic (zxbas)

- `comment` - Comments
- `statement` - BASIC keywords (PRINT, LET, etc.)
- `identifier` - Variable names
- `function` - Built-in functions
- `escape` - Escape sequences
- `asmdel` - ASM block delimiters
- `directive` - Preprocessor directives

### Klive Script (ksx)

- `comment` - Comments
- `keyword` - Language keywords
- `statement` - Statement keywords
- `identifier` - Identifiers
- `regexp` - Regular expressions
- `regexp.escape` - Regex escapes
- `string.escape` - String escapes

## Example: kz80-asm.tokens.json

```json
{
  "darkTheme": {
    "comment": "6a9955",
    "keyword": {
      "foreground": "569cd6",
      "fontStyle": "bold"
    },
    "register": "9cdcfe",
    "identifier": "dcdcaa"
  },
  "lightTheme": {
    "comment": "237122",
    "keyword": {
      "foreground": "0070c0",
      "fontStyle": "bold"
    },
    "register": "0089ba",
    "identifier": "795e26"
  }
}
```

## Partial Overrides

You don't need to specify all tokens. You can override only the tokens you want to customize. Unspecified tokens will use the default colors.

## Tips

1. **Start simple**: Begin by customizing just a few key tokens (like comments, keywords, and identifiers)
2. **Test both themes**: Make sure to define colors for both dark and light themes
3. **Contrast is key**: Ensure sufficient contrast between background and foreground colors
4. **Consistency**: Use a consistent color scheme across related token types
5. **Backup**: Keep a copy of your customizations in version control or a safe location

## Troubleshooting

- **Colors not applied**: Ensure the file is in the correct folder with the correct name
- **Invalid JSON**: Check for syntax errors using a JSON validator
- **Wrong colors**: Verify you're using 6-digit hex values without the `#` prefix
- **File ignored**: Check file permissions and ensure the file is readable

## Reloading Changes

After modifying token files, restart Klive IDE to see the changes take effect.
