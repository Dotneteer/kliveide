import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { useT } from "@common/i18n/useT";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import type { DisassemblyItem } from "../disassemblers/common-types";
import { formatBranchReadout, type BranchVerdict } from "./branchVerdict";
import { disassemblyRowMenuItems, type AnnotationRowMenuItem, type RowMenuTarget } from "./disassemblyRowMenu";
import {
  Field,
  Fields,
  InspectorButton,
  InspectorColumn,
  InspectorLink,
  InspectorSection
} from "@renderer/features/memoryMap/Inspector";
import styles from "@renderer/features/memoryMap/MemoryMap.module.scss";

/*
 * The Disassembly view's inspector (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §6.2): the selected
 * instruction, its verdict, what its operands point at, the rows that name its label, its
 * annotation and its breakpoint. The breakpoint and annotation actions are the row menu's own
 * entries (`disassemblyRowMenuItems`, `menuItemsFor`), run through the same commands and dialogs,
 * so the inspector adds no write path of its own; an annotation dialog commits at once, with no
 * Save ("Interactive Editing" in `dev/patterns/annotations.md`).
 */

export type InspectedOperand = {
  /** The operand as written: `$5C08`, `(HL)`, `(IX+$05)` */
  text: string;
  /** The name the listing printed for it */
  name?: string;
  address: number;
  /** `PART:offset` of the address, under the paging the listing shows */
  partition?: string;
  /** The first bytes there, when the listing's memory covers them */
  bytes?: number[];
  /** A NextReg the `nextreg` instruction writes */
  nextReg?: number;
  /** Resolved from a register (`(HL)`): where it points as the instruction runs */
  viaRegister?: string;
};

export type DisassemblyInspectorProps = {
  item: DisassemblyItem;
  /** `PART:offset` of the row */
  location?: string;
  kindBadge?: string;
  decimal: boolean;
  verdict?: BranchVerdict;
  /** The verdict is the machine's (the row is at PC), not "if the CPU arrived here now" */
  atPc: boolean;
  operands: InspectedOperand[];
  references?: { rowIndex: number; address: number; text: string }[];
  breakpointTarget: RowMenuTarget;
  partitionLabels: Record<number, string>;
  annotationEntries: AnnotationRowMenuItem[];
  onRunCommand: (command: string) => void;
  onEditBreakpoint: (bp: BreakpointInfo) => void;
  onAnnotationAction: (entry: AnnotationRowMenuItem) => void;
  onGoTo: (address: number) => void;
  onShowInMemory: (address: number) => void;
  onReference: (rowIndex: number) => void;
};

/** The annotation entries the inspector offers as buttons */
const ANNOTATION_BUTTONS = new Set(["local-label", "global-label", "comment", "synopsis", "operand-label", "clear"]);

