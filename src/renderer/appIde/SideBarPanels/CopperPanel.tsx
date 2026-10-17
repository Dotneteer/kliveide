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
import { useT } from "@common/i18n/useT";

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
  const t = useT();
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const [state, setState] = useState<CopperState>();

  const refresh = useCallback(async () => {
    setState(await emuApi.getCopperState());
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  const model = useMemo(() => (state ? buildCopperModel(state) : undefined), [state]);
  if (!model) return <EmptyState message={t("panels.side.copper.notAvailable")} />;

  const { summary } = model;
  const hit = state.lastHit;
  const warnings = copperWarnings(summary);

  return (
    <DataPanel autoHeight xclass={styles.copperPanel}>
      <FieldRow label={t("panels.side.copper.mode")} tooltip={copperModeTooltip(state.startMode)}>
        <DataValue text={copperModeText(state.startMode)} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label={t("panels.side.copper.state")}>
        <DataValue text={copperStateText(model)} xclass={regStyles.stateValue} />
      </FieldRow>
      <FieldRow label="PC" tooltip={t("panels.side.copper.pcTooltip")}>
        <DataValue text={formatCopperIndex(state.pc)} xclass={regStyles.stateValue} />
        {hit && (
          <DataSecondary
            text={t("panels.side.copper.hitIndex", { index: formatCopperIndex(hit.index) })}
            xclass={regStyles.stateValueAlt}
          />
        )}
      </FieldRow>
      <FieldRow label={t("panels.side.copper.writePtr")} tooltip={t("panels.side.copper.writePtrTooltip")}>
        <DataValue
          text={`$${state.writeAddress.toString(16).toUpperCase().padStart(3, "0")}`}
          xclass={regStyles.stateValue}
        />
        <DataSecondary text={t("panels.side.copper.writeIndex", { index: formatCopperIndex(state.writeAddress >> 1) })} />
      </FieldRow>
      <FieldRow label={t("panels.side.copper.lineOffset")} tooltip={t("panels.side.copper.lineOffsetTooltip")}>
        <DataValue
          text={`$${state.lineOffset.toString(16).toUpperCase().padStart(2, "0")}`}
          xclass={regStyles.stateValue}
        />
      </FieldRow>
      <FieldRow
        label={t("panels.side.copper.beam")}
        tooltip={t("panels.side.copper.beamTooltip", { lines: state.timing.lines, hcs: state.timing.hcs })}
      >
        <DataValue
          text={t("panels.side.copper.beamValue", { line: state.beam.line, hc: state.beam.hc })}
          xclass={regStyles.stateValue}
        />
        {hit && (
          <DataSecondary
            text={t("panels.side.copper.hitBeam", { line: hit.line, hc: hit.hc })}
            xclass={regStyles.stateValueAlt}
          />
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
          {t("panels.side.copper.openList")}
        </button>
      </DataRow>
    </DataPanel>
  );
};
