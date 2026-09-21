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
      /** Owned by a ZX Spectrum Next `.nex` file, persisted in its `.nex.dis` sidecar. */
      kind: "nex";
      /** Full path of the owning sidecar. Identity: two NEX files are different owners. */
      sidecar: string;
    }
  | {
      /**
       * Owned by nobody: never persisted, and dropped when the machine changes. Used for
       * run-to-cursor and the NEX entry-point stop.
       */
      kind: "session";
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
      /** Breakpoints owned by one `.nex.dis` sidecar. */
      kind: "nex";
      sidecar: string;
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
   * Removed automatically the first time it fires, and never persisted.
   *
   * Used for run-to-cursor and the NEX entry-point stop. Always paired with
   * `owner: { kind: "session" }`.
   */
  oneShot?: boolean;

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
   * Memory breakpoint target hit counter
   */
  hitCount?: number;
};
