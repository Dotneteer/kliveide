/**
 * Who persists a breakpoint — and therefore who is allowed to replace it wholesale.
 *
 * The emulator's breakpoint set is a **union of sets owned by different persisters**, while every
 * persistence operation used to assume a single owner. That is what let opening a project destroy
 * breakpoints the project did not itself hold, and what would have let a project save silently adopt
 * breakpoints belonging to a `.nex` file.
 *
 * **Absent means the project** (`.kliveproject`), and that is the *only* representation of project
 * ownership — there is deliberately no `{ kind: "project" }` member here, so a breakpoint cannot be
 * project-owned in two distinguishable ways, and existing project files stay byte-identical on disk.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §4.3 and §9.4a of the companion ideas document.
 */
export type BreakpointOwner =
  | {
      /**
       * Owned by an annotation sidecar (`<file>.dis`) — a NEX's, a snapshot's, a project's — and
       * persisted in its `debug` subtree.
       */
      kind: "sidecar";
      /** Full path of the owning sidecar. Identity: two sidecars are different owners. */
      sidecar: string;
    }
  | {
      /**
       * The owner's name before the sidecars were for every machine
       * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.6). Read as `sidecar`: every reader goes
       * through `sidecarOfOwner`, and the emulator stores it as `sidecar`.
       */
      kind: "nex";
      sidecar: string;
    }
  | {
      /**
       * Owned by nobody: never persisted, and dropped when the machine changes. Used for
       * run-to-cursor, the NEX entry-point stop and the user's one-shot breakpoints.
       */
      kind: "session";
    }
  | {
      /**
       * Owned by the last successful build: a breakpoint read from a DeZog `LOGPOINT`, `ASSERTION` or
       * `WPMEM` source comment.
       * Never persisted, replaced as a set after every successful build, dropped when the machine
       * changes. See `.plans/LOGPOINTS_PLAN.md` L10.
       */
      kind: "annotation";
    }
  | {
      /**
       * Owned by a unit-test run (`.plans/Z80_UNIT_TESTS_PLAN.md` D9): the private stack's guards and
       * the success stop. Never persisted, never shown in the Breakpoints panel, removed when the
       * test ends.
       */
      kind: "unitTest";
    };

/**
 * Which subset of the breakpoint set an operation is allowed to replace.
 *
 * Scopes are never stored, so unlike `BreakpointOwner` this *does* name the project explicitly.
 */
export type BreakpointScope =
  | {
      /** Everything, session-owned breakpoints included. Machine teardown only. */
      kind: "all";
    }
  | {
      /** Breakpoints with no owner. */
      kind: "project";
    }
  | {
      /** Breakpoints owned by one annotation sidecar. */
      kind: "sidecar";
      sidecar: string;
    }
  | {
      /** The former name of `sidecar`, read as it. */
      kind: "nex";
      sidecar: string;
    }
  | {
      /** The breakpoints the last build read from source comments (`LOGPOINT`, `ASSERTION`, `WPMEM`). */
      kind: "annotation";
    }
  | {
      /** The breakpoints a unit-test run installed (`.plans/Z80_UNIT_TESTS_PLAN.md` D9). */
      kind: "unitTest";
    };

/**
 * Represents a breakpoint
 */
