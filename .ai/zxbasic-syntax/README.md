# ZX BASIC Language Reference (for Klive's own compiler work)

This folder is Klive's **independent description of the Boriel ZX BASIC language**, kept so that
the ZX BASIC compiler being built into Klive, and every AI session that works on it, has a
reference that is not the upstream source code, and so that new upstream releases can be checked
for syntax changes mechanically.

| File | What it is |
| --- | --- |
| `zxbasic-syntax.json` | The specification: lexical rules, keywords, types, every statement and function with its own EBNF, operators and precedence, preprocessor directives and pragmas, inline-asm interface, CLI options, warning codes, and the NextBuild `CODEBANK` extension. Written in Klive's own words and own EBNF. |
| `upstream-fingerprint.json` | Which upstream release the spec describes (tag, commit, date, version) and the git blob SHA + size of every upstream file that can carry a syntax change. **Hashes only** — no upstream content. |
| `../../scripts/zxbasic-syntax-check.cjs` | Compares the fingerprint with upstream now and lists exactly which files to re-read. |

## The licence rule — read this before touching the spec

Upstream `boriel-basic/zxbasic` is **AGPL-3.0-or-later** for the compiler (`src/` except
`src/lib/`), **MIT** for its runtime and standard library (`src/lib/arch/*/runtime`, `stdlib`),
and **CC BY 4.0** for `docs/`. Klive is MIT. The spec stays MIT-safe only if it is a description
of *facts about the language*, made independently:

- **Read upstream to discover; describe in your own words.** Keyword names, statement forms,
  operator precedence, option names, warning codes and semantics are facts and may be recorded.
- **Never transcribe.** No grammar productions, code, comments, docstrings or error-message text
  from the `.py` files, in any language. Do not preserve the parser's rule order or its internal
  names. Write your own EBNF from what the language accepts.
- **Docs pages may be paraphrased** (CC BY 4.0). Keep the attribution line in the spec header.
- **Never copy upstream files into this repository.** The fingerprint holds hashes and sizes only.
  A refresh reads upstream on GitHub or in a scratch checkout outside the repo.
- The same rule applies to the NextBuild fork (`em00k/NextBuildStudio`, `zxbasic1.18.7-nb10`),
  which is AGPL-derived: its `CODEBANK` syntax and semantics are facts; its implementation is not.

## How the spec is organised (`zxbasic-syntax.json`)

Top-level keys, in file order. Arrays are sorted by `name` so that git diffs stay readable, and
every item is one object so that a change touches one hunk.

