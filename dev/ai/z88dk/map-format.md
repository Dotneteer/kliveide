# The z88dk linker map (`zcc -m`, with `-debug`)

Observed on v2.4 (and v2.3) with sccz80. `zcc -m -o prog …` writes `prog.map`, one symbol per line,
sorted by name. ~300 KB for a 20-line program with `-debug` (most of it library records).

## Line grammar

```
NAME<spaces>= $HEX ; kind, scope, def, module, section, location
```

| Field | Values seen |
|---|---|
| `NAME` | the symbol, hex-escaped (below); padded with spaces to column 32 when shorter |
| `$HEX` | the value: an address, a constant, or (banked code) `bank << 16 \| address`, e.g. `$1C000` |
| kind | `addr` (a location), `const` (a `defc` / computed value) |
| scope | `local`, `public` |
| def | empty, or `def` for symbols the linker defines itself (`__head`, `__BANK_1_size`, …) |
| module | the object module: `main_c` for `main.c`, `X___m_c` for `../m.c`, `zx82_crt0`, library names |
| section | `code_compiler`, `bss_compiler`, `rodata_compiler`, `data_compiler`, `code_l_sccz80`, `BANK_1`, … or empty |
| location | `file:line`; for a C symbol `file::function::level::block:line`; empty for linker symbols |

Parse with `^(\S+)\s*= \$([0-9A-Fa-f]+) ; ([^,]*), ([^,]*), ([^,]*), ([^,]*), ([^,]*), (.*)$`. The
location may contain `:` (Windows drive letters, the `::` separators): the **line is the digits
after the last `:`**.

## Hex escaping

In line-record names, every character other than `[A-Za-z0-9]` is written `_xx` (two lowercase hex
digits of its code), and a literal `_` as `_5f`. **`__CDBINFO__` names escape digits too**
(`501` → `_35_30_31`). Either way a `_` always starts an escape, so one decoder reads both: `main.c` → `main_2ec`, `/` → `_2f`, `::` → `_3a_3a`. The
location field is **not** escaped, so Klive reads file and line from it, not from the name.

## Debug line records (`-debug`)

- `__C_LINE_<line>_<escaped file[::function::level::block]>` — kind `addr`, scope `local`. One per
  source line the compiler saw, **including every line of every header** the preprocessor read.
  - Lines that emit code have a section (`code_compiler`, or `BANK_n`) and a `file::function::…`
    location. Lines outside functions (declarations, `#include`s, header lines) have an **empty
    section** and all sit at the same address (the start of the module's code): Klive drops them.
  - Temp files appear: `/tmp/tmpbPIcPOaO.i:2` (the preprocessed file) and
    `/tmp/tmpzccc8xvzYRv/zcc_opt.def:4` (the pragma file). Their names change every build; everything
    else in the map is identical between two builds of the same source (the image and the `.tap`
    are byte-identical).
- `__ASM_LINE_<line>_<escaped file>` — the same for assembly sources (the crt0 and any `.asm` in the
  project), `file:line` location.
- **sccz80 reads one line ahead.** For an expression statement, the marker for the *next* line is
  emitted before the statement's code, so two lines share an address and the code belongs to the
  **lower** one. Observed (`main.c`, v2.4):

  ```
  __C_LINE_16_…main… = $831C   counter = add(3, 4);   <- the code at $831C is line 16's
  __C_LINE_17_…main… = $831C   pt.x = counter;        <- line 17's code ($8329) has no record
  __C_LINE_18_…main… = $8335   printf(...)            <- the code at $8335 is line 18's
  __C_LINE_19_…main… = $8335   return 0;
  ```

  The map keeps only the **first** marker of a name (sccz80 repeats markers), so a line whose code
  follows a shared marker has no address of its own. Klive therefore maps an address to the
  **lowest** line recorded at it, and still binds a breakpoint on the higher line to that address.
- A function's first line record is its opening line (`int add(int a, int b)` / `{`) at the function's
  address, where the code is `call l_debug_push_frame`; the first statement starts 3 bytes later.

## Symbols

- C globals and functions: `_name` (`_main`, `_add`, `_counter`), kind `addr`, scope `public`, section
  `code_compiler` / `bss_compiler` / `data_compiler` / `rodata_compiler`. A `static` is `local`.
- `CRT_ORG_CODE` (const, from the crt0) is the load address. `__head` is the image's first address;
  `__tail` is `$0000` on `+zx` (not usable). `__CODE_head` is **not** the start of user code (crt0 and
  library sections come first).
- Section bounds: `__<section>_head`, `__<section>_tail`, `__<section>_size` (all `def`).

## Banked code

- `#pragma codeseg BANK_n` (sccz80) puts a module's code in section `BANK_n`. The map gives its
  symbols and lines as `n << 16 | address` (`_banked_add = $1C000`, bank 1 at `$C000`), and
  `__BANK_n_head`/`__BANK_n_size` give its extent.
- The build writes the bank's bytes to `<output>_BANK_n.bin` (only for banks that hold something);
  the main image (`<output>`) holds the resident code. `-create-app` folds the banks into the `.tap`.
