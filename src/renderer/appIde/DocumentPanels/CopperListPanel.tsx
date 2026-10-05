import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import classnames from "classnames";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { CopperState } from "@common/messaging/EmuApi";
import type { DebuggableOutput } from "@abstractions/CompilerInfo";
import {
  copperMoveSwatch,
  copperMnemonic,
  describeCopperInstruction,
  formatCopperIndex,
  formatCopperOperands,
  formatCopperWord
} from "@common/zxnext/copper/copperDecoder";
import { matchCopperSource, type CopperSourceMatch } from "@common/zxnext/copper/copperSourceMatch";
import { isCopperBreakpoint } from "@common/utils/breakpoint-scope";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@controls/ContextMenu";
import { EmptyState, PanelHeader } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { Icon } from "@renderer/controls/Icon";
import { VirtualizedList, type VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  buildCopperModel,
  copperListRows,
  copperNopsText,
  copperRowOf,
  copperRuler,
  copperSummaryText,
  copperWarnings,
  rulerTickAt,
  rulerY,
  type CopperListRow,
  type CopperRuler
} from "@renderer/features/copper/copperViewModel";
import { onCopperReveal } from "@renderer/features/copper/copperReveal";
import { useBreakpointDialog } from "../dialogs/useBreakpointDialog";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./CopperListPanel.module.scss";

/**
 * The Copper List document (`$copper`, `.plans/COPPER_DEBUGGING_PLAN.md` §4.5, G3.1): all 1024
 * slots decoded, with the raster ruler beside them. The gutter toggles `cu:` breakpoints; the row
 * menu runs to an instruction or goes to its `.copper` source (D11). The Copper's PC and the last
 * hit are two separate markers (trap T1).
 */

/** The ruler's drawing height, in user units: the SVG is stretched to the pane. */
const RULER_HEIGHT = 1000;

type CopperBreakpointState = { disabled: boolean; bp: BreakpointInfo };