export const DisassemblyInspector = (props: DisassemblyInspectorProps) => {
  const t = useT();
  const { item, decimal } = props;
  const hex = (v: number) => (decimal ? String(v) : `$${toHexa4(v)}`);
  const bytes = (item.opCodes ?? []).map((b) => toHexa2(b)).join(" ");
  const tstates =
    item.branch && item.branch.tstatesTaken !== item.branch.tstatesNotTaken
      ? t("panels.disassInspector.tstatesBoth", { taken: item.branch.tstatesTaken, notTaken: item.branch.tstatesNotTaken })
      : item.tstates !== undefined
        ? t("panels.disassInspector.tstates", { count: item.tstates })
        : undefined;
  const readout = props.verdict ? formatBranchReadout(props.verdict, decimal) : undefined;
  const breakpointItems = disassemblyRowMenuItems(props.breakpointTarget, props.partitionLabels).filter(
    (entry) => entry.id !== "showGraphics"
  );
  const bp = props.breakpointTarget.breakpoint;
  const annotationEntries = props.annotationEntries.filter((e) => ANNOTATION_BUTTONS.has(e.id));
  const disabledReason = props.annotationEntries.find((e) => e.disabled && e.tooltip)?.tooltip;

  return (
    <InspectorColumn address={hex(item.address)} sub={props.location} badge={props.kindBadge}>
      <InspectorSection
        title={t("panels.disassInspector.instruction")}
        aside={[t("panels.disassInspector.bytes", { count: item.opCodes?.length ?? 0 }), tstates].filter(Boolean).join(" · ")}
      >
        <div className={styles.operandName}>
          {item.formattedLabel ? `${item.formattedLabel.replace(/:$/, "")}: ` : ""}
          {item.instruction}
        </div>
        <div className={styles.fieldDim}>{bytes}</div>
        {item.hardComment && <div className={styles.fieldDim}>; {item.hardComment}</div>}
      </InspectorSection>

      {readout && (
        <InspectorSection
          title={t("panels.disassInspector.verdict")}
          aside={props.atPc ? t("panels.disassInspector.verdictCertain") : t("panels.disassInspector.verdictIf")}
        >
          <div className={styles.fieldValue}>{readout.long.head}</div>
          {readout.long.detail && <div className={styles.fieldDim}>{readout.long.detail}</div>}
        </InspectorSection>
      )}

      {props.operands.length > 0 && (
        <InspectorSection title={t("panels.disassInspector.operands")}>
          {props.operands.map((op, i) => (
            <div key={i} className={styles.operand}>
              <div className={styles.operandHead}>
                <span className={styles.operandName}>{op.name ?? op.text}</span>
                <span className={styles.fieldDim}>
                  {op.viaRegister ? `${op.viaRegister} = ` : ""}
                  {hex(op.address)}
                  {op.partition ? ` · ${op.partition}` : ""}
                </span>
                <span className={styles.spacer} />
                <InspectorLink onClick={() => props.onGoTo(op.address)}>{t("panels.disassInspector.goTo")}</InspectorLink>
                <InspectorLink onClick={() => props.onShowInMemory(op.address)}>{t("panels.disassInspector.memory")} ↗</InspectorLink>
              </div>
              {op.bytes && <div className={styles.byteRun}>{op.bytes.map((b) => toHexa2(b)).join(" ")}</div>}
              {op.viaRegister && <div className={styles.hint}>{t("panels.disassInspector.viaRegister")}</div>}
              {op.nextReg !== undefined && (
                <InspectorLink onClick={() => props.onRunCommand(`show-nextregs $${toHexa2(op.nextReg!)}`)}>
                  {t("panels.disassInspector.nextReg", { reg: `$${toHexa2(op.nextReg)}` })} ↗
                </InspectorLink>
              )}
            </div>
          ))}
        </InspectorSection>
      )}

      {props.references && (
        <InspectorSection
          title={t("panels.disassInspector.referredBy")}
          aside={t("panels.disassInspector.refCount", { count: props.references.length })}
        >
          <div className={styles.refList}>
            {props.references.slice(0, 200).map((ref) => (
              <button key={ref.rowIndex} type="button" className={styles.refRow} onClick={() => props.onReference(ref.rowIndex)}>
                <span className={styles.miniAddress}>{hex(ref.address)}</span>
                <span>{ref.text}</span>
              </button>
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title={t("panels.disassInspector.annotation")}>
        <Fields>
          <Field label={t("panels.disassInspector.label")} plain>
            {item.formattedLabel ? item.formattedLabel.replace(/:$/, "") : <span className={styles.fieldDim}>—</span>}
          </Field>
          <Field label={t("panels.disassInspector.comment")} plain>
            {item.hardComment ?? <span className={styles.fieldDim}>—</span>}
          </Field>
        </Fields>
        {annotationEntries.length > 0 ? (
          <div className={styles.actions}>
            {annotationEntries.map((entry) => (
              <InspectorButton
                key={entry.id}
                disabled={entry.disabled}
                title={entry.tooltip ?? entry.hint}
                onClick={() => props.onAnnotationAction(entry)}
              >
                {entry.text}
              </InspectorButton>
            ))}
          </div>
        ) : (
          <div className={styles.hint}>{disabledReason ?? t("panels.disassInspector.notAnnotatable")}</div>
        )}
      </InspectorSection>

      <InspectorSection
        title={t("panels.disassInspector.breakpoint")}
        aside={bp ? (bp.disabled ? t("panels.disassInspector.bpDisabled") : t("panels.disassInspector.bpSet")) : t("panels.disassInspector.bpNone")}
      >
        <div className={styles.actions}>
          {breakpointItems.map((entry) => (
            <InspectorButton
              key={entry.id}
              disabled={entry.disabled}
              title={entry.hint}
              onClick={() => {
                if (entry.command) props.onRunCommand(entry.command);
                else if (entry.id === "edit" && bp) props.onEditBreakpoint(bp);
              }}
            >
              {entry.text}
            </InspectorButton>
          ))}
        </div>
        {bp?.condition && <div className={styles.hint}>{t("panels.disassInspector.condition", { condition: bp.condition })}</div>}
      </InspectorSection>

      <InspectorSection title={t("panels.disassInspector.use")}>
        <div className={styles.actions}>
          <InspectorButton onClick={() => props.onShowInMemory(item.address)}>{t("panels.disassInspector.showInMemory")}</InspectorButton>
        </div>
      </InspectorSection>
    </InspectorColumn>
  );
};