export type BreakpointInfo = {
  /**
   * Breakpoint address
   */
  address?: number;

  /**
   * The memory partition this breakpoint is scoped to, as an index into the machine's
   * `getPartitionLabels()` map. Negative indices are ROM and other special pages, zero and above
   * are RAM. When absent, the breakpoint fires whatever is paged in at its address.
   */
  partition?: number;

  /**
   * Who persists this breakpoint. **Absent means the project** — see `BreakpointOwner`.
   */
  owner?: BreakpointOwner;

  /**
   * The ZX Spectrum Next 16K bank this breakpoint is relative to, `0..111`.
   *
   * Deliberately separate from `partition`: a NEX bank is 16K by definition, while a partition index
   * is an **8K page**. The 8K page actually matched is derived as `bank * 2 + (bankOffset >> 13)`.
   * Conflating the two is the bug that made `bp-set 0A:$C000` and the Memory view's bank `0A` name
   * different memory; see `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
   */
  bank?: number;

  /**
   * Offset within that 16K bank, `$0000..$3FFF`.
   *
   * `bank` + `bankOffset` with `address` absent is what makes a breakpoint **bank-relative**: it
   * fires wherever that bank is paged in, rather than at one Z80 address. ZX Spectrum Next only.
   */
  bankOffset?: number;

  /**
   * A **one-shot**: removed automatically the first time it actually stops the machine, and never
   * persisted (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.1).
   *
   * Always paired with `owner: { kind: "session" }`. A *user* one-shot is a normal breakpoint of any
   * kind and binding - filters allowed - with this flag; it shares its storage key with the regular
   * breakpoint at the same place, because it is the same breakpoint with a flag (O4). "First hit"
   * means the first time its own filters pass (O3): `-once -hit 10` stops on the tenth hit and is
   * then gone, and a one-shot whose condition is false is not spent by another breakpoint stopping
   * the machine at the same address.
   */
  oneShot?: boolean;

  /**
   * An IDE-internal **run-to target** (run-to-cursor, the NEX entry-point stop, the Z88 snapshot
   * start): a one-shot under its own `RT:` key prefix, so it never replaces - and so never deletes -
   * a user breakpoint at the same place (O4). Always with `oneShot` and a session owner.
   */
  runTo?: boolean;

  /**
   * The number of bytes a **memory** breakpoint watches from its address, `1..65536`, never wrapping
   * past `$FFFF` (S10). Absent means one byte. Part of the identity: the key reads `$8000+5:W`.
   */
  length?: number;

  /**
   * Which DeZog source comment an annotation-owned breakpoint was read from (S1). Absent with an
   * annotation owner means a `LOGPOINT` (`logMessage` says so).
   */
  annotationKind?: AnnotationBreakpointKind;

  /**
   * The comment's own expression text (DeZog dialect), as written after the keyword: what the
   * Breakpoints panel shows for an `ASSERTION` or `WPMEM` breakpoint.
   */
  annotationText?: string;

  /**
   * For a comment inside a macro body: the line that invoked the macro (`SourceAnnotation.invokedAt`,
   * `.plans/Z80_UNIT_TESTS_PLAN.md` T2), as a project resource and line. A stop report names it,
   * since the comment's own line is the macro's. Not part of the identity.
   */
  annotationInvokedAt?: { resource: string; line: number };

  /**
   * The language `condition` is written in: `"klive"` (absent; what users type) or `"dezog"` (an
   * `ASSERTION` comment's negated expression, `.plans/LOGPOINTS_PLAN.md` §3.4). Not part of the
   * identity.
   */
  conditionDialect?: LogDialect;

  /**
   * The build symbol a watchpoint made from a Watch row is anchored to (W3). Re-resolved to
   * `address` after every build; while the symbol is missing the watchpoint is inactive.
   */
  watchSymbol?: string;

  /**
   * Indicates if a particular breakpoint is disabled
   */
  disabled?: boolean;

  /**
   * File that holds a source code breakpoint
   */
  resource?: string;

  /**
   * Line number within a file
   */
  line?: number;

  /**
   * A statement breakpoint (plan §10.3): a 0-based column on `line`, resolved to the statement whose
   * range holds it. Absent for a line breakpoint, which stops at the line's first statement.
   */
  column?: number;

  /**
   * Indicates that a source-bound breakpoint has been resolved
   */
  resolvedAddress?: number;

  /**
   * Indicates that a source-bound breakpoint is at this partition
   */
  resolvedPartition?: number;

  /**
   * The label this breakpoint is anchored to, for a **label-anchored** breakpoint.
   *
   * The third binding mode. An address breakpoint names a place in memory and a bank-relative one
   * names an offset in a bank; both stop meaning what the user meant the moment a rebuild moves the
   * code. A label-anchored breakpoint names the *thing* — "break at `DrawSprite`" — and is resolved
   * through a NEX sidecar's label table the way a source breakpoint is resolved through the
   * compiler's list file. It is the only shape that survives code moving within its bank.
   *
   * Paired with `labelFile`, which says whose label it is. `bank` narrows it to a bank's **local**
   * label; without a bank it names a **global** one, whose value is a 16-bit address.
   *
   * See `.plans/NEX_DEBUGGING_PLAN.md` §13.2.
   */
  label?: string;

  /**
   * The `.nex.dis` sidecar whose label table `label` is looked up in.
   *
   * Part of the breakpoint's **identity**, not of its ownership: `05:DrawSprite` means different
   * offsets in different sidecars, so unlike a bank-relative breakpoint (§4.4) two files cannot
   * collapse into one. Deliberately a separate field from `owner.sidecar` — the owner is restamped
   * by `withScopeOwner` when a breakpoint changes scope, and identity must not move with it.
   */
  labelFile?: string;

  /**
   * The bank a label-anchored breakpoint resolved to, filled in by resolution.
   *
   * The bank-relative counterpart of `resolvedAddress`, and read through the same "effective value"
   * idiom (`effectiveBankSite`). A local label's value is bank-relative, so it resolves to a place
   * in a bank rather than to a Z80 address.
   */
  resolvedBank?: number;

  /** The offset within `resolvedBank`, filled in by resolution. */
  resolvedBankOffset?: number;

  /**
   * The Next Register this breakpoint watches for writes, `$00..$FF`. ZX Spectrum Next only.
   *
   * The fifth binding shape, and the first that is not a **place**. An address breakpoint, a
   * bank-relative one and a label-anchored one all name somewhere in memory; this one names a
   * machine *event* — "whenever register $07 is written" — so it has no address, no partition and
   * nothing for the disassembler to annotate. `buildBreakpointKey` branches on it before the
   * address branch, for the same reason the label branch comes first: the register is the identity.
   *
   * **There is deliberately no `nextRegWrite` kind flag beside it.** Writes are the only thing
   * watched — a NextReg *read* breakpoint is ruled out, because a read of `$253B` is common and
   * undiagnostic — so a flag would be true for exactly the breakpoints carrying a `nextReg` and
   * false for the rest. That is not a discriminator, it is a second copy of one, and the two can
   * fall out of step. Use `isNextRegBreakpoint` in `@common/utils/breakpoint-scope`.
   *
   * See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.1.
   */
  nextReg?: number;

  /**
   * Break only when the written value, masked by `nextRegMask`, equals this. Absent means any write.
   *
   * **Part of the breakpoint's identity**, so `NR:$07=$00` and `NR:$07=$03` can both exist — which
   * is the case that motivates having a filter at all. Deliberately unlike `ioMask`, which is *not*
   * in the key and therefore makes two I/O breakpoints on one port with different masks
   * unrepresentable. `ioMask` is the older precedent and the worse one; do not copy it here, and do
   * not "fix" it there as part of this feature.
   */
  nextRegValue?: number;

  /** The mask applied to both the written value and `nextRegValue` before comparing. Default $FF. */
  nextRegMask?: number;

  /**
   * Also break when the **Copper** writes this register, not only when the CPU does.
   *
   * Off by default: the CPU write paths — port `$253B` and the `NEXTREG` opcodes — are what a
   * programmer debugging their own code means. Reset branches and the IDE's own hotkeys are never
   * reported whatever this says.
   *
   * Deliberately **not** part of the identity. A CPU-only and a CPU-plus-Copper breakpoint on one
   * register are not two useful breakpoints — the second subsumes the first — so this behaves like
   * `disabled`: a property `bp-set` updates in place rather than a second breakpoint.
   */
  nextRegCopper?: boolean;

  /**
   * The ZX Spectrum Next **Copper list index** (`$000`-`$3FF`) this breakpoint watches: the machine
   * stops when the Copper completes that instruction - a MOVE or NOP when it is issued, a WAIT when
   * its condition is satisfied (`.plans/COPPER_DEBUGGING_PLAN.md` D3, D4).
   *
   * Like `nextReg`, the index is the binding and the discriminator; there is no kind flag. Use
   * `isCopperBreakpoint` in `@common/utils/breakpoint-scope`. It has no Z80 address, no partition
   * and no gutter in the Z80 disassembly.
   */
  copperIndex?: number;

  /**
   * The ZX Spectrum Next **sprite** (`$00`-`$7F`) whose attribute writes this breakpoint watches:
   * the machine stops after the instruction during which a watched attribute byte of that sprite is
   * written - through port `$57` (by the CPU or the DMA) or the `$35`-`$39`/`$75`-`$79` NextReg
   * mirrors (by the CPU or the Copper) (`.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`).
   *
   * Like `copperIndex`, the sprite is the binding and the discriminator. Use `isSpriteBreakpoint`
   * in `@common/utils/breakpoint-scope`. It has no Z80 address, no partition and no gutter.
   */
  spriteIndex?: number;

  /**
   * Which of the sprite's five attribute bytes a sprite breakpoint watches: bit `n` for attribute
   * byte `n` (0-4). Absent (or `$1F`) watches all five.
   *
   * Not part of the identity, like `nextRegCopper`: two breakpoints on one sprite that differ only
   * in the bytes they watch are one breakpoint, which `bp-set` updates in place.
   */
  spriteAttrMask?: number;

  /**
   * Indicates an execution breakpoint
   */
  exec?: boolean;

  /**
   * Indicates a memory read breakpoint
   */
  memoryRead?: boolean;

  /**
   * Indicates a memory write breakpoint
   */
  memoryWrite?: boolean;

  /**
   * Indicates an I/O read breakpoint
   */
  ioRead?: boolean;

  /**
   * Indicates an I/O write breakpoint
   */
  ioWrite?: boolean;

  /**
   * The optional mask for I/O breakpoints
   */
  ioMask?: number;

  /**
   * The breakpoint's condition, **as typed** — an expression over registers, flags, memory, the
   * accessed value and program labels. The machine stops only when it is true.
   *
   * Stored as text, never as a parsed tree: the text is the stable persisted form, and each side
   * (the IDE to validate, the emulator to arm) parses it when the breakpoint is created or modified.
   * Like `disabled`, **not part of the breakpoint's identity**. Absent or empty means "always".
   *
   * See `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3 for the language, C1 and C13 for the rules.
   */
  condition?: string;

  /**
   * How `hitCount` is compared with the number of (condition-true) hits. Absent with a `hitCount`
   * reads as `"eq"` — the only meaning a hand-written file from before this field could have had.
   * Not part of the identity. See `BreakpointHitMode` and the plan's §4.2.
   */
  hitMode?: BreakpointHitMode;

  /**
   * The N of the hit-count rule (`hitMode`), `1..65535`. Absent means every hit stops.
   *
   * The field predates the rule — it was an unread stub — and keeps its name so persisted
   * breakpoints do not churn. Not part of the identity.
   */
  hitCount?: number;

  /**
   * **Runtime only** — never persisted: every persister removes it through
   * `withoutBreakpointRuntimeState`. Times this breakpoint was hit with its condition true since the
   * machine last restarted or its counter was reset. Reported by `listBreakpoints`.
   */
  currentHits?: number;

  /**
   * **Runtime only.** The emulator could not parse `condition` when it armed the breakpoint (a
   * hand-edited file, or a grammar change). Such a breakpoint stops every time — the fail-safe —
   * and this carries the message the Breakpoints panel shows.
   */
  conditionError?: string;

  /**
   * **Runtime only.** Why the condition is inactive — a label it names is missing from the current
   * symbol table. An inactive breakpoint never stops and never counts until a build defines the
   * label.
   */
  conditionInactive?: string;

  /**
   * The message template of a **logpoint**: a breakpoint whose action is "log this message and
   * continue" instead of "stop" (`.plans/LOGPOINTS_PLAN.md` L1). Its presence is what makes the
   * breakpoint a logpoint; it binds, filters (condition, hit rule) and persists like any other.
   *
   * Stored as typed, in the dialect `logDialect` names. Like `condition`, **not part of the
   * identity**: `bp-set` on an existing breakpoint turns it into a logpoint or back (L2).
   */
  logMessage?: string;

  /**
   * Which template language `logMessage` is written in: `"klive"` (`{expr[:fmt]}`, the condition
   * language; what the user types) or `"dezog"` (`${expr[:fmt]}`, DeZog's expressions; what a
   * `LOGPOINT` source comment holds). Absent means `"klive"`.
   */
  logDialect?: LogDialect;

  /**
   * **Runtime only.** The emulator could not compile `logMessage`. Such a logpoint logs this text on
   * every hit instead of its message (the logging analogue of `conditionError`).
   */
  logError?: string;
};

