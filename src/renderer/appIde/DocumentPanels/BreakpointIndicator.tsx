import { useEffect, useState } from "react";
import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { toHexa4 } from "../services/ide-commands";
import styles from "./BreakpointIndicator.module.scss";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { Checkbox } from "@renderer/controls/Checkbox";
import {
  breakpointGlyphIcon,
  type BreakpointGlyph
} from "@renderer/appIde/utils/breakpoint-filter-text";

/**
 * The modifier that means "run here", named the way the platform names it.
 *
 * `navigator.platform` is deprecated but is what the rest of the renderer uses, and this only
 * decides a word in a tooltip: both modifiers are accepted regardless of what it reports.
 */
const runToModifierLabel =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform ?? "") ? "Cmd" : "Ctrl";

type Props = {
  address: number | string;
  partition?: string;
  hasBreakpoint: boolean;
  disabled: boolean;
  current: boolean;
  /**
   * The Next Register a NextReg write breakpoint watches, when this row is one.
   *
   * The binding, not a kind flag, matching `BreakpointInfo.nextReg` - `!== undefined` is the kind
   * test. It is here because this shape has no address, and two of the gestures below build
   * address-taking commands.
   */
  nextReg?: number;
  /** This row is a Copper breakpoint (`cu:`); `address` then carries its `CU:$xxx` spec. */
  copper?: boolean;
  memoryRead?: boolean;
  memoryWrite?: boolean;
  ioRead?: boolean;
  ioWrite?: boolean;
  ioMask?: number;
  showType?: boolean;
  resolvedAddress?: number;
  /**
   * Whether this breakpoint can fire where it stands.
   *
   * Told, not inferred. The dot's colour used to be chosen by the *type* of the `address` prop - a
   * number meant "armed", anything else fell through to the unresolved-source colour - which was
   * only ever right by coincidence. A bank-relative breakpoint passes the string `05:+$0100` and a
   * NextReg one passes `NR:$07`; both are fully armed, and both were painted as source breakpoints
   * waiting for a compilation that is never coming.
   *
   * Left unset, the old inference still applies, so callers that have not been taught this keep
   * their present behaviour.
   */
  armed?: boolean;
  /**
   * Suppress this component's own tooltips.
   *
   * For a caller whose *row* already carries one: two tooltips on nested elements both fire on
   * hover and render on top of each other. `BreakpointsPanel` sets this and folds the action hints
   * below into its row tooltip; the disassembly view, which has no row tooltip, leaves it off.
   */
  noTooltip?: boolean;
  /**
   * Open an editor for this breakpoint.
   *
   * Supplied by the disassembly view, where the row has no menu of its own; the Breakpoints panel
   * leaves it unset because its own row already handles the same gesture.
   */
  onEdit?: () => void;
  /**
   * The breakpoint has a condition or a hit-count rule: the dot carries an "=" mark
   * (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2).
   */
  conditional?: boolean;
  /**
   * The breakpoint is set but cannot stop the machine now: its condition names a label the last
   * build did not define, or the emulator could not arm it. The dot is drawn hollow.
   */
  inactive?: boolean;
  /** Tooltip lines describing the condition, hit rule, hit count and inactive reason. */
  filterLines?: string[];
  /**
   * The breakpoint's glyph (`breakpointGlyphOf`): a logpoint draws a diamond. When given it wins
   * over `conditional` / `inactive`, which callers that do not know logpoints still pass.
   */
  glyph?: BreakpointGlyph;
  /** A memory range's byte count (S10): part of the identity, so every command names it. */
  length?: number;
  /** The breakpoint here is a one-shot: Shift+click removes it (O1). */
  oneShot?: boolean;
  /**
   * The command that turns the regular breakpoint here into a one-shot with its filters kept
   * (`bp-set <spec> -once ...`). Supplied by a caller that knows the whole breakpoint; without it,
   * Shift+click on a regular breakpoint does nothing.
   */
  oneShotCommand?: string;
};

/** A logpoint's glyph: never a one-shot. */
function isLogpointGlyph(glyph: BreakpointGlyph | undefined): boolean {
  return !!glyph && glyph.startsWith("logpoint");
}

