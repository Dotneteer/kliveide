# `__CDBINFO__` records (`zcc -debug`, sccz80)

With `-debug`, sccz80 writes type and variable information as map symbols named
`__CDBINFO__<escaped record>`, value `$0001` (meaningless), location = the module's last line. The
record text (after unescaping, see `map-format.md`) follows the shape of SDCC's CDB debug format.
Observed on v2.4 for:

```c
int counter;
struct point { int x; char y; };
struct point pt;
int add(int a, int b) { int s = a + b; return s; }
int main(void) { ... }
```

## Record kinds

| Prefix | Meaning | Example (unescaped) |
|---|---|---|
| `F:` | a function | `F:G$add$0_0$0({0}DF,SI:S),C,0,0,0,0,0` |
| `S:` | a variable | `S:G$counter$0_0$0({2}SI:S),E,0,0` |
| `T:` | a struct (or union) type | `T:Fmain.c$point[({0}S:S$x$0_0$0({2}SI:S),Z,0,0)({2}S:S$y$0_0$0({1}SC:S),Z,0,0)]` |

### Scope and name

`<kind>:<scope>$<name>$<level>_<block>$<?>(<type>),<address space>,<on stack>,<offset>`

- scope `G` — global; `F<file>` — file-static (struct types are `T:F<file>$<name>`);
  `L<file>.<function>` — a parameter or local of that function (`Lmain.c.add`).
- level / block: nesting depth and block number (parameters `0_0`, a local in the body `1_0`).

### Types

`({size}<chain>)` — `size` in bytes, then a comma-separated chain of type codes, outermost first:

| Code | Type |
|---|---|
| `SC` | char (1) |
| `SI` | int (2) |
| `SL` | long (4) |
| `SF` | float (size = the math library's: 4 for IEEE, 6 for math48) |
| `SV` | void |
| `ST<name>` | struct `<name>` (members in the `T:` record) |
| `DG` | pointer (generic, 2 bytes) |
| `DA<n>x` | array of `n` |
| `DF` | function (its return type follows) |

Each chain ends in `:S` (signed) or `:U` (unsigned): `SC:U` is `unsigned char`, `DG,SC:U` a pointer
to unsigned char, `DA12x,SC:S` `char[12]`.

### Address space and location

| Space | Meaning | Where the value is |
|---|---|---|
| `E` | external RAM (a global) | the map's `_name` symbol |
| `B` | the stack (a parameter or local) | `on stack` = 1, `offset` = bytes from the frame pointer |
| `C` | code (functions) | the map's `_name` symbol |
| `Z` | a struct member | `{offset}` before `S:S$member` in the `T:` record |

## Frames

The `B` offsets are relative to sccz80's **debug frame pointer**, which `-debug` builds maintain in
memory, not in IX:

- Every function's first instruction is `call l_debug_push_frame`; it leaves through
  `call l_debug_pop_frame` before its `ret`.
- `l_debug_push_frame` pushes the previous frame pointer (from the word `__debug_framepointer`)
  just below the return address and stores the address of that slot in `__debug_framepointer`.
- So, inside a function after its first instruction, with `FP = word at __debug_framepointer`:
  `[FP]` = the caller's FP, `[FP+2]` = the return address, parameters at `FP+4…` (the **last**
  parameter nearest: sccz80 pushes left to right, so `b` is at `FP+4` and `a` at `FP+6`), and
  locals below FP (`s` at `FP-2`). This matches the CDB offsets (`a`: 6, `b`: 4, `s`: -2).
- At the function's own first address (before the call), FP still belongs to the caller.
- The chain ends at `main`'s frame, whose saved FP is the initial value of `__debug_framepointer`
  (0 after the crt0 clears BSS).

Functions declared `__z88dk_fastcall` / `__z88dk_callee` change where parameters arrive; Klive only
locates parameters of the default (`__smallc`/`__stdc`) convention.