const CopperListPanel = (_props: DocumentProps) => {
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const openBreakpointDialog = useBreakpointDialog();
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const compilation = useSelector((s) => s.compilation?.result) as DebuggableOutput | undefined;

  const [state, setState] = useState<CopperState>();
  const [followPc, setFollowPc] = useState(true);
  const [showSource, setShowSource] = useState(true);
  const [hex, setHex] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [breakpoints, setBreakpoints] = useState<Map<number, CopperBreakpointState>>(new Map());
  const [menuState, menuApi] = useContextMenuState();
  const [menuIndex, setMenuIndex] = useState<number>();
  const [rulerHover, setRulerHover] = useState<string>();
  const listApi = useRef<VirtualizedListApi>(null);

  // --- Refresh: the Copper's state, and the `cu:` breakpoints
  const refresh = useCallback(async () => {
    setState(await emuApi.getCopperState());
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  const refreshBreakpoints = useCallback(async () => {
    const { breakpoints: all } = await emuApi.listBreakpoints();
    const map = new Map<number, CopperBreakpointState>();
    for (const bp of all) {
      // --- A run-to target is not a breakpoint the gutter shows
      if (isCopperBreakpoint(bp) && !bp.runTo) {
        map.set(bp.copperIndex! & 0x3ff, { disabled: !!bp.disabled, bp });
      }
    }
    setBreakpoints(map);
  }, [emuApi]);
  useEffect(() => {
    refreshBreakpoints().catch(() => {});
  }, [bpsVersion, refreshBreakpoints]);

  // --- Derived views
  const model = useMemo(() => (state ? buildCopperModel(state) : undefined), [state]);
  const hit = state?.lastHit;
  const rows = useMemo(
    () =>
      model
        ? copperListRows(model, expanded, [
            // --- A stopped Copper's PC is not a place worth expanding the NOP run for
            state.startMode ? state.pc : undefined,
            hit?.index,
            selected
          ])
        : [],
    [model, expanded, state, hit, selected]
  );
  const ruler = useMemo(() => (model ? copperRuler(model, hit) : undefined), [model, hit]);
  const ram = state?.ram;
  const pc = state?.pc;
  const sourceMap = useMemo(
    () =>
      ram && compilation?.copperBlocks?.length
        ? matchCopperSource(ram, compilation.copperBlocks)
        : undefined,
    [ram, compilation]
  );

  // --- Follow the PC, and reveal what `show-copper <index>` asks for
  const scrollTo = useCallback(
    (index: number) => {
      const row = copperRowOf(rows, index);
      if (row >= 0) listApi.current?.scrollToIndex(row, { align: "center" });
    },
    [rows]
  );
  useEffect(() => {
    if (followPc && pc !== undefined) scrollTo(pc);
  }, [followPc, pc, scrollTo]);
  useEffect(
    () =>
      onCopperReveal((index) => {
        setFollowPc(false);
        setSelected(index);
        setTimeout(() => scrollTo(index), 0);
      }),
    [scrollTo]
  );

  // --- Breakpoint and navigation actions, all through the command layer
  const toggleBreakpoint = async (index: number) => {
    const spec = `cu:${formatCopperIndex(index)}`;
    await ideCommandsService.executeCommand(
      breakpoints.has(index) ? `bp-del ${spec}` : `bp-set ${spec}`
    );
    await refreshBreakpoints();
  };
  const editBreakpoint = async (index: number) => {
    const existing = breakpoints.get(index)?.bp;
    if (existing && (await openBreakpointDialog(existing))) await refreshBreakpoints();
  };
  const runToHere = (index: number) =>
    ideCommandsService.executeCommand(`run-to cu:${formatCopperIndex(index)}`);
  const goToSource = (match: CopperSourceMatch) => {
    const filename = compilation?.sourceFileList?.[match.fileIndex]?.filename;
    if (filename)
      void ideCommandsService.executeCommand(`nav "${filename}" ${match.line} -r breakpoint`);
  };
  const sourceName = (match: CopperSourceMatch) => {
    const filename = compilation?.sourceFileList?.[match.fileIndex]?.filename ?? "?";
    return `${filename.split(/[\\/]/).pop()}:${match.line}`;
  };

  const showMenu = (index: number, e: ReactMouseEvent) => {
    e.preventDefault();
    setMenuIndex(index);
    setSelected(index);
    menuApi.show(e);
  };
  const fromMenu = (action: () => unknown) => () => {
    menuApi.conceal();
    void action();
  };

  if (!model) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState message="The Copper is available on the ZX Spectrum Next" />
      </FullPanel>
    );
  }

  const warnings = copperWarnings(model.summary);
  const menuMatch = menuIndex !== undefined ? sourceMap?.byIndex[menuIndex] : undefined;

  const renderRow = (row: CopperListRow) => {
    if (row.kind === "nops") {
      return (
        <div className={classnames(styles.row, styles.nopsRow)} onClick={() => setExpanded(true)}>
          <span className={styles.gutter} />
          <span className={styles.nops}>{copperNopsText(row.from, row.count)}</span>
          <span className={styles.expandHint}>click to expand</span>
        </div>
      );
    }
    const instr = row.instr;
    const index = instr.index;
    const bp = breakpoints.get(index);
    const isPc = index === state.pc && state.startMode !== 0;
    const isHit = hit?.index === index;
    const match = showSource ? sourceMap?.byIndex[index] : undefined;
    const swatch = instr.kind === "move" ? copperMoveSwatch(instr.reg, instr.value) : undefined;
    const park = model.summary.parks.includes(index);
    const outOfOrder = model.summary.orderWarnings.includes(index);
    return (
      <div
        className={classnames(styles.row, {
          [styles.pcRow]: isPc,
          [styles.hitRow]: isHit,
          [styles.selectedRow]: selected === index,
          [styles.unused]: index >= model.summary.usedLength
        })}
        onClick={() => setSelected(index)}
        onContextMenu={(e) => showMenu(index, e)}
        onDoubleClick={() => match && goToSource(match)}
      >
        <span
          className={styles.gutter}
          title={
            bp
              ? `Remove the breakpoint on ${formatCopperIndex(index)}`
              : `Stop when the Copper completes ${formatCopperIndex(index)}`
          }
          onClick={(e) => {
            e.stopPropagation();
            void toggleBreakpoint(index);
          }}
        >
          {bp && (
            <Icon
              iconName="circle-filled"
              width={12}
              height={12}
              fill={bp.disabled ? "--color-breakpoint-disabled" : "--color-breakpoint-binary"}
            />
          )}
        </span>
        <span className={styles.marker}>{isPc ? "▶" : isHit ? "●" : ""}</span>
        <span className={styles.index}>{formatCopperIndex(index)}</span>
        <span className={styles.word}>{formatCopperWord(instr.word)}</span>
        <span className={styles.mnemonic}>{copperMnemonic(instr)}</span>
        <span className={styles.operands}>
          {formatCopperOperands(instr, { hex: instr.kind === "wait" ? hex : undefined })}
        </span>
        <span
          className={classnames(styles.meaning, {
            [styles.warning]: park || outOfOrder
          })}
          title={
            park
              ? "This WAIT never matches under the current timing"
              : outOfOrder
                ? "This WAIT is for an earlier line than the WAIT before it: in a looping mode it waits for the next frame"
                : undefined
          }
        >
          {swatch && <span className={styles.swatch} style={{ backgroundColor: swatch }} />}
          {describeCopperInstruction(instr, model.timing)}
          {isHit && hit && (
            <span className={styles.hitNote}>
              {" "}
              · hit at line {hit.line}, hc {hit.hc}
            </span>
          )}
        </span>
        {showSource && (
          <span
            className={classnames(styles.source, { [styles.patched]: match?.patched })}
            title={
              match
                ? `${sourceName(match)}${match.patched ? ` · patched: assembled as ${formatCopperWord(match.sourceWord)}` : ""}\nmatched ${sourceMap!.matchedPerBlock[match.block]} of ${compilation!.copperBlocks![match.block].length} in this block`
                : undefined
            }
          >
            {match ? `${sourceName(match)}${match.patched ? " *" : ""}` : ""}
          </span>
        )}
      </div>
    );
  };

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <LabeledSwitch
          value={followPc}
          label="Follow PC:"
          title="Keep the Copper's PC in view"
          clicked={setFollowPc}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={showSource}
          label="Source:"
          title="Show the .copper source line each instruction was assembled from"
          clicked={setShowSource}
        />
        <ToolbarSeparator small={true} />
        <LabeledSwitch
          value={hex}
          label="Hex WAIT:"
          title="Show WAIT operands in hexadecimal"
          clicked={setHex}
        />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName="step-into"
          title="Step Copper: run until the Copper completes its next instruction"
          clicked={async () => {
            setFollowPc(true);
            await emuApi.stepCopper();
          }}
        />
        <ToolbarSeparator small={true} />
        <span
          className={classnames(styles.summary, { [styles.warning]: warnings.length > 0 })}
          title={warnings.join("\n") || undefined}
        >
          {copperSummaryText(model.summary)}
        </span>
      </PanelHeader>
      <div className={styles.body}>
        <div className={styles.table}>
          <VirtualizedList
            items={rows}
            apiLoaded={(api) => (listApi.current = api)}
            renderItem={(idx) => <div key={idx}>{rows[idx] && renderRow(rows[idx])}</div>}
          />
        </div>
        {ruler && (
          <RasterRuler
            ruler={ruler}
            hover={rulerHover}
            onHover={(tick) =>
              setRulerHover(
                tick
                  ? `${formatCopperIndex(tick.index)} WAIT line ${tick.line}${tick.matches ? "" : " (never matches)"}`
                  : undefined
              )
            }
            onSelect={(index) => {
              setFollowPc(false);
              setSelected(index);
              scrollTo(index);
            }}
          />
        )}
      </div>
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem
          text={
            menuIndex !== undefined && breakpoints.has(menuIndex)
              ? "Remove breakpoint"
              : "Add breakpoint"
          }
          clicked={fromMenu(() => toggleBreakpoint(menuIndex!))}
        />
        {menuIndex !== undefined && breakpoints.has(menuIndex) && (
          <ContextMenuItem
            text="Edit breakpoint..."
            iconName="pencil"
            clicked={fromMenu(() => editBreakpoint(menuIndex!))}
          />
        )}
        <ContextMenuItem text="Run to here" clicked={fromMenu(() => runToHere(menuIndex!))} />
        {menuMatch && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              text={`Go to source (${sourceName(menuMatch)})`}
              clicked={fromMenu(() => goToSource(menuMatch))}
            />
          </>
        )}
      </ContextMenu>
    </FullPanel>
  );
};