export const BreakpointIndicator = ({
  address,
  partition,
  hasBreakpoint,
  disabled,
  current,
  nextReg,
  copper,
  memoryRead,
  memoryWrite,
  ioRead,
  ioWrite,
  ioMask,
  showType,
  armed,
  resolvedAddress,
  noTooltip,
  onEdit,
  conditional,
  inactive,
  filterLines,
  glyph,
  oneShot,
  oneShotCommand,
  length
}: Props) => {
  const lengthOption = (memoryRead || memoryWrite) && length && length > 1 ? ` -len ${length}` : "";
  // --- A `LOGPOINT` comment belongs to the build: no gesture here may remove or toggle it
  // --- (and an `ASSERTION`/`WPMEM` comment's: the comment owns it, S3)
  const readOnly = glyph === "logpointComment" || glyph === "assertion" || glyph === "watchpoint";
  const { ideCommandsService } = useAppServices();
  const cbkRef = useTooltipRef();
  const ref = useTooltipRef();
  const [pointed, setPointed] = useState(false);
  const [isDisabled, setIsDisabled] = useState(disabled);

  // --- Calculate tooltip text
  let addrLabel =
    typeof address === "number"
      ? partition !== undefined
        ? `${partition}:$${toHexa4(address)}`
        : `$${toHexa4(address)}`
      : address;

  let bpType = "execute";
  // --- `bp-exec`, not the shared `symbol-event`: that one is a lightning bolt from another icon
  // --- family, it belongs to no set, and `registry.ts` still uses it elsewhere — so the breakpoint
  // --- type icons get their own glyph rather than overriding a shared name.
  let typeIcon = "bp-exec";
  if (memoryRead) {
    bpType = "memory read";
    typeIcon = "bp-mem-read";
  } else if (memoryWrite) {
    bpType = "memory write";
    typeIcon = "bp-mem-write";
  } else if (ioRead) {
    bpType = "I/O read";
    typeIcon = "bp-io-read";
  } else if (ioWrite) {
    bpType = "I/O write";
    typeIcon = "bp-io-write";
  } else if (nextReg !== undefined) {
    // --- The sliders glyph carries the family's standard downward write arrow, so "write" reads
    // --- without learning a new sign; only the target below it is new.
    bpType = "NextReg write";
    typeIcon = "bp-nextreg";
  } else if (copper) {
    bpType = "Copper instruction";
    typeIcon = "bp-copper";
  }
  // --- One colour for all five: the glyphs now carry the read/write distinction the three ANSI
  // --- hues used to. See `--color-breakpoint-type` in componentAliases.ts.
  const typeColor = "--color-breakpoint-type";

  const tooltipCommon = `${addrLabel}${(ioRead || ioWrite) && ioMask ? " /$" + toHexa4(ioMask) : ""} (${bpType})`;
  /*
   * A NextReg breakpoint names an event, not a place, so there is nowhere to "run to": `run-to
   * NR:$07` is not a spec any command accepts. The gesture is withdrawn rather than left to fail,
   * and the tooltip stops advertising it.
   */
  const canRunTo = nextReg === undefined;
  const filterText = filterLines?.length ? `${filterLines.join("\n")}\n` : "";
  const tooltip =
    `${tooltipCommon}\n` +
    filterText +
    (readOnly
      ? "Edit the comment and rebuild to change it"
      : hasBreakpoint
        ? `Right-click to remove this breakpoint`
        : "Right-click to set a breakpoint") +
    (hasBreakpoint && onEdit ? "\nDouble-click to edit this breakpoint" : "") +
    // --- The gesture is only discoverable from here, which is why it is listed rather than left to
    // --- be found. See `runToHere`.
    (canRunTo ? `\n${runToModifierLabel}-click to run here` : "") +
    // --- One-shots (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` O1)
    (readOnly || isLogpointGlyph(glyph)
      ? ""
      : oneShot
        ? "\nShift-click to remove the one-shot"
        : hasBreakpoint
          ? oneShotCommand
            ? "\nShift-click to make it stop here once"
            : ""
          : "\nShift-click to stop here once");
  const tooltipCheckbox =
    `${tooltipCommon}\n` +
    (disabled ? `Check to enable this breakpoint` : "Uncheck to disable this breakpoint");

  // --- Select the icon to show
  let iconName = "";
  let fill = "";
  if (current) {
    iconName = hasBreakpoint ? "debug-with-bp" : "debug-current";
    fill = "--color-breakpoint-current";
  } else if (hasBreakpoint) {
    // --- Same colours as any breakpoint; the shape says conditional or inactive
    iconName = glyph
      ? breakpointGlyphIcon(glyph)
      : inactive
        ? "bp-inactive"
        : conditional
          ? "bp-conditional"
          : "circle-filled";
    // --- `armed` first, then the old inference for callers that do not pass it. A breakpoint that
    // --- can fire is never painted the colour that means "this cannot fire yet".
    fill = disabled
      ? "--color-breakpoint-disabled"
      : armed || typeof address === "number"
        ? "--color-breakpoint-binary"
        : resolvedAddress
          ? "--color-breakpoint-code"
          : "--color-debug-unreachable-bp";
  } else if (pointed) {
    iconName = "circle-large-outline";
    fill = "--color-breakpoint-disabled";
  }

  useEffect(() => {
    setIsDisabled(disabled);
  }, [disabled]);

  // --- Handle adding/removing a breakpoint
  const handleRemove = async () => {
    if (readOnly) return;
    let command =
      `${hasBreakpoint ? "bp-del" : "bp-set"} ${addrLabel} ` +
      `${memoryRead ? "-r" : ""} ${memoryWrite ? "-w" : ""}` +
      `${ioRead ? "-i" : ""} ${ioWrite ? "-o" : ""}${lengthOption}`;
    if (ioRead || ioWrite) {
      command += ` -m $${toHexa4(ioMask)}`;
    }
    await ideCommandsService.executeCommand(command);
  };

  /**
   * Shift+click (O1): a one-shot where there is none, a regular breakpoint made one, a one-shot
   * removed. A logpoint never stops, so it is never made a one-shot.
   */
  const toggleOneShot = async () => {
    if (readOnly || isLogpointGlyph(glyph)) return;
    if (!hasBreakpoint) {
      await ideCommandsService.executeCommand(
        `bp-set ${addrLabel} ${memoryRead ? "-r" : ""} ${memoryWrite ? "-w" : ""}` +
          `${ioRead ? "-i" : ""} ${ioWrite ? "-o" : ""} -once`
      );
    } else if (oneShot) {
      await handleRemove();
    } else if (oneShotCommand) {
      await ideCommandsService.executeCommand(oneShotCommand);
    }
  };

  /**
   * Run the machine until it reaches this row, then stop — without leaving a breakpoint behind.
   *
   * Reuses `addrLabel`, the same display key the breakpoint gestures above build their commands
   * from, so this works for every shape the gutter can show: a plain address, a
   * `<partition>:<address>` pair, a source line, and a NEX bank's `<bank>:+<offset>`. The last is
   * the one that makes this useful in a popped-out NEX bank, where the bank is not paged in yet.
   *
   * A modifier-click rather than a menu item because the indicator is where the other
   * address-specific gestures already live, and one handler here gives the gesture to both the live
   * disassembly view and every NEX bank dump. A proper row context menu is the better home
   * eventually; see `.plans/NEX_DEBUGGING_PLAN.md` §10.4.
   */
  const runToHere = async () => {
    if (!canRunTo) return;
    await ideCommandsService.executeCommand(`run-to ${addrLabel}`);
  };

  // --- Handle enabling/disabling a breakpoint
  const enableOrDisable = async () => {
    if (readOnly) return;
    let command =
      `bp-en ${addrLabel} ${disabled ? "" : "-d"} ` +
      `${memoryRead ? "-r" : ""} ${memoryWrite ? "-w" : ""}` +
      `${ioRead ? "-i" : ""} ${ioWrite ? "-o" : ""}${lengthOption}`;
    if (ioRead || ioWrite) {
      command += ` -m $${toHexa4(ioMask)}`;
    }
    if (hasBreakpoint) {
      await ideCommandsService.executeCommand(command);
    }
  };

  return (
    <div
      className={styles.breakpointWrapper}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      /*
       * The indicator owns right-click within its own bounds.
       *
       * `BreakpointsPanel` puts a context menu on the whole row, and this indicator sits inside
       * every one of those rows while binding right-click to *delete the breakpoint outright*.
       * Without this the two would fight: the row menu would open on top of a silent delete, or
       * shadow it, depending on where in the indicator the click landed. Stopping propagation on
       * the wrapper — rather than on the icon alone — keeps the checkbox and the glyph behaving as
       * one unit, instead of a menu appearing a few pixels away from a gesture that deletes.
       */
      onContextMenu={(e) => e.stopPropagation()}
    >
      {showType && (
        <div ref={cbkRef} style={{ zoom: 0.8 }}>
          <Checkbox key={address} initialValue={!isDisabled} enabled={!readOnly} right={true} onChange={enableOrDisable} />
          {!noTooltip && (
            <TooltipFactory
              refElement={cbkRef.current}
              placement="right"
              offsetX={0}
              offsetY={40}
              showDelay={100}
              content={tooltipCheckbox}
            />
          )}
        </div>
      )}
      <div
        ref={ref}
        style={{ display: "flex", flexDirection: "row", justifyContent: "center" }}
        onContextMenu={(e) => {
          // --- Suppress the platform menu; the wrapper above has already stopped this reaching a
          // --- row-level menu.
          e.preventDefault();
          void handleRemove();
        }}
        onClick={(e) => {
          // --- Plain click on the gutter has never done anything, so this adds a gesture rather
          // --- than overloading one. Without a modifier it still does nothing.
          if (e.shiftKey) {
            e.stopPropagation();
            e.preventDefault();
            void toggleOneShot();
            return;
          }
          if (!e.metaKey && !e.ctrlKey) return;
          e.stopPropagation();
          e.preventDefault();
          void runToHere();
        }}
        onDoubleClick={
          hasBreakpoint && onEdit
            ? (e) => {
                // --- Where a row also listens for a double-click, only one editor should open.
                e.stopPropagation();
                onEdit();
              }
            : undefined
        }
      >
        {iconName ? (
          <div className={styles.breakpointIndicator}>
            <Icon width={16} height={16} iconName={iconName} fill={fill} />
          </div>
        ) : (
          <div className={styles.iconPlaceholder} />
        )}
        {!noTooltip && (
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={0}
            offsetY={40}
            showDelay={100}
            content={tooltip}
          />
        )}
        {showType && <Icon iconName={typeIcon} fill={typeColor} width={16} height={16} />}
      </div>
    </div>
  );
};