| Key | Content |
| --- | --- |
| `meta` | Spec format version, the upstream version described, the date of the last full review, the licence/attribution note, and the reading rule above in one sentence. |
| `lexical` | Case sensitivity (and the pragma that changes it), comment forms, line and statement structure, line numbers, labels, identifiers and type suffixes, numeric and string literal forms and escapes. |
| `keywords` | Every reserved word: `name`, `kind` (`statement`, `function`, `operator`, `modifier`, `type`, `declaration`, `misc`), `docs` (upstream docs page, if any), `since` (release, when known), `notes`. |
| `types` | Each primitive type: size, signedness, range, suffix, literal forms, implicit-conversion rank; plus the rules for the default type of untyped identifiers and for mixed-type expressions. |
| `operators` | The precedence table (highest first, with associativity) and one entry per operator with operand and result types. |
| `statements` | One entry per statement: `name`, `syntax` (Klive's EBNF, one string per form), `semantics`, `constraints`, `diagnostics` (warning codes it can raise), `docs`, `since`, `notes`. Block statements list their closing forms. |
| `functions` | Built-in functions and pseudo-functions (`PEEK`, `IN`, `USR`, `LBOUND`, `CAST`, `SIZEOF`…) with parameter and result types. |
| `subprograms` | `SUB`/`FUNCTION`/`DECLARE` rules: parameter passing (`BYVAL`/`BYREF`), calling conventions (`STDCALL`/`FASTCALL`), return types, forward declarations, recursion, attributes. |
| `preprocessor` | Directives (`#include`, `#define` with and without parameters, `#undef`, `#if`/`#ifdef`/`#ifndef`/`#else`/`#endif`, `#line`, `#pragma`, `#require`, `#init`…), include search rules, built-in macros, and every `#pragma` option with its effect. |
| `inline_asm` | `ASM … END ASM`: how the block is delimited, which assembler dialect upstream expects, how BASIC symbols are visible inside it, and Klive's own rule for its native dialect. |
| `cli` | Every `zxbc` command-line option: short and long forms, argument, default, meaning, and the Klive option it maps to (filled in as the Klive compiler grows). |
| `diagnostics` | Warning codes (`W100`…) and the classes of errors, each with a one-line meaning in Klive's words. |
| `extensions` | Syntax that is not upstream: currently `codebank` (NextBuild's `CODEBANK … END CODEBANK`, `#pragma codebank`, `FARPTR`, `<farmem.bas>`, CLI flags, `banks.json`). Each extension names its origin and version. |
| `changes` | A log of upstream releases reviewed, newest first: release, date, and the syntax-relevant changes found (or "none"). This is how a session sees what changed since the spec was last touched without reading upstream's changelog again. |
| `docs_errata` | Places where upstream's documentation disagrees with itself or with the implementation (for example the Float return registers). The spec follows the implementation; this list stops a later session from "correcting" the spec back to a wrong docs page. |

## Refreshing the spec when upstream releases

1. Run the checker. It needs network access and nothing else:

   ```bash
   node scripts/zxbasic-syntax-check.cjs
   ```

   Exit code 0 means the latest upstream release matches the fingerprint and the spec is current.
   Exit code 1 prints the releases since the snapshot, the changed files (each with a link), any
   *new* file in a watched folder (a new `docs/*.md` page is the cheapest signal of a new statement
   or function), and removed/renamed files. `--ref main` compares with the branch instead of the
   latest release; `--json` gives the same report for scripts.

2. Read only the listed files, upstream, outside the repo. Start with `CHANGELOG.md` and the
   `docs/*.md` pages; go to `src/zxbc/keywords.py` (new reserved words), `zxblex.py` (new literal
   or token forms), `zxbparser.py` (new statement forms — read to learn what is accepted, then
   close it before writing), `src/zxbpp/` (directives and pragmas), `src/zxbc/args_parser.py`
   (options) and `src/api/errmsg.py` (warning codes) only when the checker names them.

3. Update `zxbasic-syntax.json` in Klive's own words. Add an entry to `changes` for the release
   even when nothing syntax-relevant changed, so the next session can see it was reviewed. Keep
   arrays sorted by `name`.

4. Re-pin the fingerprint to the reviewed release. This is a claim that the spec now describes it,
   so do it last:

   ```bash
   node scripts/zxbasic-syntax-check.cjs --update --ref vX.Y.Z
   ```

5. Run the spec's own test (`test/ai-notes/zxbasic-syntax.test.ts`): it checks the JSON parses,
   the arrays are sorted, every statement has at least one syntax form, every keyword is
   classified, and the fingerprint names the same upstream version as `meta`.

The project author checks upstream releases regularly; a scheduled job can run step 1 and stop on
exit code 1.

## What is deliberately not in the spec

- The **runtime ABI** (calling conventions, float format, string and array layouts, `.core.`
  runtime entry points): that is a property of upstream's MIT runtime, not of the language, and
  it lives with the compiler plan and the runtime adapter.
- **Code generation** and **optimisation** behaviour of upstream: not language, and reading it
  for design ideas is exactly what the licence rule forbids.
- **Boriel's standard library API** (`#include <print42.bas>` etc.): the `library` docs pages are
  fingerprinted so that additions are noticed, but the API catalogue belongs to the runtime
  adapter, not here.