/**
 * The raster ruler: one frame of `cvc` lines top to bottom, with the paper and border zones shaded,
 * a tick per WAIT, the live beam and the hit. It answers "where in the frame does this list act".
 */
const RasterRuler = ({
  ruler,
  hover,
  onHover,
  onSelect
}: {
  ruler: CopperRuler;
  hover?: string;
  onHover: (tick: CopperRuler["ticks"][number] | undefined) => void;
  onSelect: (index: number) => void;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const tickAt = (e: ReactMouseEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.height === 0) return undefined;
    const y = ((e.clientY - box.top) / box.height) * RULER_HEIGHT;
    return rulerTickAt(ruler, y, RULER_HEIGHT, (6 * RULER_HEIGHT) / box.height);
  };
  const y = (line: number) => rulerY(line, ruler.lines, RULER_HEIGHT);
  // --- Zone edges are line *boundaries*, so the last zone reaches the bottom: no clamping
  const edge = (line: number) => (line / ruler.lines) * RULER_HEIGHT;
  const zoneClass = { paper: styles.zonePaper, lower: styles.zoneLower, upper: styles.zoneUpper };
  return (
    <div className={styles.ruler} title={hover}>
      <svg
        ref={ref}
        className={styles.rulerSvg}
        viewBox={`0 0 10 ${RULER_HEIGHT}`}
        preserveAspectRatio="none"
        onMouseMove={(e) => onHover(tickAt(e))}
        onMouseLeave={() => onHover(undefined)}
        onClick={(e) => {
          const tick = tickAt(e);
          if (tick) onSelect(tick.index);
        }}
      >
        {ruler.zones.map((z) => (
          <rect
            key={z.kind}
            className={zoneClass[z.kind]}
            x={0}
            width={10}
            y={edge(z.from)}
            height={edge(z.to) - edge(z.from)}
          />
        ))}
        {ruler.ticks.map((t) => (
          <line
            key={t.index}
            className={t.matches ? styles.tick : styles.tickPark}
            x1={2}
            x2={10}
            y1={y(t.line)}
            y2={y(t.line)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {ruler.beamLine !== undefined && (
          <line
            className={styles.beam}
            x1={0}
            x2={10}
            y1={y(ruler.beamLine)}
            y2={y(ruler.beamLine)}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {ruler.hitLine !== undefined && (
          <line
            className={styles.hit}
            x1={0}
            x2={10}
            y1={y(ruler.hitLine)}
            y2={y(ruler.hitLine)}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
};

export const createCopperListPanel = ({ document, viewState }: DocumentProps) => (
  <CopperListPanel document={document} viewState={viewState} />
);
