# C80 Compiler and Integrated Source View Plan

## Goal

Add a deliberately small C-like language for Z80 development, provisionally
called C80, together with editor integration that makes generated code visible
and understandable. A developer should be able to edit C80 source, see the
corresponding Z80 assembly, bytes, addresses, and static T-state information,
load a successful build into the active emulator, and debug it through a
bidirectional source-to-machine map.

The compiler is not an ISO C implementation. It is a transparent, Z80-aware
language whose small scope is a feature: source constructs should have
predictable generated code, inline assembly must remain available, and every
generated instruction must retain enough provenance for editor and debugger
integration.

This plan expands the high-level [Developer Workspace backlog](../../TODO.md#developer-workspace)
item. It records the design discussed in the
[shared compiler conversation](https://chatgpt.com/share/6a8aaaad-9a68-83ec-b521-998025b6e674),
but is self-contained so implementation does not depend on that external page
remaining available.

## Product Principles

1. Prefer a coherent small language over a partial implementation of ISO C.
2. Treat source provenance as a compiler output, not a later debugging add-on.
3. Keep the compiler core independent of egui and emulator scheduling.
4. Generate ordinary rtvc-compatible Z80 assembly and reuse the checked-in
   assembler rather than introducing a second instruction encoder.
5. Represent generated operations structurally inside the compiler even when
   the initial assembler boundary is rendered text.
6. Make generated code and its cost visible; predictable code is more valuable
   than an opaque optimizer in the first versions.
7. Keep compilation quick and deterministic enough for an idle-debounced live
   assembly view without disturbing 50 Hz emulation.
8. Preserve the simple emulator UI. Compiler and editor features live in the
   optional Developer Workspace.
9. Support both native and `wasm-full`. Do not pull editor/compiler UI into the
   lightweight WASM library targets.

## Delivery Boundary

Phase 1 is only the compiler: a reusable compiler library plus `rtvc-c80`
command-line tool. It accepts single-file or project input and emits assembly,
loadable segments, diagnostics, symbols, source maps, and static size/timing
metadata. It has no egui pane, live recompilation, emulator loading, breakpoint,
or source-stepping UI.

Editor needs are nevertheless designed into Phase 1 outputs. Source spans,
instruction provenance, stable per-compilation IDs, final addresses, bytes, and
timings must be real compiler results rather than reconstructed by Phase 2.

The Phase 1 workflow is:

1. Write one `.c80` source file or a TOML project containing several units.
2. Run `rtvc-c80` with a target and origin/project configuration.
3. Receive diagnostics or generated assembly and loadable segment output.
4. Optionally inspect emitted symbols, source-map metadata, bytes, and static
   instruction timings.
5. Load the result using existing rtvc assembler/debugger tooling when desired;
   the compiler itself does not control the emulator.

## Worked Phase-One Compiler Example

This section makes the intended behavior concrete. Names such as the project
filename, CLI flags, intrinsic spelling, and exact `@fastcall` registers remain
reviewable syntax; the compilation-unit, layout, type-checking, provenance, and
output behavior illustrated here are requirements.

### Example Project

```text
demo/
  rtvc-c80.toml
  src/
    main.c80
    video.c80
    game_data.c80
    screen.c80
```

```toml
# rtvc-c80.toml
target = "tvc"
entry = "main::main"

[[unit]]
name = "main"
path = "src/main.c80"
origin = 0x2000

[[unit]]
name = "video"
path = "src/video.c80"
origin = 0x2800

[[unit]]
name = "game_data"
path = "src/game_data.c80"
origin = 0x3000

[[unit]]
name = "screen"
path = "src/screen.c80"
```

The addresses are illustrative project placement, not a canonical TVC memory
map. A real project must choose origins compatible with its active TVC mapping.

`game_data.c80` is an ordinary data-only unit:

```c
pub u8 frame_counter;
pub u8 positions[16];
pub str enemy_name = "hello world";
```

With declaration-order layout and no padding requirement between these byte
objects, it produces:

```text
3000              frame_counter       1 zero-initialized byte
3001..3010        positions           16 zero-initialized bytes
3011..301C        enemy_name          0B + "hello world"
```

The loadable data bytes are therefore conceptually:

```text
00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0B 68 65 6C 6C 6F 20 77 6F 72 6C 64
```

`screen.c80` exports typed constants describing memory owned by the machine
rather than the program:

```c
pub const ptr<u8> bytes = ptr<u8>(0x8000);
pub const u16 byte_count = 16384;
```

It contributes no code or storage, so this unit needs no `origin` and produces
no loadable segment. `bytes` is a 16-bit compile-time pointer value. Indexing it
performs a memory access at `$8000 + index`. All indirect pointer reads and
writes are observable in the initial language, so the compiler emits each
evaluated access in source order.

`video.c80` imports both units:

```c
import game_data;
import screen;

pub void clear_first_row(u8 colour) {
    u16 offset = 0;

    while (offset < 80) {
        screen::bytes[offset] = colour;
        offset = offset + 1;
    }
}

pub void print_name() {
    u8 index = 0;

    while (index < game_data::enemy_name.len) {
        // Provisional typed Z80-port intrinsic: port is u16, value is u8.
        io_out(0x0006, game_data::enemy_name[index]);
        index = index + 1;
    }
}
```

The pointer rule makes every loop iteration perform a real memory write even if
later optimizer analysis thinks the value is redundant.
The string loop reads the prefix for `.len` and reads payload byte `index + 1`.
`io_out` cannot be expressed as a memory array because Z80 port I/O is a
separate address space.

For the default stack ABI, a direct unoptimized lowering of
`clear_first_row` can look like:

```asm
video__clear_first_row:
    push ix
    ld   ix,0
    add  ix,sp
    dec  sp             ; reserve the two-byte local `offset`
    dec  sp

    xor  a
    ld   (ix-2),a       ; offset low byte = 0
    ld   (ix-1),a       ; offset high byte = 0

.loop:
    ld   l,(ix-2)
    ld   h,(ix-1)
    ld   de,80
    or   a              ; clear carry
    sbc  hl,de
    jr   nc,.done       ; unsigned offset >= 80

    ld   l,(ix-2)
    ld   h,(ix-1)
    ld   de,8000H       ; compile-time value of screen::bytes
    add  hl,de
    ld   a,(ix+4)       ; low byte of the u8 argument slot: colour
    ld   (hl),a         ; observable indirect write

    inc  (ix-2)
    jr   nz,.loop
    inc  (ix-1)
    jr   .loop

.done:
    ld   sp,ix          ; discard locals
    pop  ix
    ret
```

This deliberately plain form exposes the ABI and maps closely to source. It is
correct but much more expensive than the Z80 needs. Once Phase 1E recognizes
that `offset` is a private induction variable with the constant range `0..79`,
the same function can become:

```asm
video__clear_first_row:
    push ix
    ld   ix,0
    add  ix,sp
    ld   a,(ix+4)       ; colour
    ld   hl,8000H       ; screen::bytes
    ld   b,80

.loop:
    ld   (hl),a         ; still exactly 80 observable writes, in order
    inc  hl
    djnz .loop

    pop  ix
    ret
```

The stack ABI still requires IX here because Z80 has no ordinary
stack-pointer-relative argument load. An eventual `@fastcall` convention that
passes an eight-bit argument in A could omit the entire frame and prologue. The
exact instruction selection is not a language guarantee; assembly snapshots
and byte/T-state tests should make backend quality visible as it improves.

`main.c80` demonstrates public calls, array access, control flow, and explicit
conversion:

```c
import game_data;
import video;

void main() {
    u16 score = 1000;
    u8 slot = 0;

    // A width-changing conversion is explicit.
    game_data::frame_counter = u8(score);
    game_data::frame_counter = game_data::frame_counter + 1;

    while (slot < 16) {
        game_data::positions[slot] = slot;
        slot = slot + 1;
    }

    if (game_data::frame_counter != 0) {
        video::clear_first_row(1);
        video::print_name();
    }
}
```

The compiler rejects the same assignment without conversion:

```c
game_data::frame_counter = score;
```

```text
error[C80-TYPE-004]: cannot assign u16 to u8 without an explicit conversion
 --> src/main.c80:9:32
  |
9 |     game_data::frame_counter = score;
  |                                ^^^^^ use u8(score) if truncation is intended
```

It also rejects access to a non-public declaration:

```text
error[C80-NAME-007]: `game_data::scratch` is private to unit `game_data`
```

and rejects implicit integer-to-pointer conversion:

```c
// Invalid: hardware addresses must be explicit.
pub const ptr<u8> bytes = 0x8000;
```

```text
error[C80-TYPE-009]: cannot convert u16 to ptr<u8> implicitly
                     use ptr<u8>(0x8000)
```

### Example CLI and Outputs

The proposed Phase 1 CLI shape is:

```text
rtvc-c80 build demo/rtvc-c80.toml \
  --emit-asm demo/build/program.asm \
  --emit-segments demo/build/program.toml \
  --emit-map demo/build/program.c80map
```

A successful command writes ordinary helper assembly and loadable segments. It
also writes or exposes through the library a versioned metadata result. The
exact external map encoding should be chosen after the in-process model works,
but its information is concrete:

```text
unit main, source expression `game_data::frame_counter + 1`
  -> generated instruction IDs 41, 42, 43
  -> final addresses 2034..203B inclusive
  -> bytes 3A 00 30 C6 01 32 00 30
  -> timings 13 T, 7 T, 13 T

address 2037
  -> instruction ID 42
  -> expression `game_data::frame_counter + 1`
  -> statement `game_data::frame_counter = game_data::frame_counter + 1;`
```

The byte sequence above is illustrative rather than a promise for that source
line. Compiler tests should use exact byte assertions for small canonical
cases, while the plan requires the mapping relationship regardless of later
code-generation improvements.

If unit code grows into the next configured origin, linking fails before any
output is loaded:

```text
error[C80-LAYOUT-006]: unit `main` ($2000..$2874) overlaps unit `video`
                       ($2800..$2A31)
```

### Example Stack and Fastcall Calls

For the default stack ABI:

```c
pub u16 add(u16 left, u16 right) {
    return left + right;
}

void example() {
    u16 result = add(1, 2);
}
```

the caller pushes right-to-left 16-bit slots and cleans them after `CALL`.
Conceptually:

```asm
    ld   hl,2
    push hl             ; right
    ld   hl,1
    push hl             ; left
    call math__add
    pop  bc             ; discard left slot
    pop  bc             ; discard right slot
    ; result is in HL
```

With IX established after saving the caller's IX, `left` is at `IX+4` and
`right` at `IX+6`:

```asm
math__add:
    push ix
    ld   ix,0
    add  ix,sp
    ld   l,(ix+4)
    ld   h,(ix+5)
    ld   e,(ix+6)
    ld   d,(ix+7)
    add  hl,de
    pop  ix
    ret
```

An 8-bit argument occupies the same 16-bit slot: `u8` is zero-extended, `i8`
is sign-extended, and `bool` is canonicalized to 0 or 1. This makes stack
offsets regular.

For an explicitly fast function, the initial convention might use HL and DE:

```c
pub @fastcall u16 add_fast(u16 left, u16 right) {
    return left + right;
}
```

```asm
    ld   hl,1            ; left
    ld   de,2            ; right
    call math__add_fast
    ; result is in HL

math__add_fast:
    add  hl,de
    ret
```

This exact register assignment remains a review decision. The important
behavior is that `@fastcall` is part of the exported signature, all callers use
the same convention, and ordinary functions continue to use stack slots.

## Phase-Two Integrated User Workflow

1. Open a C80 Source pane in the Developer Workspace.
2. Create or open one source file and select a target profile and load origin.
3. Edit source with syntax highlighting and inline diagnostics.
4. After a short idle debounce, inspect the last successful generated assembly
   in a toggleable right-hand pane.
5. Move the source cursor or select a source statement to highlight and reveal
   its generated instructions. Selecting assembly highlights the originating
   source span.
6. Build and Load the assembled segments into mapped writable memory.
7. Run, pause, set a source breakpoint, or step source while the current PC is
   highlighted in both views.

This workflow is explicitly Phase 2. It consumes the already-tested Phase 1
compiler API and metadata without changing the language or code generator to
serve UI-specific needs.

## Version-One Language

### Lexical and File Model

- UTF-8 source, with identifiers restricted initially to ASCII letters,
  digits, and underscore so symbol spelling is unambiguous to the assembler.
- `//` line comments and `/* ... */` block comments.
- Decimal and hexadecimal integer literals. Choose and document one canonical
  hexadecimal spelling while accepting at least `0x1234`. Support character
  literals and string literals for prefixed `str` declarations/call arguments
  in the first version; general byte-array literal initialization can wait.
- One source file is one independently placeable compilation unit. A unit can
  still be compiled and loaded by itself; a project build combines multiple
  units as described below.
- No textual preprocessor or C-style header files.
- Source locations use UTF-8 byte offsets internally and derive line/column
  information for display. Every token, AST node, diagnostic, IR operation,
  and generated instruction carries a `SourceSpan` or explicit synthetic
  provenance.

### Types

The first end-to-end slice supports:

- `void`, `bool`, `u8`, `i8`, `u16`, and `i16`;
- 16-bit `ptr<T>` values;
- immutable size-prefixed `str` values backed by static storage;
- global scalar variables, fixed arrays of scalar elements, and constants;
- array indexing;
- function parameters and scalar local variables; and
- statically bound functions.

The Z80 does not have distinct signed and unsigned storage. The backend has
only byte and word storage classes:

| Source type | Stored representation |
| --- | --- |
| `bool`, `u8`, `i8` | one byte |
| `u16`, `i16`, `ptr<T>` | one little-endian word |

`i8` and `i16` are source-level interpretations carried by loaded values, not
different variable layouts or load/store instructions. Keeping the
interpretation in a variable, parameter, or return type is still useful:

```c
u8 raw = 0xFE;
i8 delta = i8(raw);       // same bits, interpreted as -2

bool a = raw < 1;         // false: unsigned comparison of 254 and 1
bool b = delta < 1;       // true: signed comparison of -2 and 1
```

For example, assume an imported function returns a signed joystick displacement
in A and the following code appears inside a function with an IX frame:

```c
i8 dx = input::read_joystick_x();

if (dx < 0) {
    movement::move_left();
}
```

A direct lowering that preserves the source local can be:

```asm
    call input__read_joystick_x ; i8 result in A
    ld   (ix-1),a               ; dx occupies one ordinary byte

    ld   a,(ix-1)
    bit  7,a                    ; signed value is negative iff bit 7 is set
    jr   z,.not_negative
    call movement__move_left
.not_negative:
```

If `dx` is unused afterward, local-value propagation can eliminate its stack
slot entirely:

```asm
    call input__read_joystick_x
    bit  7,a
    jr   z,.not_negative
    call movement__move_left
.not_negative:
```

There is no signed load or signed byte representation here. The `i8` result
tells the compiler that `< 0` means a sign-bit test. An explicitly unsigned
spelling such as `(dx & 0x80) != 0` could generate the same instructions; the
signed type records that interpretation in the function contract and avoids
repeating it at each use.

Signedness selects comparison lowering, arithmetic versus logical right shift,
sign versus zero extension, and literal range checking. Addition, subtraction,
loads, stores, and same-width representation are otherwise identical. The
typed IR should therefore separate a value's interpretation from its byte/word
storage class instead of inventing signed Z80 storage.

Conversions make the interpretation change explicit. A same-width signedness
conversion preserves all bits; widening sign-extends an `i8` source and
zero-extends a `u8` source; narrowing keeps the low bits. This is fully defined
and does not inherit C's integer-promotion or overflow rules.

Add structs, pointers to structs, and field access in the language-usefulness
milestone after the scalar calling convention and source map are stable. These
are planned language features, but they should not delay the first compiled and
debuggable program.

Arrays do not decay implicitly to pointers. Constant indexes outside the
declared length are compile errors. Dynamic indexing does not add runtime bounds
checks in the baseline low-level language; an optional checked operation can be
considered later without changing ordinary array cost.

Pointers are always represented as `u16` addresses at runtime, but remain a
distinct compile-time type. Keep pointer semantics intentionally small:

```c
ptr<u8> source = ptr<u8>(0x9000);
ptr<u8> registers = ptr<u8>(0xBF00);

u8 first = source[0];
u8 second = *(source + 1);
registers[3] = 0x80;
```

- `ptr<T>(address)` is the explicit integer-to-pointer conversion;
- `u16(pointer)` is the explicit pointer-to-integer conversion;
- `*pointer` and `pointer[index]` produce an lvalue of `T`;
- adding/subtracting an integer scales by the size of `T` and wraps in the
  16-bit address space;
- equality/inequality are supported, while pointer ordering and pointer
  subtraction are omitted initially;
- every evaluated indirect read/write is emitted and remains in source order
  relative to other indirect accesses, port I/O, calls, and inline assembly; and
- arrays do not decay to pointers: use `&array[0]` explicitly.

This needs type checking and addressing rules, but no runtime pointer object,
allocator, ownership model, alias-analysis framework, or `volatile` qualifier.
Direct accesses to known locals, globals, and arrays can still be optimized;
only access through a pointer uses the conservative rule. Introduce a second,
optimizable pointer kind later only if measured code demonstrates that the
extra language distinction is worthwhile.

`str` is deliberately not a dynamic C string. A global declaration:

```c
pub str enemy_name = "hello world";
```

emits one length byte followed by the encoded payload and no terminator:

```text
0B 68 65 6C 6C 6F 20 77 6F 72 6C 64
```

The encoded payload is limited to 255 bytes. Initially accept printable ASCII,
common escapes, and `\xNN` byte escapes; add target character-set mapping later
instead of silently storing UTF-8 bytes that the emulated machine may not
interpret correctly.

A global `str` owns immutable storage. A `str` parameter or local value is a
16-bit reference to that size-prefixed storage, passed using the normal 16-bit
ABI. Support `value.len` as a `u8` read of the prefix and `value[index]` as a
`u8` payload read at prefix-plus-one. Constant out-of-range indexes are errors;
dynamic indexing follows the ordinary unchecked array rule. Do not support
string mutation, concatenation, allocation, or assignment into owned string
storage. String literals may be passed directly to `str` parameters by placing
anonymous prefixed data in the unit's constant-data area.

Do not support:

- `float`, `double`, wider integers, unions, bitfields, enums, or implicit C
  integer-promotion rules;
- function pointers, varargs, recursion, heap allocation, or runtime global
  initialization;
- C's full declarator grammar, implicit declarations, undefined signed
  overflow, or unspecified evaluation order; or
- a textual preprocessor or macro language.

All scalar sizes and conversions are defined by C80. Conversions between
different widths, signedness, integer and pointer types, or integer and `bool`
must be explicit except for a literal proven to fit its destination. Arithmetic
wraps at the declared width. Signed comparison and right-shift behavior must be
specified and tested rather than inherited accidentally from Rust or C.

Prefer type-constructor conversion syntax over C casts:

```c
u16 wide = u16(small);
bool ready = bool(status);  // false only when status is zero
u8 bit = u8(ready);         // always 0 or 1
```

The exact spelling remains part of the grammar review, but implicit conversion
must not be reintroduced as a convenience during code generation.

Structs and pointers to structs arrive in Phase 1D. Their intended use is:

```c
struct Sprite {
    u8 x;
    u8 y;
    u16 bitmap;
    bool visible;
};

pub Sprite enemies[8];

void move(ptr<Sprite> sprite, i8 dx) {
    sprite->x = sprite->x + u8(dx);
}

ptr<Sprite> player = ptr<Sprite>(0x9000);
```

Struct layout is declaration-order and packed unless a future explicit padding
construct says otherwise. In this example `x` is offset 0, `y` offset 1,
`bitmap` offsets 2–3 in Z80 little-endian order, `visible` offset 4, and the
computed `Sprite` size is 5. There is no implicit integer-to-pointer
conversion; `ptr<Sprite>(0x9000)` makes the absolute-address interpretation
visible. The exact pointer-constructor spelling remains a grammar decision.

### Statements and Expressions

The first end-to-end slice includes:

- blocks, variable declarations, expression statements, assignment, `if`,
  `else`, `while`, `break`, `continue`, `return`, and function calls;
- unary `!`, `~`, unary `-`, address-of `&`, and dereference `*`;
- array indexing, `+`, `-`, bitwise operators, shifts, comparisons, equality,
  `&&`, and `||`;
- pointer indexing, scaled pointer addition/subtraction, and pointer equality;
- `str.len` and read-only `str[index]`;
- compound assignment and increment/decrement only after their single-
  evaluation semantics are covered by tests.

Add `do/while` and `for` as straightforward lowering conveniences after the
core control-flow implementation. `switch`, `goto`, comma expressions,
ternary expressions, and C-compatible sequence-point rules are non-goals for
version one.

Evaluation order is always left-to-right. `&&` and `||` short-circuit. This is
part of the language contract and gives both users and the compiler a stable
model.

### Target-Specific Operations

Avoid pretending that machine I/O is portable C. Provide typed compiler
intrinsics for operations such as mapped-memory access and Z80 port input and
output. Machine-specific libraries can wrap those primitives later.

Use a target profile in compiler options rather than hard-coding TVC behavior
into the frontend:

```rust
pub enum C80Target {
    GenericZ80,
    Tvc,
    Zx82,
}
```

The first editor load path targets TVC mapped writable memory. The compiler
core and command-line tool should remain usable with `GenericZ80`; Zx82 load
integration can follow using the same segment result.

### Multiple Compilation Units

Use a project build rather than C headers or a general object-file linker. Each
`.c80` file is a named unit that emits at most one contiguous memory image. An
`origin` is required when the unit emits code or storage; a constants-only unit
needs none. A unit exposes functions, variables, constants, and later types
with `pub`; other units refer to them through an imported, qualified module
name:

```c
// video.c80
pub u8 frame_counter;

pub void draw_sprite(u16 address, u8 x, u8 y) {
    // ...
}
```

```c
// main.c80
import video;

void main() {
    u8 frame = video::frame_counter;
    video::draw_sprite(0x9000, 10, 20);
}
```

`pub` changes visibility, not storage or calling convention. A public variable
is ordinary mutable storage at its project-assigned final address; reads,
writes, address-taking, width, signedness, and later struct layout are checked
exactly as for a private variable. `pub const` exposes a compile-time value and
does not allocate storage unless its addressable form is introduced later.

Use `import video;` and `video::symbol` as the initial module syntax:

1. Parse every unit and collect its public function, global, constant, and
   later type signatures.
2. Resolve imports and type-check cross-unit references against that collected
   interface. There are no duplicated prototypes to drift out of sync.
3. Lower each unit independently, namespace private assembler symbols by unit,
   and preserve the unit in all source-map records.
4. Lay out each unit as code, literal/constant data, initialized globals, and
   zero-initialized globals, then combine units with one `ORG` per configured
   unit origin.
5. Run one final `assemble_program` call so absolute `CALL`, `JP`, and data
   references resolve across units and all final addresses are authoritative.
6. Reject duplicate exports, missing imports, signature mismatches, segment
   overlap, address overflow, and target-profile disagreement before loading.

An import is a semantic dependency, not a filesystem include. The project
manifest maps the unit name `video` to a path. The build coordinator reads and
parses every listed source once, collects all public interfaces, and then
analyzes bodies. Live compilation may cache unchanged parsed units by source
revision/content hash, but a full parse of small files should remain the
correctness baseline.

Because all units are assembled together, no relocation/object format or
general linker is required initially. Mutually referring units are valid at
the symbol-resolution level, but direct or mutual recursive function calls are
rejected by the statically known call graph.

A project build rebuilds/reassembles the complete project and then loads all
changed segments. This matters because code growth inside one unit can move an
exported function and therefore change `CALL` operands in its callers. Truly
independent hot replacement would require stable exported entry addresses or a
jump table; defer that mechanism until a real workflow needs it.

Use a small TOML project file as the authoritative source list and memory
placement description:

```toml
target = "tvc"
entry = "main::main"

[[unit]]
name = "main"
path = "src/main.c80"
origin = 0x8000

[[unit]]
name = "video"
path = "src/video.c80"
origin = 0x8400
```

Source files do not contain `ORG`; placement is external so the same unit can be
reused at another address. Reject `ORG` inside inline assembly as an attempt to
escape the unit's assigned sections. Single-file compilation continues to take
target and one origin directly from the CLI/editor. A project may later support
named memory regions, automatic sequential packing, or an optional ROM/RAM
split, but explicit origins for byte-emitting units keep the first memory model
observable and predictable.

### Data and Absolute-Memory Units

A data section is just a normal unit containing public or private globals and
no functions:

```c
// game_data.c80
pub u8 score;
pub u8 sprite_buffer[256];
pub u16 row_offsets[24];
pub str enemy_name = "hello world";
```

Its project `origin` places the resulting initialized and zero-initialized
storage. Other units use `import game_data;` and qualified variable/array
access exactly as they use exported functions.

Use pointer indexing for an absolute RAM range, bank window, or the occasional
memory-mapped device:

```c
// video_memory.c80
pub const ptr<u8> pixels = ptr<u8>(0x8000);
pub const u16 pixel_count = 16384;
```

Another unit can write `video_memory::pixels[offset] = colour;`. The pointer is
a compile-time 16-bit value and indexing uses normal pointer addressing. The
language's conservative indirect-access rule preserves the access without a
separate qualifier. The `pixel_count` constant provides a bound when code wants
to check one; raw pointers do not carry hidden runtime length metadata.

A constants-only hardware-description unit emits no code or storage and
therefore does not need an `origin` in the project:

```toml
[[unit]]
name = "video_memory"
path = "src/video_memory.c80"
```

An `origin` becomes required if that unit later emits a function or owns
storage. `ORG` remains project-managed; an explicit pointer constant is a value
in the language rather than a request to place generated output. Normal Z80
device access still uses typed `io_in`/`io_out` intrinsics because ports are a
separate CPU address space; pointers are not intended to disguise port I/O as
memory access.

## Inline Assembly

Inline assembly is a required version-one capability, but introduce it in two
steps.

The first form is a statement block containing normal rtvc helper-assembler
syntax:

```c
asm {
    di
    out (5), a
    ei
}
```

Initial semantics:

- the block may refer to assembler labels defined inside the block;
- individual assembly statements retain spans inside the C80 source;
- the compiler treats AF, BC, DE, and HL as clobbered, invalidates temporary
  register knowledge, and does not assume flags survive;
- IX remains the active frame pointer when a function has a frame, IY remains
  reserved, and inline assembly must not modify IX, IY, or SP unless an
  explicitly unsafe form is added;
- jumping into or out of an inline assembly block is rejected; and
- compiler variable names are not interpolated into raw assembly initially.

For example:

```c
u8 next = counter + 1;
bool was_zero = value == 0;

asm {
    xor a
    ld hl, 1234H
}

if (was_zero) {
    counter = next;
}
```

Before entering the raw block, the compiler must preserve any live value held
only in AF, BC, DE, or HL. It may keep a value that already has an authoritative
memory location there, or spill a register-only temporary to its stack frame.
After the block it reloads values when needed. Conceptually, generated code can
look like:

```asm
    ; Compute values and preserve them across asm.
    ld   a,(counter)
    inc  a
    ld   (ix-1),a       ; next

    ld   a,(value)
    or   a
    ld   a,0
    jr   nz,.not_zero
    inc  a
.not_zero:
    ld   (ix-2),a       ; materialized was_zero, not just Z flag

    ; User's raw block may replace A, F, B, C, D, E, H, and L.
    xor  a
    ld   hl,1234H

    ; Recreate register and flag state from preserved values.
    ld   a,(ix-2)
    or   a              ; establish fresh flags for the C80 condition
    jr   z,.done
    ld   a,(ix-1)
    ld   (counter),a
.done:
```

The exact instruction sequence is not contractual. The contract is that the
compiler never carries a register value or a condition-code assumption across
raw assembly. This is safe but can create spills; the later constrained form
lets the programmer describe inputs, outputs, and narrower clobbers so the
compiler can avoid unnecessary preservation.

The later constrained form adds explicit operands and clobbers, for example:

```c
asm(in: hl = src, in: de = dst, in: bc = count, clobber: flags) {
    ldir
}
```

Do not design a hidden constraint language during the first implementation.
Record this syntax as provisional and refine it using real routines once raw
inline assembly works safely.

## Calling Convention and Stack Model

Use one simple, documented stack ABI as the baseline:

- arguments are pushed right-to-left as 16-bit stack slots, including 8-bit
  values;
- the caller removes argument slots after the call;
- `u8`, `i8`, and `bool` return in A;
- pointers, `u16`, and `i16` return in HL;
- AF, BC, DE, and HL are caller-saved;
- IX is a callee-saved frame pointer when a frame is required;
- IY is reserved for future target/runtime use; and
- SP must be balanced at every control-flow merge and function return.

This ABI favors a compiler that is easy to verify over optimal call sequences.
Also support an explicit `@fastcall` function attribute for routines where call
speed matters. Fastcall is part of the function's public type, so every caller,
including a caller in another unit, must use the same convention. Freeze its
register assignment only after writing and measuring representative 8-bit,
16-bit, mixed-argument, nested-call, and inline-assembly examples. Adding or
removing `@fastcall` is an ABI change; it never silently replaces the stack
convention.

Locals initially use an IX-relative frame. Reject a frame whose offsets cannot
be encoded safely by the selected instruction sequences. Leaf functions with
no locals may omit the frame from the start; broader frame elimination belongs
to the later code-generation phase.

Reject direct and mutual recursion using the statically known call graph. This
does not prohibit normal nested calls or interrupt entry. Generated functions
must not use hidden global temporaries that make ordinary nested calls fail.

## Compiler Architecture (Phase 1)

Add a pure compiler subsystem under `src/compiler/` (exact module names may be
adjusted to match implementation pressure):

```text
src/compiler/
  mod.rs          public compile API and CompilationResult
  source.rs       FileId, SourceSpan, line index, source files
  project.rs      units, imports, exports, placement, build orchestration
  token.rs        token kinds and located tokens
  lexer.rs
  ast.rs
  parser.rs
  diagnostic.rs
  types.rs
  semantics.rs    names, types, constants, layouts
  ir.rs           typed control-flow and value operations
  lower.rs        AST to IR
  z80.rs          ABI-aware IR lowering to structured Z80 items
  source_map.rs   provenance joins and bidirectional indexes
```

Keep a narrow entry point:

```rust
pub fn compile(input: CompileInput<'_>) -> CompilationResult;
```

Compilation should return diagnostics instead of panicking or using UI
callbacks. The result owns all data needed by a CLI, editor, assembler view,
or tests:

```rust
pub struct CompilationResult {
    pub diagnostics: Vec<Diagnostic>,
    pub assembly: Option<GeneratedAssembly>,
    pub assembled: Option<AssembledProgram>,
    pub symbols: CompilerSymbols,
    pub source_map: SourceMap,
}
```

Use stable IDs allocated within one compilation for AST/IR/generated items.
IDs need not survive recompilation. Editor selection is restored by source
span and nearest enclosing statement, not by assuming IDs remain stable.

### Frontend

Use a hand-written lexer and recursive-descent/Pratt parser. The grammar is
small enough that parser behavior and recovery are more valuable than a parser
generator dependency.

Separate parsing from semantic analysis. The parser constructs located syntax
without consulting emulator state. Semantic analysis builds scopes, resolves
names, computes struct/array layouts, checks lvalues and conversions, and
produces a typed representation.

Error recovery is a first-order editor requirement. Synchronize at semicolons,
closing braces, and top-level declaration starters. An incomplete expression
should produce a focused diagnostic while allowing later functions to parse.
Cap cascading diagnostics and distinguish errors from warnings and notes.

### Typed IR

Do not emit Z80 directly from parser actions. Use a compact typed IR with
explicit blocks and control flow. It does not need SSA initially, but it must
make evaluation order, widths, signedness, loads, stores, calls, and branches
explicit.

Each IR operation contains:

- its operation and typed operands;
- a stable `IrId` for this compilation;
- the most specific useful source span;
- an optional enclosing statement span; and
- provenance describing whether it is source-derived or compiler-synthetic.

This layer is the right place for constant folding and unreachable-code
diagnostics. Avoid optimization that merges unrelated source spans until the
assembly/source selection behavior is defined.

For example, this source:

```c
game_data::frame_counter = game_data::frame_counter + 1;
```

can lower to typed, provenance-carrying operations like:

```text
%17 = LoadGlobal<u8>  game_data::frame_counter   span `game_data::frame_counter`
%18 = Const<u8>       1                          span `1`
%19 = AddWrap<u8>     %17, %18                   span `game_data::frame_counter + 1`
      StoreGlobal<u8> game_data::frame_counter, %19
                                                  span whole assignment
```

The exact enum spelling is not contractual. The important details are that the
width and wrapping operation are explicit, the load occurs before the add and
store, and expression/statement spans survive lowering.

### Structured Z80 Output and Existing Assembler

The compiler backend emits structured items, not arbitrary concatenated text:

```rust
pub enum Z80Item {
    Label(LabelId),
    Instruction(GeneratedInstruction),
    Data(GeneratedData),
}

pub struct GeneratedInstruction {
    pub id: AsmInstructionId,
    pub op: Z80Op,
    pub source: SourceProvenance,
}
```

`Z80Op` only needs variants the compiler can generate. Its renderer produces
one canonical rtvc assembly statement per instruction. Labels and data are
rendered as normal helper-assembler source. Feed the rendered program to
[`assemble_program`](../../src/emulator/asm.rs), then join its per-line
`AssembledLine` metadata back to `AsmInstructionId`.

The example IR above can become structured items such as:

```text
Instruction 41: Ld8(A, Absolute(game_data::frame_counter))
Instruction 42: Add8(A, Immediate(1))
Instruction 43: Ld8(Absolute(game_data::frame_counter), A)
```

The renderer may display:

```asm
    ld a,(game_data__frame_counter)
    add a,1
    ld (game_data__frame_counter),a
```

but instruction IDs and source provenance stay attached to the structured
items; they are not inferred by parsing these display strings.

This staged boundary gives the compiler typed operations and stable provenance
without first rewriting the entire existing text assembler. Extend
`AssembledLine` or add an assembler listing API so every emitted instruction
or data item reports its address, length, bytes, and original rendered line.
Do not parse the displayed assembly back to reconstruct compiler provenance.

If rendering exposes important limitations later, extract a shared structured
instruction encoder from `asm.rs`; do not maintain two opcode tables.

## T-State and Size Metadata (Phase 1)

The assembler listing is authoritative for final addresses and bytes. Derive
instruction timing through the existing disassembler metadata in
[`disasm.rs`](../../src/emulator/disasm.rs) initially, using the final address
and emitted bytes. Refactor the timing table into a shared assembler/disassembler
instruction metadata API if round-tripping becomes awkward.

Represent timing as data rather than only display strings:

```rust
pub enum StaticTiming {
    Exact(u16),
    Branch { not_taken: u16, taken: u16 },
    Unknown,
}
```

The assembly view shows timing per instruction from the first integrated
version. Source-level aggregation follows these rules:

- straight-line spans may show an exact sum;
- conditional spans may show a minimum/maximum only when both paths are
  represented completely;
- loops show condition/body cost or cost per iteration, not a misleading
  finite total; and
- calls show local call overhead separately unless a callee cost is known and
  intentionally included.

Do not delay the live assembly view for whole-statement cost analysis. Exact
instruction size, bytes, and timing already provide useful feedback.

For example:

```c
if (x != 0) {
    foo();
}
```

with this possible lowering:

```asm
    ld   a,(x)         ; 13 T
    or   a             ;  4 T
    jr   z,.done       ;  7 T not taken / 12 T taken
    call foo           ; 17 T plus callee
.done:
```

has a 29 T zero path and a 41 T nonzero path plus the callee. The compiler
should report those paths rather than a single misleading total. Similarly,
this loop:

```asm
.loop:
    ld   a,(count)     ; 13 T
    or   a             ;  4 T
    jr   z,.done       ;  7/12 T
    dec  a             ;  4 T
    ld   (count),a     ; 13 T
    jr   .loop         ; 12 T
.done:
```

is described as 53 T per executed iteration plus a 29 T final exit test, not
as a statically bounded total unless the compiler can prove the iteration
count.

## Source Map (Phase 1)

The source map is a first-class part of `CompilationResult`. Preserve this
chain:

```text
SourceSpan <-> AstId/IrId <-> AsmInstructionId <-> logical address range
```

At minimum, each final listing entry records:

```rust
pub struct MappedInstruction {
    pub id: AsmInstructionId,
    pub address: u16,
    pub bytes: Vec<u8>,
    pub text: String,
    pub timing: StaticTiming,
    pub expression_span: Option<SourceSpan>,
    pub statement_span: Option<SourceSpan>,
    pub function: FunctionId,
}
```

Build explicit indexes for:

- source offset/span to generated instruction IDs;
- instruction ID to expression and statement spans;
- address range to instruction ID and source spans; and
- function/global symbols to logical addresses and declared types.

Overlapping source spans are expected. Selection uses the smallest containing
expression span first and falls back to the enclosing statement. The UI must
be able to distinguish instructions with no direct source expression, such as
function prologues, branch glue, and stack cleanup; associate these with an
enclosing statement/function and mark them synthetic.

Initial addresses are logical 16-bit CPU addresses. TVC bank-qualified source
breakpoints depend on the broader debugger address model already listed in
[TODO.md](../../TODO.md#debugger). Until that model exists, Build and Load must
record the active mapping and reject or clearly label source breakpoints that
cannot be represented safely by the current address-only breakpoint set.

## Command-Line Tool (Phase 1)

Add an `rtvc-c80` binary before the editor depends on the compiler. It should:

- compile one C80 source file or a multi-unit project file;
- accept target and unit-origin options;
- write generated assembly and optionally raw binary or the existing
  `rtvc-asm-v1` TOML segment format;
- emit human-readable diagnostics with file, line, column, and source context;
- optionally emit a machine-readable compiler metadata file containing source
  maps, symbols, bytes, and timings once that schema is stable; and
- return nonzero for compile or assembly errors.

Do not stabilize a JSON/TOML source-map format before the in-process types have
been exercised by the editor. Version any eventual external schema explicitly.

Update the [Development and Testing Skill](../skills/development/SKILL.md) when
the command becomes real.

## Editor and Live Assembly View (Phase 2)

Add compiler/editor state outside `DebuggerUi`, preferably in a focused
`src/ui/source_editor.rs` controller. The debugger consumes compiled maps but
should not own source buffers or compilation scheduling.

Add a `C80 Source` workspace tab. Its initial layout contains:

- a toolbar with New/Open/Save, target, origin, Build, Build and Load, and the
  generated-assembly toggle;
- a multiline `egui::TextEdit::code_editor()` source buffer;
- a small custom C80 syntax highlighter based on `LayoutJob`, without adding a
  full syntax framework initially;
- a diagnostics area with clickable errors and warnings; and
- a toggleable right-hand generated assembly listing.

The assembly listing is read-only and row-oriented rather than another
editable `TextEdit`. Each row can show address, bytes, canonical instruction,
size, and T-states. This makes source-map selection, current-PC highlighting,
and scrolling deterministic.

For example, placing the source cursor inside the addition highlights all three
rows produced for the assignment:

```text
SOURCE                                      GENERATED Z80

game_data::frame_counter =                  2034  3A 00 30  ld a,(3000H)  13 T
    game_data::frame_counter + 1;            2037  C6 01     add a,1        7 T
                                             2039  32 00 30  ld (3000H),a  13 T
```

Clicking address `$2037` selects only the expression
`game_data::frame_counter + 1`; clicking a synthetic prologue row selects the
enclosing function because it has no narrower source expression. If PC is
`$2039`, the final store row and the whole assignment statement receive the
current-execution highlight.

Required interactions:

- source cursor/selection highlights all mapped assembly rows and scrolls the
  first relevant row into view;
- clicking an assembly row selects and reveals the most specific source span;
- diagnostics select their source span;
- the current PC highlights the matching assembly row and source statement;
- the last successful assembly remains visible and dimmed when the current
  source has errors; and
- Build and Load is disabled when the current source has no successful result.

A line-number/breakpoint gutter is valuable but not required for the first
editor slice. Add it with source breakpoint integration rather than building a
decorative gutter that later needs replacement.

### Compilation Scheduling

Use a 150 ms idle debounce as the starting value and make it an implementation
constant, not a user preference initially.

- Native builds compile an owned source snapshot off the UI path and return
  results through a channel tagged with a monotonically increasing revision.
  Discard results older than the newest requested revision.
- `wasm-full` may compile synchronously after the debounce while programs are
  small; measure UI frame time before introducing web workers.
- Explicit Build bypasses the debounce.
- Compilation must not borrow emulator state or egui objects.
- Keep the last successful `CompilationResult` separate from diagnostics for
  the current revision.

Do not call this implementation incremental compilation. Recompile the whole
small translation unit until measurements justify more complexity.

### Persistence Boundary

Do not store source text or project file paths inside
`rtvc-workspace.json`; that file describes dock layout. The existing
[developer-project backlog](../../TODO.md#developer-workspace) is the eventual
home for source files, open buffers, target/origin settings, and source
breakpoints.

Before project management exists, support one session buffer plus ordinary
Open/Save behavior. Native builds may remember an active path only for the
running session. Browser builds use the existing supported file-dialog/download
patterns and must not pretend to persist an inaccessible host path.

## Build, Load, and Debugger Integration (Phase 2)

Build and Load uses assembled segments, not the rendered listing text:

1. Require the emulator to be paused or explicitly pause it.
2. Validate that every segment fits the 16-bit address space and is writable
   through the active machine's mapped-memory interface.
3. Write all segments as one operation from the UI's point of view. If a write
   fails validation, write nothing.
4. Record the compilation revision, target, segment ranges, and current machine
   mapping as the active loaded program.
5. Optionally set PC to the configured entry function only through an explicit
   Run/Set Entry action; Build and Load alone should not silently start code.

Add source-level debugger operations after address mapping is reliable:

- PC to source highlighting while paused and while stepping;
- source breakpoint toggle mapped to the first executable instruction of a
  statement;
- source step that continues until PC enters a different mapped statement,
  with a bounded instruction count and normal breakpoint/interrupt handling;
- assembly instruction step through the existing debugger path; and
- symbol exposure so compiler globals/functions can be navigation targets.

Source-level stepping must define behavior for inline assembly, synthetic
prologues, calls into code without source, interrupts, and optimized spans.
Implement PC highlighting and source breakpoints before source stepping.

## Symbol and Typed Memory Integration (Phase 2)

Compiler symbols should record logical address, size, type, declaration span,
and scope. Initially expose them to navigation and the existing memory view.
A typed variable inspector for structs/arrays is a later extension and should
consume compiler layout metadata rather than duplicate type interpretation in
the debugger.

Do not merge compiler symbols into the immutable ROM symbol database. Treat
them as active developer-program symbols and eventually persist them through
the developer project.

## Diagnostics and Failure Behavior

Diagnostics contain severity, stable code, message, primary span, and optional
related spans/notes. Cover at least lexical, syntax, duplicate-name,
unresolved-name, type, constant-range, stack-frame, inline-assembly, assembler,
and load-validation failures.

An assembler error in generated code is a compiler/backend failure unless it
originates in an inline assembly block. Generated-code failures should include
the related source span and generated assembly row so they are actionable
without exposing an internal panic.

The compiler must not emit a partially loadable program after an error.
Warnings do not disable Build and Load unless explicitly documented.

## Implementation Phases

### Phase 1: Standalone Compiler

Phase 1 delivers the complete non-UI compiler library and CLI. Implement it in
the following internal milestones; these are not separate product phases.

#### Phase 1A: Language Contract and Frontend

1. Choose the final language name/file extension and write a checked-in grammar
   and semantic examples as compiler tests.
2. Add source files/spans, located tokens, diagnostics, lexer, parser, AST, and
   error recovery.
3. Implement scopes, scalar and basic pointer types, address/dereference and
   pointer indexing, fixed scalar arrays/indexing, prefixed strings, constants,
   function signatures, explicit conversions, and typed expression/statement
   validation.
4. Add unit interfaces, `pub` exports, imports, qualified lookup, and call-graph
   recursion rejection.
5. Document evaluation order, overflow, conversions, and rejected C syntax.

Exit criterion: valid scalar programs produce a typed representation;
incomplete and invalid editor-like inputs produce bounded, located diagnostics
without panics.

#### Phase 1B: IR, ABI, and First Executable Programs

1. Add typed IR and lowering for scalar globals, basic pointers, fixed
   arrays/indexing, prefixed strings, locals, expressions, functions, calls,
   `if`, `while`, and `return`.
2. Implement the stack ABI, frame layout, labels, control-flow validation, and
   structured Z80 items.
3. Define and test the explicit `@fastcall` ABI without changing stack-call
   defaults.
4. Add project placement, loadable and constants-only units, namespaced private
   symbols, cross-unit references, and overlap validation.
5. Render canonical helper assembly, assemble all units together with
   `assemble_program`, and return final segments and symbols.
6. Add `rtvc-c80` with single-file/project assembly and binary/TOML outputs.

Exit criterion: command-line fixtures compile, assemble, load through existing
debugger tooling, run to completion, and produce expected memory/register
results in a `FakeBus` or machine test.

#### Phase 1C: Provenance, Listing, and Timing

1. Carry expression/statement provenance through IR and Z80 items.
2. Extend assembler listing metadata and join IDs to final addresses/bytes.
3. Produce bidirectional source maps and compiler symbols.
4. Add structured timing metadata and per-instruction size/T-state display data.
5. Test one-to-many, many-to-one, synthetic, branch, and data-item maps. Add
   inline-assembly map cases when raw inline assembly lands in Phase 1D.

Exit criterion: every generated byte is owned by a data item or mapped
instruction; every displayed instruction maps back to source or is explicitly
synthetic.

#### Phase 1D: Complete the Planned Language

1. Add richer array initializers, structs, layout metadata, field access, and
   pointer-to-struct access on top of the basic pointer operations from the
   first executable milestone.
2. Add `for`, `do/while`, compound assignment, increment/decrement, and useful
   constant/data declarations.
3. Add raw inline assembly with conservative clobbers, then design explicit
   operand/clobber syntax from measured examples.
4. Add typed port/memory intrinsics and small target libraries.

Exit criterion: representative TVC routines can express structured data,
loops, function calls, hardware access, and optimized inline assembly without
unsupported compiler workarounds.

#### Phase 1E: Code Quality and Static Cost

1. Add local constant folding, dead-block removal, branch simplification, and
   conservative peephole passes that preserve provenance.
2. Track register values across short basic blocks and eliminate unnecessary
   loads/stores.
3. Remove avoidable frames from leaf functions and improve calls within the
   already-defined stack and `@fastcall` ABIs.
4. Add source-level static cost summaries where control flow permits honest
   values.

Optimization is successful only when byte/T-state tests improve without
breaking source provenance or debug metadata. Optimization depth need not block
the initial Phase 1 release once the generated code is correct and transparent.

Phase 1 is complete when `rtvc-c80` can compile the planned language from a
single file or project, emit normal assembly/loadable segments, and return the
diagnostics, symbols, bidirectional source map, bytes, and static timing data
that Phase 2 will consume. No editor code is required for this milestone.

### Phase 2: Editor and Debugger Integration

Phase 2 adds UI and emulator interaction without moving parsing, compilation,
mapping, or timing logic into egui/debugger modules.

#### Phase 2A: Developer Workspace Editor

1. Add the C80 Source pane, syntax highlighter, diagnostics, and file actions.
2. Add idle-debounced revisioned compilation without blocking native emulation.
3. Add the toggleable assembly listing with bidirectional selection.
4. Preserve the last successful listing when current source is invalid.
5. Add native and `wasm-full` UI tests or focused controller tests for revision
   ordering, stale-result rejection, and selection mapping.

Exit criterion: editing a representative program keeps the emulator responsive
and updates the correct assembly rows and diagnostics predictably.

#### Phase 2B: Load and Debug

1. Add target/origin settings and transactional Build and Load validation.
2. Add current-PC highlighting and compiler symbol navigation.
3. Add source breakpoints, including clear behavior for unmappable/banked code.
4. Add source-level stepping after highlighting and breakpoints are stable.
5. Connect active compiled-program state to future developer-project
   persistence without coupling it to dock layout.

Exit criterion: a user can compile, load, breakpoint, run, and step a C80
program while source and assembly views track the emulator PC.

#### Phase 2C: Measured Runtime Cost

Join instruction-trace execution counts and T-states to source-map IDs for
measured hot spots. Keep compiler-provided static cost and emulator-measured
runtime cost visibly distinct. This is a Phase 2 extension, not part of the
standalone compiler milestone.

## Validation Strategy

### Phase 1 Compiler Tests

- lexer/parser golden tests, including incomplete input and recovery;
- scope, type, conversion, width, signedness, and constant-range tests;
- IR snapshots for evaluation order and control flow;
- ABI tests for arguments, returns, frames, nested calls, and register clobbers;
- generated assembly that round-trips through the existing assembler;
- execution tests using `FakeBus` and the Z80 core for representative programs;
- inline-assembly acceptance, diagnostic, clobber, and source-span tests;
- source-map coverage tests proving every emitted byte/listing row has known
  provenance;
- compiler CLI exit codes, project builds, and output formats; and
- existing assembler/disassembler and Z80 FUSE regression suites.

Prefer semantic assertions over large fragile text snapshots. Use small
canonical assembly snapshots where readability is the behavior under test.

### Phase 2 Editor and Debugger Checks

- transactional mapped-memory loading and rejection of ROM/overflow ranges;
- source/assembly selection in both directions;
- current-PC highlighting and breakpoint address resolution;
- stale live-compilation result rejection;
- native and `wasm-full` compilation; and
- existing debugger and workspace regression tests.

During Phase 1, measure representative compile latency and set a practical
initial target such as under 50 ms for a few-thousand-line single-file program
on a development machine. During Phase 2, measure UI frame impact separately.
Replace both targets with measured repository fixtures rather than treating
them as hard language guarantees.

## Documentation

When the first language slice is stable:

- add `info/c80.md` as the authoritative language, ABI, inline assembly,
  compiler CLI, generated metadata, and editor workflow reference;
- update [info/rtvc.md](../../info/rtvc.md) for architecture, UI integration,
  build/load behavior, persistence, and WASM boundaries;
- update [info/assembler.md](../../info/assembler.md) for any new listing or
  structured metadata API that also affects assembler users;
- update [README.md](../../README.md) with the concise user workflow;
- update the [Development and Testing Skill](../skills/development/SKILL.md)
  with compiler commands and validation; and
- extend the [Hungarian documentation tree](../../info.hu/) once terminology
  and syntax are stable rather than translating a rapidly changing draft
  language.

## Non-Goals

- ISO C compatibility or compiling existing C codebases unchanged.
- Floats, wider integers, unions, bitfields, enums, function pointers, varargs,
  recursion, heap allocation, runtime global initialization, implicit C
  promotions, or C's full declarator and implicit-conversion rules.
- LLVM, SSA-based global optimization, a general linker, object files, or a
  macro preprocessor.
- IDE-scale editing features such as multicursor, folding, semantic rename,
  language-server protocol, or very large-file rope storage.
- Hiding generated assembly or promising optimal Z80 output.
- Whole-program worst-case execution-time analysis.
- Runtime profiling before static maps and instruction-trace integration are
  reliable.
- Making compiler/editor state part of global workspace-layout persistence.

## Decisions to Refine Before Implementation

1. **Language name and extension:** keep `C80`/`.c80`, or choose an rtvc/TVC-
   specific name before it appears in file formats and documentation.
2. **First target:** Generic Z80 compiler plus TVC editor loading is proposed;
   decide whether the first runtime fixtures should be TVC-only.
3. **Fastcall ABI:** choose register assignments from measured representative
   signatures while keeping the stack ABI as the default.
4. **Project details:** choose the project filename/extension, decide whether
   unit names must always be explicit, and define path resolution relative to
   the project file.
5. **Later placement:** decide whether named memory regions, automatic
   sequential packing, or optional ROM-code/RAM-data splitting are useful after
   contiguous per-unit placement is proven.
6. **First language slice:** confirm fixed scalar arrays/indexing and the small
   typed-pointer model in the first executable milestone, while structs and
   pointer-to-struct field access wait for Phase 1D.
7. **String encoding:** confirm the one-byte prefix, initial ASCII/escape rules,
   and whether target-specific character-set mapping belongs in the first TVC
   library milestone.
8. **Inline assembly syntax:** confirm raw-block restrictions and whether a
   minimal `clobber` list belongs in the first form.
9. **Assembler boundary:** validate the structured-item-to-canonical-text join
   against branches, labels, inline assembly, and multiple segments before
   considering a shared direct encoder.
10. **Source stepping:** define call/interrupt behavior and its relationship to
   existing instruction stepping before assigning shortcuts.
11. **Project dependency:** decide how much file/origin persistence should wait
   for developer-project management versus shipping as session-only editor
   state.

These are deliberate review points, not permission to leave foundational
behavior implicit during implementation.
