# ZX Spectrum Next Z80 Assembly Examples & Resources

A collection of resources for learning Z80 assembly programming on ZX Spectrum Next, focusing on text-based applications including screen display, keyboard input, and basic I/O operations.

## GitHub Repositories with Assembly Examples

### 1. Simple Assembly Code Examples for ZX Spectrum Next
**Repository:** [maciejmiklas/zx-spectrum-next-assembly-examples](https://github.com/maciejmiklas/zx-spectrum-next-assembly-examples)

Contains practical, easy-to-follow examples:
- `change_border_color.asm` - Set border to green
- `blinking_character.asm` - Display a blinking character
- `print_text_loop.asm` - Print text by looping over each character
- `print_text_rom.asm` - Print text using ROM routine calls
- `print_text_compact.asm` - Same as above with control characters
- `print_text_at.asm` - Print text at given screen position using ROM routine
- `convert_16bit_to_string.asm` - Convert 16-bit number to string
- `joystick_input.asm` - Handle joystick input
- `sprite_show.asm` - Load sprites using DMA
- `sprite_move.asm` - Move sprite on X axis
- `sprite_sync.asm` - Move sprite at 60 FPS
- `sprite_animate.asm` - Animate sprite at 60 FPS

**Language:** Assembly (98%), Shell (2%)

### 2. SpecBong Game Tutorial
**Repository:** [ped7g/SpecBong](https://github.com/ped7g/SpecBong)
**Wiki:** Includes 12-chapter text write-up at [https://github.com/ped7g/SpecBong/wiki](https://github.com/ped7g/SpecBong/wiki)

A small "game" written in sjasmplus assembler that serves as a progressive tutorial:
- Uses Layer 2 for static background
- Hardware sprites for player and enemies
- ULA layer for score display
- 12 releases showing incremental functionality changes
- Final result is a playable tutorial-grade game
- Perfect for learning in small, manageable steps

### 3. ZX Spectrum Next Assembly Developer Guide
**Repository:** [tomaz/zx-next-dev-guide](https://github.com/tomaz/zx-next-dev-guide)

Comprehensive guide available in two formats:
- [Free PDF download from releases page](https://github.com/tomaz/zx-next-dev-guide/releases/latest)
- Printed coil-bound book available at [bit.ly/zx-next-assembly-dev-guide](https://bit.ly/zx-next-assembly-dev-guide)

**Contents:**
- Introduction and history
- Z80 instruction reference
- Z80N extended instructions
- Detailed chapter-based coverage:
  - Z80 fundamentals
  - ULA (screen display)
  - Layer 2
  - Tilemap
  - Sprites
  - Sound (AY)
  - Memory and paging
  - Interrupts
  - Keyboard input
  - DMA
  - Copper
  - Ports and NextRegs
- Instructions at a glance (by category and alphabetically)
- Instructions in detail (sorted by mnemonic and opcode)

**Sample Code Included:** Repository contains working examples and can be built from LaTeX sources

## Wiki Resources

### Z80 Programming Main Page
**URL:** [https://wiki.specnext.dev/Z80_programming](https://wiki.specnext.dev/Z80_programming)

**Key Resources:**
- Complete Z80N instruction set reference
- Interactive instruction table: [https://table.specnext.dev/](https://table.specnext.dev/)
- "Dev Tuesday" snippets of Z80N assembly
- Z80N tutorials and examples
- Patricia's Spectrum Next Links (curated by professional game developer)
- Simon N Goodwin's collection of code and knowledge
- Tomaz's Assembly Developer Guide (PDF)
- Classic Z80 tips and tricks
- Official Zilog documentation and resources

### Z80 Examples
**URL:** [https://wiki.specnext.dev/Z80:Examples](https://wiki.specnext.dev/Z80:Examples)

**Featured Examples:**
- SpecBong - Simple game with 12-chapter tutorial
- [ZeusNexFileExample](https://github.com/Threetwosevensixseven/ZeusNexFileExample) - NEX file creation with Zeus assembler
- [NextWidescreenImage](https://github.com/Threetwosevensixseven/NextWidescreenImage) - 320x192 image display
- [ScrollNutter Demo](https://www.specnext.com/team-rusty-pixel-presents-the-scrollnutter-demo/) - Complete scrolling demo with sources
- [ScrollNutter Remake in C](https://github.com/quietbloke/ScrollDemoInC) - C version using z88dk
- [MOD Player](https://github.com/mikedailly/mod_player) - Music player in Z80

## Simon N Goodwin's Zeus Assembler Resources

**URL:** [http://simon.mooli.org.uk/nextech/z80n/index.html](http://simon.mooli.org.uk/nextech/z80n/index.html)

**Highlights:**
- Zeus assembler patches and improvements for ZX Spectrum Next
- Next header files for Zeus (symbols for registers, instructions, system variables)
- Floating point calculator code examples
- Z80N instruction extensions support
- **Minimal DOT command example** (336 bytes of source, 17 bytes assembled)
- **Reading CODE INKEY$ with FPC** - Keyboard input example
- Complete FPC (Floating Point Calculator) instruction set with references

**Available Files:**
- `nextras.god` - Z80N extended instructions
- `nextreg.god` - Next register symbolic names
- `fpcodes.god` - Floating point calculator codes
- `sysvars.god` - NextBASIC system variables

## ROM Routines for Text-Based Applications

### Character/Text Output
- **RST $10** - Print character (value in A register)
- **CALL $1601** - Open channel (A=2 for upper screen)
- **CALL $0DAF** - Print string from memory
- **CALL $15C4** - Screen address calculation

### Screen Control
- **AT control sequence:** $16 followed by row (0-23) and column (0-31)
- **PAPER** control: $10 followed by color (0-7)
- **INK** control: $11 followed by color (0-7)
- **BRIGHT** control: $0C followed by brightness (0-1)

### Keyboard Input
- **CALL $028E** - Scan keyboard (classic Spectrum routine)
- **Port $FE** - Read keyboard matrix
- **INKEY$ ROM routine** - Get key code

### NextZXOS Additions
- Use official **NextZXOS and esxDOS APIs** for system calls
- Document at: `c:/docs/NextZXOS/NextZXOS_and_esxDOS_APIs.pdf`
- [Online PDF](https://gitlab.com/thesmog358/tbblue/-/raw/master/docs/nextzxos/NextZXOS_and_esxDOS_APIs.pdf)

## Official Documentation

### SpecNext Wiki Main Resources
**URL:** [https://wiki.specnext.dev/](https://wiki.specnext.dev/)

**Key Sections:**
- **System Architecture:** Specifications, memory map, boot sequence, interrupts
- **Z80 Programming:** Instructions, examples, tutorials
- **Video Modes:** ULA, Layer 2, Tilemap, Sprites, Palettes
- **Audio:** Turbo Sound Next, SpecDrum/DAC, Beeper
- **Development Tools:** Emulators, Assemblers, Compilers
- **APIs:** NextZXOS and esxDOS APIs documentation

### NextZXOS Operating System
**URL:** [https://wiki.specnext.dev/NextZXOS](https://wiki.specnext.dev/NextZXOS)

Features relevant to assembly developers:
- Command line interface
- File browser with format support
- NextBASIC editor integration
- Customization options
- System variables access

## Development Blogs and Articles

### SpecNext Developer HQ Blog
**URL:** [https://specnext.dev/blog/](https://specnext.dev/blog/)

Recent articles include:
- "Everything you wanted to know about z88dk paging" (Dec 2024)
- "Building Text Adventures for the Next with Adventuron" (Feb 2024)
- "Z80N Instruction Set Quick Reference Table" (Jan 2024)
- Tagged categories: hardware, software, C, Forth, games, NextBasic, utilities, z88dk

### Patricia's Spectrum Next Links
**URL:** [https://luckyredfish.com/patricias-spectrum-next-links/](https://luckyredfish.com/patricias-spectrum-next-links/)

Curated collection of useful articles and links maintained by professional game developer Patricia Curtis

## Learning Path Recommendation

For someone experienced with Z80 but new to Spectrum Next assembly:

1. **Start with simple examples:** Use the maciejmiklas repository for basic examples
2. **Reference materials:** Keep Tomaz's guide (PDF) handy for instruction lookups
3. **Progressive learning:** Work through SpecBong's 12 chapters for integrated learning
4. **ROM documentation:** Study the API documentation for system calls
5. **Advanced topics:** Explore specific features (Layer 2, sprites, DMA) as needed

## Project Templates in Klive IDE

The Klive IDE workspace includes ZX Spectrum Next project templates at:
- `/src/public/project-templates/zxnext/default/code/code.kz80.asm`

This template demonstrates:
- Model declaration
- Text display using RST $10
- Message formatting with control characters
- Basic screen positioning and formatting

## Quick Reference

### Common System Addresses
- Screen memory: $4000-$57FF (6144 bytes)
- Color attributes: $5800-$5AFF (768 bytes)
- Default BASIC start: $6A00
- System variables: $5C00-$5CFF

### Common Keyboard Operations
- Read port $FE for keyboard matrix scanning
- Use ROM routines for high-level input
- NextZXOS provides enhanced APIs for modern development

### Common Output Operations
- RST $10 for single character output
- ROM CALL $1601 to set up text channel
- Control characters (AT, PAPER, INK, BRIGHT) embedded in output strings
