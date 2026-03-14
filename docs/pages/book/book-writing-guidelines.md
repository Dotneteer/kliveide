# Writing Guidelines for "Building a ZX Spectrum Next Emulator"

## Purpose

This document defines the writing style, tone, and conventions for the book about building a ZX Spectrum Next emulator. The goal is to create an engaging, readable technical guide that teaches complex concepts without putting readers to sleep.

## Target Audience

- Developers with intermediate programming knowledge (comfortable with TypeScript/JavaScript)
- Retro computing enthusiasts who want to understand emulation
- Anyone curious about how computers work at a low level
- Readers who appreciate clear explanations without academic stuffiness

## Core Writing Principles

### 1. Write Like You're Explaining to a Friend

**Do this:**
> The Z80 CPU doesn't know about our fancy 2MB memory - it's stuck in 1976 with just 16 address lines. That's like trying to navigate a modern city with a map that only shows 64 streets.

**Not this:**
> The Z80 microprocessor architecture is constrained to a 16-bit address bus, limiting direct addressability to 65,536 bytes of memory space.

### 2. Use Concrete Examples

Don't just state facts - show them in action. If you're explaining a register, show what happens when you write to it. If you're describing memory mapping, walk through an actual address translation.

**Do this:**
> Let's say MMU register 2 contains 0x0A. When the CPU reads from address 0x4000 (slot 2), the MMU calculates:
> - Region bits: 0x0A[7:5] = 0, so (0+1) = region 1
> - Physical address: 0x014000 + offset
> This lands us right in Bank 5, the video memory.

### 3. Light Humor is Welcome (But Don't Force It)

A little personality goes a long way. Use humor to:
- Ease tension when introducing complex topics
- Make memorable points
- Keep the reader engaged

But never sacrifice clarity for a joke.

**Good examples:**
> "The priority decode chain has more levels than a corporate hierarchy - and just like in the corporate world, the top level always wins."

> "The ULA does memory contention like a bouncer at an exclusive club: 'Sorry CPU, the screen refresh is using that memory right now. You'll have to wait.'"

### 4. Explain the "Why" Not Just the "What"

Readers want to understand the reasoning behind design decisions.

**Do this:**
> Why the "+1" offset in the formula? Because the first 64KB (region 0) is reserved for system ROMs. The MMU starts allocating pages from region 1 onwards. Without this offset, every MMU register would need special handling for the ROM area.

**Not this:**
> The formula uses a "+1" offset for the region selector.

### 5. Structure for Clarity

- **Short paragraphs**: 2-4 sentences is ideal
- **Bullet points**: Use them liberally for lists and key points
- **Code blocks**: Always formatted and commented
- **Headings**: Clear hierarchy, descriptive titles
- **Tables**: When comparing multiple items with properties
- **Diagrams**: Use ASCII art or describe visual concepts clearly

### 6. Technical Accuracy First

Humor and accessibility never justify incorrect information. When in doubt:
1. Check the VHDL source
2. Reference official documentation
3. Verify against real hardware behavior
4. Note any assumptions or simplifications made for clarity

### 7. Progressive Disclosure

Introduce concepts in layers:
1. **High-level overview**: What it does and why
2. **Conceptual explanation**: How it works at a design level  
3. **Implementation details**: The nitty-gritty for actual coding
4. **Edge cases and gotchas**: The stuff that trips people up

Don't dump everything at once.

## Language Conventions

### Terminology Consistency

Maintain consistent terminology throughout the book. When introducing a new technical term:
1. **Define it clearly** on first use
2. **Add it to the glossary** (see glossary.md)
3. **Use it consistently** - don't switch between synonyms
4. **Cross-check** the glossary before using similar terms to avoid confusion

Key terms:
- **Memory region**: 64KB address space divisions (A20:A16 selects 1 of 32)
- **Bank**: Traditional ZX Spectrum memory areas (Bank 5, Bank 7)
- **Page**: 8KB units mapped by MMU
- **Slot**: Z80 address space divisions (0-7, each 8KB)
- **MMU**: Memory Management Unit
- **NextReg**: Next extended registers (0x00-0xFF)

See [glossary.md](glossary.md) for the complete reference.

### Code and Technical Elements

