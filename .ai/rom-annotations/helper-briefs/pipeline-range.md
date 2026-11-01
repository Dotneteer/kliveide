# Brief: annotate one range of routine cards

You annotate one range of a ROM page from its routine cards and write one `.ann` file. The session that
briefs you gives: the ROM and page, your range file (`.rom-annotations/work/<rom>/page-<n>/cards/range-NN.txt`),
the `.ann` file to write, and the names already given elsewhere (this page, related sidecars).

## The rules (read `.ai/rom-annotations/README.md` first)

- **Provenance (D4).** Describe only what the instructions in front of you do. Never write a comment, a
  boundary or a name from memory of a published disassembly or listing of this ROM: if a sentence or a name
  comes to mind before you have read the code, throw it away. A name you would recognise from elsewhere is a
  remembered one.
- **Facts on a card are evidence, not text (D7).** The card gives callers, callees, register facts, exits,
  memory, I/O, coverage and decoded texts. Use them to understand; never copy them as the description.
- **The contract (D10).** A subroutine's synopsis ends with `Entry:`, `Exit:`, `Error:` (when it can fail),
  `Changes:`, `Keeps:` (when useful), `Observed:` (probe results), in that order. `Changes:` lists registers
  (`AF, BC, DE, AF'`; 8-bit names where only one half changes; "all alternates"), other state after a
  semicolon; `Keeps:` lists main registers only. The card's `changes:`/`keeps:` lines are "may change":
  where the code restores a value by arithmetic the card cannot see, settle it from the code.
- **House style.** A summary line first; numbered steps for a long routine; comments start with a capital,
  under 70 characters, no full stop, values not mnemonics (`HL = the result`), tests as questions
  (`Both bytes 0?`), on the first line of a step. Labels: at most 16 characters, from what the code does.

## How to work

1. Work through the cards in order: they are bottom-up, so a routine's callees come before it.
2. For each card: read the facts and the listing; work out what the routine does; write its block:

   ```
   @0B40 SEG1_SERVICE
     EXOS 32 (read time): segment 1 service 0 ...
     Entry: A = the service number.
     Exit: A = 0; C, D, E = the time.
     Changes: AF, BC, DE.
     .0B41 A' = service number
   ```

   A card marked `carried: same` or `shifted` already has text from another version: check it against this
   code and change only what is wrong. One marked `different` needs its changed parts rewritten.
3. Declare a region for data the card shows as code (`bytes`, `words`, `text`, `fill`, `defc` with a hex
   range; `bytes` takes `rows=n`, `radix=binary`). `proposals.ann` lists the region proposals; the session
   accepts those before you start.
4. When only a run can settle something (what a routine returns for an input, whether a path runs), write a
   `question` line instead of a guess: `question 0C40 Does A come back 0 for a missing drive?`
5. When a card was missing a fact, got one wrong, made you open the listing, or when you worked out the same
   thing by hand more than once, write a `feedback` line (D11): `feedback missing 0B40 ...`,
   `feedback wrong 0C12 ...`, `feedback pattern 0D00-0D40 ...`, `feedback listing 0E10-0E60 ...`. Open the
   listing only through `npm run rom:pipeline -- listing <rom> <from>-<to> --why "..."`.
6. A number that must stay a number (a constant that looks like an address) is written `$0B40!`.
7. Compile your file on its own, fix its problem list until it is clean, and hand back the file:

   ```
   npm run rom:pipeline -- compile <rom> <your .ann> --dry-run
   ```

   `problems.md` lists each problem with its fix, and the questions to settle.

## What you hand back

The `.ann` file, a line on what you settled and what you left as `question` lines, and nothing else: no
summary of the cards.
