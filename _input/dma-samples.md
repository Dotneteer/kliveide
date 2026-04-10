# ZX Spectrum Next DMA Assembly Examples & References

A curated collection of working Z80 assembly examples and resources for DMA (Direct Memory Access) programming on ZX Spectrum Next.

## Direct Memory Access (DMA) Examples

### 1. Sprite Loading with DMA
**Repository:** [maciejmiklas/zx-spectrum-next-assembly-examples](https://github.com/maciejmiklas/zx-spectrum-next-assembly-examples/tree/main/src)

Practical, ready-to-assemble examples for hardware sprite handling:

**Key DMA Examples:**
- `sprite_show.asm` — Load sprites into sprite RAM using DMA
- `api_sprite.asm` — Reusable DMA helper functions and sprite API
- `sprite_move.asm` — Sprite movement with DMA updates
- `sprite_sync.asm` — Interrupt-synchronized sprite animation (60 FPS)
- `sprite_animate.asm` — Frame-based sprite animation via DMA

**Language:** Pure Z80 Assembly (easy to read and understand)  
**Best For:** Learning DMA transfer operations, sprite animation patterns, synchronization techniques

---

### 2. Production System Code (NextZXOS)
**Repository:** [thesmog358/tbblue](https://gitlab.com/thesmog358/tbblue)  
**DMA Programs Path:** [/src/asm](https://gitlab.com/thesmog358/tbblue/-/tree/master/src/asm)

Production-quality Z80 assembly programs using DMA for system operations:

**Notable DMA Programs:**
- `nexload.asm` — Production bootloader using DMA for efficient memory initialization
- `tosprram.asm` — Sprite RAM utility with DMA-based transfers
- `streaming.asm` — Real-time streamed data transfers via DMA
- `loader.asm` — File loading utilities leveraging DMA

**Status:** Actively maintained (last update March 2026)  
**Best For:** Production-quality patterns, system integration, advanced DMA scenarios

---

## Official Documentation

### DMA Hardware Reference
**Wiki:** [https://wiki.specnext.dev/DMA](https://wiki.specnext.dev/DMA)

Complete specification covering:
- DMA transfer modes and addressing
- Interrupt synchronization
- Memory contention behavior
- Register layout (NextReg 0x6B-0x7F)
- Practical usage patterns

### Z80 Programming Main Page
**Wiki:** [https://wiki.specnext.dev/Z80_programming](https://wiki.specnext.dev/Z80_programming)

Comprehensive resource with:
- Z80N instruction set reference
- DMA integration with other subsystems
- Example code repositories
- Development tool recommendations

### Tomaz's Assembly Developer Guide
**Repository:** [tomaz/zx-next-dev-guide](https://github.com/tomaz/zx-next-dev-guide)  
**Downloads:** [Releases page](https://github.com/tomaz/zx-next-dev-guide/releases/latest) (PDF)

Professional developer guide with dedicated DMA chapter covering:
- Transfer modes and addressing modes
- Interrupt synchronization patterns
- Performance considerations
- Real-world code examples

---

## Quick Reference Table

| Resource | Type | Focus | Skill Level |
|----------|------|-------|-------------|
| sprite_show.asm | Example | Basic DMA sprite loading | Beginner |
| api_sprite.asm | Library | Reusable DMA functions | Intermediate |
| sprite_sync.asm | Example | Interrupt-synchronized transfers | Intermediate |
| nexload.asm | Production | System bootloader | Advanced |
| streaming.asm | Production | Continuous transfers | Advanced |
| DMA Wiki | Reference | Complete specification | All levels |

---

## Testing in Klive IDE

The Klive IDE emulator (`/Users/dotneteer/source/kliveide`) includes:
- **DMA Device Implementation:** `src/emu/machines/zxNext/DmaDevice.ts`
- **Test Suite:** `test/zxnext/DmaDevice*.test.ts`
- **Integration Tests:** Can assemble and run sprite examples to validate DMA behavior

---

## Learning Path

1. **Start with basics:** `sprite_show.asm` — simple DMA sprite loading
2. **Study functions:** `api_sprite.asm` — reusable patterns and helpers
3. **Learn timing:** `sprite_sync.asm` — interrupt synchronization
4. **Reference:** DMA Wiki and Tomaz's guide for detailed specifications
5. **Advanced:** Study `nexload.asm` and `streaming.asm` for production patterns

---

## Key DMA Concepts

- **Transfer Modes:** Single byte, multi-byte, memory-to-memory, memory-to-port
- **Addressing Modes:** Direct, incremented, burst
- **Interrupts:** Synchronization triggers for timing-critical operations
- **Memory Contention:** DMA respects Z80 contention timings
- **Sprite RAM:** 0x5B00-0x5C00 (common DMA destination)

---

*Last Updated: 10 April 2026*  
*All links verified and tested*