- Use backticks for: register names (`MMU0`), values (`0x4000`), code elements (`CPU_A[12:0]`)
- Use **bold** for: emphasis, key concepts on first mention
- Use *italics* for: rare emphasis or when defining terms
- File names and paths: Use links when referencing project files, plain text for examples
- **Hexadecimal notation**: For addresses longer than 4 digits, use single quote (') as a grouping character in groups of 4 from the right (e.g., `0x04'0000`, `0x1F'FFFF`, `0x23'E000`). This improves readability for long addresses.
- **Side notes**: Use block quotes (>) for side notes, explanatory asides, or contextual information that supports but isn't critical to the main flow

### Voice and Tense

- **Active voice** preferred: "The MMU translates addresses" not "Addresses are translated by the MMU"
- **Present tense** for describing behavior: "The CPU reads from memory" not "The CPU will read"
- **Second person** when addressing implementation: "You should check for Bank 5" not "One should check"

## Things to Avoid

### ❌ Academic Stuffiness

- No unnecessary jargon
- No "as previously discussed" or "aforementioned"
- No "it should be noted that" - just note it
- No passive constructions when active is clearer

### ❌ Condescension

- Don't use "simply" or "just" to dismiss complexity
- Don't assume knowledge is obvious
- Acknowledge when things are genuinely difficult

### ❌ Apologizing

- Don't write "sorry for the complexity"
- Don't hedge with "this might be wrong, but..."
- State information confidently (but accurately)

### ❌ Walls of Text

- Break up long paragraphs
- Add subheadings frequently
- Use lists and tables
- Insert examples between explanations

## Examples of Good vs. Bad

### Example 1: Explaining Memory Contention

**❌ Bad:**
> Memory contention occurs when multiple components require simultaneous access to shared memory resources, resulting in arbitration mechanisms that introduce variable latency.

**✅ Good:**
> The ULA and CPU both need to read from Bank 5 (screen memory). When they want it at the same time, someone has to wait. This is memory contention. The ULA gets priority because missing a screen refresh would cause visible artifacts, while the CPU can usually afford a few extra clock cycles.

### Example 2: Introducing a Formula

**❌ Bad:**
> Physical_Address = ((MMU_reg[7:5] + 1) << 16) | (MMU_reg[4:0] << 13) | CPU_A[12:0]

**✅ Good:**
> Here's the address translation formula:
> ```
> Physical_Address = ((MMU_reg[7:5] + 1) << 16) | (MMU_reg[4:0] << 13) | CPU_A[12:0]
> ```
> 
> Let's break this down with a concrete example. If the CPU reads from 0x5234 (slot 2) and MMU2 contains 0x0A:
> 1. Extract region: (0x0A >> 5) + 1 = 1
> 2. Extract page offset: (0x0A & 0x1F) << 13 = 0x14000
> 3. Add CPU offset: 0x1234
> 4. Final address: 0x010000 + 0x14000 + 0x1234 = 0x025234

## Chapter Structure Template

Each major topic should follow this structure:

```markdown
# [Topic Name]

## Overview
Brief introduction - what is this and why does it matter?

## Background
Historical context or prerequisite knowledge (if needed)

## How It Works
Conceptual explanation with diagrams

## Implementation
Practical details for coding

### [Subtopic 1]
### [Subtopic 2]
...Glossary Management

The book includes a **glossary.md** file that defines all technical terminology using the same conversational style as the rest of the book.

### When to Add a Term

Add a term to the glossary when:
- It's specific to ZX Spectrum/Next architecture
- It could be confused with similar terms
- It's used frequently throughout multiple chapters
- It's technical jargon that needs clear explanation

### Glossary Entry Format

Each entry should follow this structure:

```markdown
### Term Name
Conversational explanation that covers:
- What it is (in plain language)
- Why it matters
- How it relates to other concepts
- Common usage or context
- Any potential confusion points
```

### Writing Style for Glossary

- **No dry dictionary definitions**: Write like you're explaining to a colleague
- **Use analogies**: Help make abstract concepts concrete
- **Cross-reference**: Link to related terms
- **Be consistent**: Use the exact phrasing that appears in the book
- **Keep it brief**: 2-4 sentences for simple terms, up to a paragraph for complex ones

### Maintaining the Glossary

- **Check before writing**: Before introducing a new term, check if it's in the glossary
- **Update when terms evolve**: If usage changes, update the glossary entry
- **Note ambiguities**: If a term risks confusion, add clarification
- **Alphabetize**: Keep entries in alphabetical order by term

### Example of Good vs. Bad Glossary Entries

**❌ Bad (too dry):**
> **MMU**: Memory Management Unit. Hardware component responsible for address translation.

**✅ Good (conversational):**
> **MMU (Memory Management Unit)**: The hardware that translates Z80's 16-bit addresses into 21-bit physical addresses. Divides the 64KB Z80 address space into 8 slots of 8KB each, with each slot pointing to any 8KB page in the 2MB physical memory.

## Extension Notes

This document will grow as we identify patterns, conventions, and lessons learned from writing the book. Future additions might include:

- Diagram style guidelines
- Code example conventions  
- Cross-referencing standards
- Bibliography and citation forma
## Extension Notes

This document will grow as we identify patterns, conventions, and lessons learned from writing the book. Future additions might include:

- Diagram style guidelines
- Code example conventions  
- Cross-referencing standards
- Bibliography and citation format
- Glossary management
- Version control and update policies

---

**Remember**: The goal is to teach, engage, and maybe make the reader smile occasionally. If you're having fun writing it, the reader will probably have fun reading it.
