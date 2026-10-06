import { useCallback, useMemo, useState, type ReactNode } from "react";
import classnames from "classnames";

import type { CopperState } from "@common/messaging/EmuApi";
import {
  copperMoveSwatch,
  describeCopperInstruction,
  formatCopperIndex,
  formatCopperInstruction
} from "@common/zxnext/copper/copperDecoder";
import {
  DataLabel,
  DataPanel,
  DataRow,
  DataSecondary,
  DataValue,
  EmptyState
} from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import {
  buildCopperModel,
  copperModeText,
  copperModeTooltip,
  copperStateText,
  copperSummaryText,
  copperWarnings,
  copperWindow
} from "@renderer/features/copper/copperViewModel";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./CopperPanel.module.scss";

/**
 * The Copper side-bar panel (`.plans/COPPER_DEBUGGING_PLAN.md` §4.4, G3.1): the Copper's live
 * state and a seven-row window of decoded instructions around its PC. A converted state panel:
 * values take `--color-state-value`, the hit and "now" markers are separate (trap T1).
 */

const LABEL_WIDTH = "12ch";

const FieldRow = ({
  label,
  tooltip,
  children
}: {
  label: string;
  tooltip?: string;
  children: ReactNode;
}) => {
  const ref = useTooltipRef<HTMLDivElement>();
  return (
    <DataRow dense hoverable xclass={styles.fieldRow} ref={ref}>
      <DataLabel text={label} width={LABEL_WIDTH} />
      {children}
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="bottom-start"
          offsetX={0}
          offsetY={0}
          showDelay={300}
          content={tooltip}
          className={regStyles.rowTooltip}
        />
      )}
    </DataRow>
  );
};

export const CopperPanel = () => {
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const [state, setState] = useState<CopperState>();

  const refresh = useCallback(async () => {
    setState(await emuApi.getCopperState());
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  const model = useMemo(() => (state ? buildCopperModel(state) : undefined), [state]);
  if (!model) return <EmptyState message="The Copper state is not available" />;

  const { summary } = model;
  const hit = state.lastHit;
  const warnings = copperWarnings(summary);

  return (
    <DataPanel autoHeight xclass={styles.copperPanel}>
      <FieldRow label="Mode" tooltip={copperModeTooltip(state.startMode)}>
        <DataValue text={copperModeText(state.startMode)} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label="State">
        <DataValue text={copperStateText(model)} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label="PC" tooltip="The Copper's list address (instruction index)">
        <DataValue text={formatCopperIndex(state.pc)} xclass={regStyles.stateValue} />
        {hit && (
          <DataSecondary
            text={`hit ${formatCopperIndex(hit.index)}`}
            xclass={regStyles.stateValueAlt}
          />
        )}
      </FieldRow>
      <FieldRow label="Write ptr" tooltip="The CPU's $60/$63 write pointer, in bytes ($61/$62)">
        <DataValue
          text={`$${state.writeAddress.toString(16).toUpperCase().padStart(3, "0")}`}
          xclass={regStyles.stateValue}
        />
        <DataSecondary text={`index ${formatCopperIndex(state.writeAddress >> 1)}`} />
      </FieldRow>
      <FieldRow label="Line offset" tooltip="NextReg $64: the line the Copper counts as cvc 0">
        <DataValue
          text={`$${state.lineOffset.toString(16).toUpperCase().padStart(2, "0")}`}
          xclass={regStyles.stateValue}
        />
      </FieldRow>
      <FieldRow
        label="Beam"
        tooltip={`The beam in Copper coordinates at the CPU's tact: line (cvc) and hc_ula.\nFrame: ${state.timing.lines} lines × ${state.timing.hcs} hc`}
      >
        <DataValue
          text={`line ${state.beam.line}, hc ${state.beam.hc}`}
          xclass={regStyles.stateValue}
        />
        {hit && (
          <DataSecondary text={`hit ${hit.line}, ${hit.hc}`} xclass={regStyles.stateValueAlt} />
        )}
      </FieldRow>

      <div className={styles.window}>
        {copperWindow(model).map((instr) => {
          const isPc = instr.index === state.pc;
          const isHit = hit?.index === instr.index;
          const swatch =
            instr.kind === "move" ? copperMoveSwatch(instr.reg, instr.value) : undefined;
          return (
            <DataRow
              key={instr.index}
              dense
              xclass={classnames(styles.instrRow, { [styles.pcRow]: isPc, [styles.hitRow]: isHit })}
            >
              <span className={styles.marker}>{isPc ? "▶" : isHit ? "●" : ""}</span>
              <DataValue text={formatCopperIndex(instr.index)} xclass={regStyles.stateValue} />
              <DataValue text={formatCopperInstruction(instr)} xclass={styles.instrText} />
              {swatch && <span className={styles.swatch} style={{ backgroundColor: swatch }} />}
              <DataSecondary
                text={describeCopperInstruction(instr, model.timing)}
                xclass={styles.meaning}
              />
            </DataRow>
          );
        })}
      </div>

      <DataRow dense xclass={styles.footer}>
        <span
          className={classnames(styles.summary, { [styles.summaryWarning]: warnings.length > 0 })}
          title={warnings.join("\n") || undefined}
        >
          {copperSummaryText(summary)}
        </span>
        <button
          type="button"
          className={styles.link}
          onClick={() => void ideCommandsService.executeCommand("show-copper")}
        >
          Open Copper List
        </button>
      </DataRow>
    </DataPanel>
  );
};