/** The DeZog source comments that become breakpoints besides `LOGPOINT` (G1.5). */
export type AnnotationBreakpointKind = "ASSERTION" | "WPMEM";

/**
 * Which DeZog comment kinds a build turns into breakpoints (S6). Persisted in the project file when
 * not "all on"; an absent member means on.
 */
export type SourceCommentSwitches = {
  assertion?: boolean;
  wpmem?: boolean;
};

/** The two logpoint template languages (`.plans/LOGPOINTS_PLAN.md` L6). */
export type LogDialect = "klive" | "dezog";

/**
 * Which logpoint groups log (`.plans/LOGPOINTS_PLAN.md` §4.2, the DeZog model): everything, nothing,
 * or - with `groups` - only the listed ones. Persisted in the project file when not "all on".
 */
export type LogpointGroupState = {
  enabled: boolean;
  /** With `enabled`, only these groups log; absent means every group. Upper-case names. */
  groups?: string[];
};

/**
 * The hit-count rules, each comparing the hit number with `hitCount` (N):
 * - `eq`: the Nth hit only; `gt`: after it; `ge`: from it on
 * - `lt`: before it; `le`: up to and including it
 * - `every`: every Nth hit (N, 2N, 3N, ...)
 */
export type BreakpointHitMode = "eq" | "gt" | "ge" | "lt" | "le" | "every";
