import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import type { BreakpointDialogResult } from "@renderer/appIde/utils/breakpoint-actions";
import type {
  BreakpointEnvironment,
  BreakpointFormState,
  BreakpointKind
} from "@renderer/appIde/utils/breakpoint-form";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { TextInput } from "@controls/TextInput";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";
import { RadioGroup, type RadioGroupOption } from "@renderer/controls/RadioGroup";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { Button } from "@renderer/controls/Button";
import { useMainApi } from "@renderer/core/MainApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import {
  copperWordAt,
  decodeCopperWord,
  describeCopperInstruction,
  formatCopperInstruction
} from "@common/zxnext/copper/copperDecoder";
import { PartitionPicker } from "@renderer/controls/PartitionPicker";
import type { MemoryMachineSetupState } from "@renderer/features/memory/useMemoryMachineSetup";
import {
  applyKindChange,
  breakpointFormWarnings,
  breakpointToForm,
  createEmptyForm,
  formToBreakpointInfo,
  isBankRelativeInput,
  isCopperKind,
  isFormValid,
  isInterruptKind,
  isSpriteKind,
  isNextRegKind,
  parseNumericInput,
  validateBreakpointForm
} from "@renderer/appIde/utils/breakpoint-form";
// --- Register names: the union of every core's set (`dev/ai/zxnext-models.md` D5)
import { nextRegUnion } from "@emu/machines/zxNext/nextRegSets";
import { SPRITE_ATTRIBUTE_LABELS } from "@common/zxnext/sprites/spriteBreakpoints";
import { stopSourceIds } from "@common/zxnext/interrupts/interruptStops";
import { NEXT_INT_SOURCE_IDS, NEXT_INT_SOURCE_NAMES } from "@common/zxnext/interrupts/interruptState";
import styles from "./BreakpointDialog.module.scss";
import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { withLabels } from "@common/i18n/labels";

/**
 * Authors a binary (address-bound) breakpoint, and edits the condition and hit rule of any
 * breakpoint.
 *
 * Source-code breakpoints are *placed* by the editor's glyph margin, which tracks them as lines
 * move; opened on one, the dialog is in **source mode** - the location is shown, and only the
 * condition, the hit rule and the enabled state are editable
 * (`dev/plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2).
 *
 * Every rule lives in `breakpoint-form.ts`, which has no React in it and is tested without mounting
 * anything. This component decides only what to *show*.
 */

const KIND_OPTIONS: RadioGroupOption[] = withLabels([
  { value: "exec", labelKey: "dialog.breakpoint.kind.exec" },
  { value: "memRead", labelKey: "dialog.breakpoint.kind.memRead" },
  { value: "memWrite", labelKey: "dialog.breakpoint.kind.memWrite" },
  { value: "ioRead", labelKey: "dialog.breakpoint.kind.ioRead" },
  { value: "ioWrite", labelKey: "dialog.breakpoint.kind.ioWrite" }
]);

/** The sixth option, offered only on a machine that has Next Registers. */
const [NEXT_REG_OPTION]: RadioGroupOption[] = withLabels([
  { value: "nextRegWrite", labelKey: "dialog.breakpoint.kind.nextRegWrite" }
]);

/** The seventh, on the same machines: the Copper completes a list instruction. */
const [COPPER_OPTION]: RadioGroupOption[] = withLabels([
  { value: "copper", labelKey: "dialog.breakpoint.kind.copper" }
]);

/** The eighth, on the same machines: an attribute byte of a sprite is written. */
const [SPRITE_OPTION]: RadioGroupOption[] = withLabels([
  { value: "sprite", labelKey: "dialog.breakpoint.kind.sprite" }
]);

/** The ninth, on the same machines: an interrupt event (NEXT_INTERRUPTS_DEBUGGING_PLAN §5). */
const [INTERRUPT_OPTION]: RadioGroupOption[] = withLabels([
  { value: "interrupt", labelKey: "dialog.breakpoint.kind.interrupt" }
]);

/** The interrupt stop's events (a function: labels are read at display) */
const interruptEventOptions = (): DropdownOption[] => [
  { value: "ack", label: translate("dialog.breakpoint.interrupt.event.ack") },
  { value: "lost", label: translate("dialog.breakpoint.interrupt.event.lost") },
  { value: "retn", label: translate("dialog.breakpoint.interrupt.event.retn") },
  { value: "reti", label: translate("dialog.breakpoint.interrupt.event.reti") },
  { value: "wait", label: translate("dialog.breakpoint.interrupt.event.wait") },
  { value: "nmi", label: translate("dialog.breakpoint.interrupt.event.nmi") }
];

/** The sources an event may be narrowed to: the chain's for ack/lost/wait, the NMI devices for nmi */
const interruptSourceOptions = (event: string): DropdownOption[] => {
  const any = { value: "", label: translate("dialog.breakpoint.interrupt.anySource") };
  if (event === "nmi") {
    return [any, { value: "multiface", label: "Multiface" }, { value: "divmmc", label: "DivMMC" }];
  }
  return [
    any,
    ...stopSourceIds().map((id) => ({ value: id, label: NEXT_INT_SOURCE_NAMES[NEXT_INT_SOURCE_IDS.indexOf(id as never)] }))
  ];
};

/**
 * The Copper index field's hint: the instruction at that index in the live list RAM, decoded, or
 * the accepted spellings when the index does not parse or the RAM is not known.
 */
const describeCopperIndex = (text: string, ram: Uint8Array | undefined): string | undefined => {
  const parsed = parseNumericInput(text);
  if (!parsed.ok || parsed.value < 0 || parsed.value > 0x3ff || !ram) return undefined;
  const instr = decodeCopperWord(parsed.value, copperWordAt(ram, parsed.value));
  const hex = `$${parsed.value.toString(16).toUpperCase().padStart(3, "0")}`;
  return `${hex} — ${formatCopperInstruction(instr)} · ${describeCopperInstruction(instr)}`;
};

/** What the breakpoint does when its filters pass (`dev/plans/LOGPOINTS_PLAN.md` §4.5). */
const ACTION_OPTIONS: RadioGroupOption[] = withLabels([
  { value: "stop", labelKey: "dialog.breakpoint.action.stop" },
  { value: "log", labelKey: "dialog.breakpoint.action.log" }
]);

/**
 * What the register field says beneath itself: the register's documented name, or that it has none.
 *
 * A live hint rather than a dropdown of all 256. Only 141 are documented, a 256-row menu is worse
 * to scroll than `$07` is to type, and this gives the dropdown's one real benefit - telling you
 * which register you just named - without its cost.
 */
const describeNextReg = (text: string): string | undefined => {
  const parsed = parseNumericInput(text);
  if (!parsed.ok || parsed.value < 0 || parsed.value > 0xff) return undefined;
  const hex = `$${parsed.value.toString(16).toUpperCase().padStart(2, "0")}`;
  const described = nextRegUnion().find((d) => d.id === parsed.value);
  return described
    ? `${hex} — ${described.description}`
    : translate("dialog.breakpoint.nextReg.undocumented", { register: hex });
};

/**
 * The dialog's pages, in the Settings dialog's frame: where it stops, under what condition, and what
 * it does then.
 */
type BreakpointPage = "trigger" | "condition" | "action";

const PAGE_ORDER: BreakpointPage[] = ["trigger", "condition", "action"];

/**
 * Which page shows each field's error: the page that gets the error dot, and the one Add goes to
 * when the form does not validate. `form` (the duplicate-key rule) is the trigger's: the key is made
 * of the type and the place.
 */
const PAGE_FIELDS: Record<BreakpointPage, (keyof BreakpointFormState | "form")[]> = {
  trigger: [
    "address",
    "length",
    "ioMask",
    "partition",
    "nextReg",
    "nextRegValue",
    "nextRegMask",
    "copperIndex",
    "spriteIndex",
    "spriteAttrMask",
    "interruptSource",
    "interruptWait",
    "form"
  ],
  condition: ["condition", "hitCount"],
  action: ["logMessage"]
};

const isIoKind = (kind: BreakpointKind) => kind === "ioRead" || kind === "ioWrite";

/*
 * Field widths, in characters, because these fields are monospace and hold numbers of a known size.
 *
 * A full-width box promises room the value can never use: the widest 16-bit literal the parser
 * accepts is `%1000000000000000` at 17 characters, and the widest byte is `%00000111` at 9. Sizing
 * each field to its own content is also what tells the two apart at a glance - a register is not
 * an address, and a box the width of the dialog says it might be.
 *
 * `ch`, not pixels: mandate M2, and the mono stack has changed advance width before (Menlo's 0.6em
 * to Iosevka's 0.5em), which silently mistuned every pixel width tuned to the old one.
 */
const WORD_FIELD = "20ch";
const BYTE_FIELD = "12ch";

/** The hit-count rules, in the order §4.4.1 lists them. */
const HIT_MODE_OPTIONS: DropdownOption[] = withLabels([
  { value: "always", labelKey: "dialog.breakpoint.hitMode.always" },
  { value: "eq", labelKey: "dialog.breakpoint.hitMode.eq" },
  { value: "gt", labelKey: "dialog.breakpoint.hitMode.gt" },
  { value: "ge", labelKey: "dialog.breakpoint.hitMode.ge" },
  { value: "lt", labelKey: "dialog.breakpoint.hitMode.lt" },
  { value: "le", labelKey: "dialog.breakpoint.hitMode.le" },
  { value: "every", labelKey: "dialog.breakpoint.hitMode.every" }
]);

/** Log-template syntax shown in the message field's hint and placeholder; not translated. */
const LOG_EXPR = "{expr}";
const LOG_EXPR_HEX = "{expr:hex8}";
const LOG_EXAMPLE = "[LOOP] B={B} HL={HL:hex16} score={w[score]}";

/** Condition syntax shown in the condition field's placeholder; not translated. */
const CONDITION_EXAMPLE_1 = "A == $FF && !ZF";
const CONDITION_EXAMPLE_2 = "w[score] >= 100";

/** The docs section the condition field's "Syntax" link opens. */
const CONDITION_SYNTAX_PAGE = "/working-with-ide/breakpoints#conditions-and-hit-counts";

/** The docs section the log message field's "Syntax" link opens. */
const LOGPOINT_SYNTAX_PAGE = "/working-with-ide/breakpoints#logpoints";

type Props = DialogComponentProps<BreakpointDialogResult> & {
  /** The breakpoint being edited. Absent when adding. */
  initial?: BreakpointInfo;
  env: BreakpointEnvironment;
  /**
   * The same machine setup the Memory view uses, so the partition picker here is the very control
   * that view offers — a list on a machine with a handful of banks, a bank matrix on one with 247.
   */
  machineSetup: Pick<
    MemoryMachineSetupState,
    "displayBankMatrix" | "segmentOptions" | "partitionOptions"
  >;
  /**
   * Which field to focus first: the margin's "Edit Hit Count…" opens on the hit count; "Add
   * Logpoint…" and "Convert to Logpoint…" open on the log message, with the action set to log.
   */
  focus?: "condition" | "hitCount" | "logMessage";
  /** Zero the edited breakpoint's hit counter. Absent when adding (there is no counter yet). */
  onResetHits?: () => Promise<void>;
};

export const BreakpointDialog = ({
  initial,
  env,
  machineSetup,
  focus,
  onResetHits,
  controls
}: Props) => {
  const mainApi = useMainApi();
  const t = useT();
  // --- The live count as it was when the dialog opened; Reset shows the zero it set
  const [hits, setHits] = useState<number | undefined>(initial?.currentHits);
  const [form, setForm] = useState<BreakpointFormState>(() => {
    const start = initial ? breakpointToForm(initial) : createEmptyForm();
    return focus === "logMessage" ? { ...start, action: "log" } : start;
  });
  /**
   * Errors are shown only for fields the user has left, plus everything once Save is pressed.
   * Validating a blank Add form on first paint would greet the user with "Enter an address."
   * before they had a chance to type one.
   */
  const [touched, setTouched] = useState<Partial<Record<keyof BreakpointFormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateBreakpointForm(form, env), [form, env]);
  const warnings = useMemo(() => breakpointFormWarnings(form, env), [form, env]);
  const sourceMode = form.source !== undefined;
  const valid = isFormValid(errors);
  const editing = initial !== undefined;

  const shows = (field: keyof BreakpointFormState) => submitted || touched[field];
  const errorFor = (field: keyof BreakpointFormState) =>
    shows(field) ? errors[field] : undefined;

  const update = (over: Partial<BreakpointFormState>) => setForm((prev) => ({ ...prev, ...over }));

  const ioKind = isIoKind(form.kind);
  const nextRegKind = isNextRegKind(form.kind);
  const copperKind = isCopperKind(form.kind);
  const spriteKind = isSpriteKind(form.kind);
  const interruptKind = isInterruptKind(form.kind);
  // --- The sixth to ninth types are offered only where they mean something.
  // --- `validateBreakpointForm` refuses them anyway, but a type a machine cannot have should not be
  // --- on screen to choose.
  const kindOptions = useMemo(
    () =>
      env.supportsNextRegBreakpoints
        ? [...KIND_OPTIONS, NEXT_REG_OPTION, COPPER_OPTION, SPRITE_OPTION, INTERRUPT_OPTION]
        : KIND_OPTIONS,
    [env.supportsNextRegBreakpoints]
  );
  // --- The live Copper RAM, read once when the Copper kind is chosen, for the index preview
  const emuApi = useEmuApi();
  const [copperRam, setCopperRam] = useState<Uint8Array | undefined>();
  useEffect(() => {
    if (!copperKind || copperRam) return undefined;
    let live = true;
    emuApi
      .getCopperState()
      .then((state) => live && setCopperRam(state?.ram))
      .catch(() => {
        // --- No machine, or not a Next: the field keeps its plain hint
      });
    return () => {
      live = false;
    };
  }, [copperKind, copperRam, emuApi]);
  // --- A bank-relative address names its own bank, so the partition control has nothing left to
  // --- choose. Judged from what is *typed*, so the row responds as the user finishes the spelling.
  const bankRelative = isBankRelativeInput(form.address);
  // --- A partition is meaningless on an I/O breakpoint, and the command layer rejects the pair
  // --- outright. Disable rather than hide, so switching type does not make a row jump away.
  // --- Hidden entirely for a NextReg breakpoint rather than disabled with an explanation: a
  // --- register has no location, so there is no "why not" worth a sentence - unlike the I/O case,
  // --- where a user might reasonably expect a partition to apply.
  const partitionEnabled =
    env.supportsPartitions && !ioKind && !bankRelative && !nextRegKind && !copperKind && !spriteKind;
  /*
   * What ticking the partition box selects first. The lowest index the machine actually has, which
   * is ROM 0 where there are ROMs and bank 0 otherwise — never a hardcoded 0, which is not a
   * partition at all on a machine whose indices start negative.
   */
  const defaultPartition = useMemo(() => {
    const indices = Object.keys(env.partitionLabels ?? {}).map(Number);
    return indices.length ? Math.min(...indices) : 0;
  }, [env.partitionLabels]);
  const addressLabel = ioKind ? t("dialog.breakpoint.portLabel") : t("dialog.breakpoint.addressLabel");
  // --- The place rows (type, partition, register, address, port mask) are the editor's in source
  // --- mode; the first editable field takes the focus instead.
  const focusCondition =
    focus === "condition" || (sourceMode && focus !== "hitCount" && focus !== "logMessage");
  const logging = form.action === "log";

  // --- The page the dialog opens on: the one holding the field it was asked to focus. A source
  // --- breakpoint's place is the editor's, so it opens on what can be edited.
  const [page, setPage] = useState<BreakpointPage>(() =>
    focus === "logMessage"
      ? "action"
      : focus === "condition" || focus === "hitCount" || sourceMode
        ? "condition"
        : "trigger"
  );
  const pageHasError = (p: BreakpointPage) =>
    PAGE_FIELDS[p].some(
      (field) => errors[field] !== undefined && (submitted || (field !== "form" && touched[field]))
    );

  const submit = () => {
    setSubmitted(true);
    if (!valid) {
      // --- An error on a page out of sight would leave Add doing nothing visible: go to it
      const first = PAGE_ORDER.find((p) => PAGE_FIELDS[p].some((field) => errors[field] !== undefined));
      if (first) setPage(first);
      return;
    }
    controls.close({
      breakpoint: formToBreakpointInfo(form),
      replaces: initial
    });
  };

  // --- What each page holds, in one line under its name, so no setting hides behind a page
  const kindLabel = kindOptions.find((o) => o.value === form.kind)?.label ?? "";
  const triggerValue = nextRegKind
    ? form.nextReg
    : copperKind
      ? form.copperIndex
      : spriteKind
        ? form.spriteIndex
        : interruptKind
          ? (interruptEventOptions().find((o) => o.value === form.interruptEvent)?.label ?? "")
          : form.address;
  // --- An interrupt stop's event names the type already ("An interrupt is taken")
  const triggerSummary = sourceMode
    ? sourceLocationText(form.source!)
    : interruptKind
      ? triggerValue
      : triggerValue.trim()
      ? t("dialog.breakpoint.summary.trigger", { kind: kindLabel, value: triggerValue.trim() })
      : kindLabel;
  const hitRule =
    form.hitMode === "always"
      ? undefined
      : t("dialog.breakpoint.summary.hitRule", {
          rule: HIT_MODE_OPTIONS.find((o) => o.value === form.hitMode)?.label ?? "",
          count: form.hitCount.trim() || "n"
        });
  const condition = form.condition.trim();
  const conditionSummary =
    condition && hitRule
      ? t("dialog.breakpoint.summary.conditionAndHits", { condition, hits: hitRule })
      : condition || hitRule || t("dialog.breakpoint.hitMode.always");
  const actionSummary = logging
    ? form.logMessage.trim()
      ? t("dialog.breakpoint.summary.log", { message: form.logMessage.trim() })
      : t("dialog.breakpoint.action.log")
    : form.oneShot
      ? t("dialog.breakpoint.summary.stopOnce")
      : t("dialog.breakpoint.action.stop");
  const pages: { id: BreakpointPage; label: string; summary: string }[] = [
    {
      id: "trigger",
      label: sourceMode ? t("dialog.breakpoint.locationLabel") : t("dialog.breakpoint.page.trigger"),
      summary: triggerSummary
    },
    { id: "condition", label: t("dialog.breakpoint.conditionLabel"), summary: conditionSummary },
    { id: "action", label: t("dialog.breakpoint.actionLabel"), summary: actionSummary }
  ];

  // --- When the machine stops, which differs by type: said once, on the Action page
  const stopNote = sourceMode
    ? undefined
    : nextRegKind
      ? t("dialog.breakpoint.nextRegStopNote")
      : copperKind
        ? t("dialog.breakpoint.copperStopNote")
        : spriteKind
          ? t("dialog.breakpoint.spriteStopNote")
          : interruptKind
            ? t("dialog.breakpoint.interrupt.stopNote")
            : undefined;

  const triggerPage = sourceMode ? (
    <section className={styles.group}>
      <h4 className={styles.groupTitle}>{t("dialog.breakpoint.locationLabel")}</h4>
      <div className={styles.location}>{sourceLocationText(form.source!)}</div>
    </section>
  ) : (
    <>
      <section className={styles.group}>
        <h4 className={styles.groupTitle}>{t("dialog.breakpoint.typeLabel")}</h4>
        {/*
          * Filled column by column, so the CPU's types stand in the first column and the Next's
          * hardware in the second. Five rows on every machine: the 48K's single column is as tall
          * as the Next's two, so the page below starts at the same place on both.
          */}
        <RadioGroup
          ariaLabel={t("dialog.breakpoint.typeAria")}
          options={kindOptions}
          value={form.kind}
          columns={env.supportsNextRegBreakpoints ? 2 : 1}
          flow="column"
          onChange={(kind) => setForm((prev) => applyKindChange(prev, kind as BreakpointKind))}
        />
      </section>

      <section className={styles.group}>
        <h4 className={styles.groupTitle}>{t("dialog.breakpoint.whereLabel")}</h4>
        <div className={styles.fields}>
          {nextRegKind && (
            <>
              <Field label={t("dialog.breakpoint.registerLabel")}>
                <div className={styles.inline}>
                  <TextInput
                    value={form.nextReg}
                    width={BYTE_FIELD}
                    ariaLabel={t("dialog.breakpoint.registerLabel")}
                    error={errorFor("nextReg")}
                    autoFocus={!focus}
                    onChange={(nextReg) => {
                      setTouched((t) => ({ ...t, nextReg: true }));
                      update({ nextReg });
                    }}
                  />
                  {/*
                    * A live hint rather than a dropdown of all 256: it names the register just
                    * typed, the dropdown's one real benefit, without its scrolling.
                    */}
                  <span className={styles.sideHint}>
                    {describeNextReg(form.nextReg) ?? t("dialog.breakpoint.registerHint")}
                  </span>
                </div>
              </Field>

              {/*
                * The value and the mask sit beside the box that turns them on, laid out the way the
                * breakpoint's key reads them (`=$03/$0F`), so ticking it does not push a row down.
                */}
              <Field label={t("dialog.breakpoint.valueFilterLabel")}>
                <div className={styles.inline}>
                  <Checkbox
                    initialValue={form.filterValue}
                    label={t("dialog.breakpoint.valueFilterCheckbox")}
                    right={true}
                    onChange={(on) => {
                      setTouched((t) => ({ ...t, nextRegValue: true }));
                      // --- Cleared on the way out, so an abandoned filter cannot survive invisibly
                      // --- and fail validation against fields that are no longer on screen.
                      update(on ? { filterValue: true } : { filterValue: false, nextRegValue: "", nextRegMask: "" });
                    }}
                  />
                  {form.filterValue && (
                    <>
                      <TextInput
                        value={form.nextRegValue}
                        width={BYTE_FIELD}
                        ariaLabel={t("dialog.breakpoint.valueAria")}
                        error={errorFor("nextRegValue")}
                        onChange={(nextRegValue) => {
                          setTouched((t) => ({ ...t, nextRegValue: true }));
                          update({ nextRegValue });
                        }}
                      />
                      <span className={styles.filterSeparator} aria-hidden="true">
                        /
                      </span>
                      <TextInput
                        value={form.nextRegMask}
                        width={BYTE_FIELD}
                        ariaLabel={t("dialog.breakpoint.maskAria")}
                        error={errorFor("nextRegMask")}
                        onChange={(nextRegMask) => {
                          setTouched((t) => ({ ...t, nextRegMask: true }));
                          update({ nextRegMask });
                        }}
                      />
                    </>
                  )}
                </div>
                {form.filterValue && (
                  <div className={styles.hint}>{t("dialog.breakpoint.valueFilterHint")}</div>
                )}
              </Field>

              <Field>
                <Checkbox
                  initialValue={form.nextRegCopper}
                  label={t("dialog.breakpoint.nextRegCopper")}
                  right={true}
                  onChange={(nextRegCopper) => update({ nextRegCopper })}
                />
              </Field>
            </>
          )}

          {copperKind && (
            <Field label={t("dialog.breakpoint.copperIndexLabel")}>
              <TextInput
                value={form.copperIndex}
                width={BYTE_FIELD}
                ariaLabel={t("dialog.breakpoint.copperIndexLabel")}
                error={errorFor("copperIndex")}
                autoFocus={!focus}
                onChange={(copperIndex) => {
                  setTouched((t) => ({ ...t, copperIndex: true }));
                  update({ copperIndex });
                }}
              />
              <div className={styles.hint}>
                {describeCopperIndex(form.copperIndex, copperRam) ??
                  t("dialog.breakpoint.copperIndexHint")}
              </div>
            </Field>
          )}

          {spriteKind && (
            <>
              <Field label={t("dialog.breakpoint.spriteLabel")}>
                <div className={styles.inline}>
                  <TextInput
                    value={form.spriteIndex}
                    width={BYTE_FIELD}
                    ariaLabel={t("dialog.breakpoint.spriteLabel")}
                    error={errorFor("spriteIndex")}
                    autoFocus={!focus}
                    onChange={(spriteIndex) => {
                      setTouched((t) => ({ ...t, spriteIndex: true }));
                      update({ spriteIndex });
                    }}
                  />
                  <span className={styles.sideHint}>{t("dialog.breakpoint.spriteHint")}</span>
                </div>
              </Field>
              <Field label={t("dialog.breakpoint.attrBytesLabel")}>
                <div
                  className={styles.attrBytes}
                  role="group"
                  aria-label={t("dialog.breakpoint.attrBytesLabel")}
                >
                  {SPRITE_ATTRIBUTE_LABELS.map((label, attr) => (
                    <Checkbox
                      key={attr}
                      initialValue={(form.spriteAttrMask & (1 << attr)) !== 0}
                      label={`${attr}: ${label}`}
                      right={true}
                      onChange={(on) => {
                        setTouched((t) => ({ ...t, spriteAttrMask: true }));
                        setForm((prev) => ({
                          ...prev,
                          spriteAttrMask: on
                            ? prev.spriteAttrMask | (1 << attr)
                            : prev.spriteAttrMask & ~(1 << attr)
                        }));
                      }}
                    />
                  ))}
                </div>
                {errorFor("spriteAttrMask") && (
                  <div className={styles.error} role="alert">
                    {errorFor("spriteAttrMask")}
                  </div>
                )}
              </Field>
            </>
          )}

          {interruptKind && (
            <>
              <Field label={t("dialog.breakpoint.interrupt.eventLabel")}>
                <Dropdown
                  options={interruptEventOptions()}
                  initialValue={form.interruptEvent}
                  ariaLabel={t("dialog.breakpoint.interrupt.eventLabel")}
                  width="34ch"
                  onChanged={(interruptEvent) => {
                    setTouched((t) => ({ ...t, interruptSource: true }));
                    update({ interruptEvent: interruptEvent as BreakpointFormState["interruptEvent"], interruptSource: "" });
                  }}
                />
              </Field>
              {form.interruptEvent !== "retn" && form.interruptEvent !== "reti" && (
                <Field label={t("dialog.breakpoint.interrupt.sourceLabel")}>
                  <Dropdown
                    key={form.interruptEvent === "nmi" ? "nmi" : "chain"}
                    options={interruptSourceOptions(form.interruptEvent)}
                    initialValue={form.interruptSource}
                    ariaLabel={t("dialog.breakpoint.interrupt.sourceLabel")}
                    width="20ch"
                    onChanged={(interruptSource) => {
                      setTouched((t) => ({ ...t, interruptSource: true }));
                      update({ interruptSource });
                    }}
                  />
                  {errorFor("interruptSource") && (
                    <div className={styles.error} role="alert">
                      {errorFor("interruptSource")}
                    </div>
                  )}
                </Field>
              )}
              {form.interruptEvent === "wait" && (
                <Field label={t("dialog.breakpoint.interrupt.waitLabel")}>
                  <TextInput
                    value={form.interruptWait}
                    width={BYTE_FIELD}
                    ariaLabel={t("dialog.breakpoint.interrupt.waitLabel")}
                    error={errorFor("interruptWait")}
                    onChange={(interruptWait) => {
                      setTouched((t) => ({ ...t, interruptWait: true }));
                      update({ interruptWait });
                    }}
                  />
                  <div className={styles.hint}>{t("dialog.breakpoint.interrupt.waitHint")}</div>
                </Field>
              )}
            </>
          )}

          {!nextRegKind && !copperKind && !spriteKind && !interruptKind && (
            <>
              <Field label={t("dialog.breakpoint.requiredLabel", { label: addressLabel })}>
                <TextInput
                  value={form.address}
                  width={WORD_FIELD}
                  ariaLabel={addressLabel}
                  error={errorFor("address")}
                  autoFocus={!focus}
                  onChange={(address) => {
                    setTouched((t) => ({ ...t, address: true }));
                    update({ address });
                  }}
                />
                <div className={styles.hint}>
                  {/*
                    * The bank-relative spelling is offered here rather than as controls of its
                    * own: it is what `bp-set` accepts, so there is one syntax to learn.
                    */}
                  {!ioKind && env.supportsBankRelative
                    ? t("dialog.breakpoint.addressHintBank")
                    : t("dialog.breakpoint.addressHint")}
                </div>
              </Field>

              {(form.kind === "memRead" || form.kind === "memWrite") && (
                <Field label={t("dialog.breakpoint.lengthLabel")}>
                  <div className={styles.inline}>
                    <TextInput
                      value={form.length}
                      width={BYTE_FIELD}
                      ariaLabel={t("dialog.breakpoint.lengthLabel")}
                      error={errorFor("length")}
                      onChange={(length) => {
                        setTouched((t) => ({ ...t, length: true }));
                        update({ length });
                      }}
                    />
                    <span className={styles.sideHint}>{t("dialog.breakpoint.lengthHint")}</span>
                  </div>
                </Field>
              )}

              {ioKind && (
                <Field label={t("dialog.breakpoint.portMaskLabel")}>
                  <div className={styles.inline}>
                    <TextInput
                      value={form.ioMask}
                      width={WORD_FIELD}
                      ariaLabel={t("dialog.breakpoint.portMaskLabel")}
                      error={errorFor("ioMask")}
                      onChange={(ioMask) => {
                        setTouched((t) => ({ ...t, ioMask: true }));
                        update({ ioMask });
                      }}
                    />
                    <span className={styles.sideHint}>{t("dialog.breakpoint.portMaskHint")}</span>
                  </div>
                </Field>
              )}

              {env.supportsPartitions && (
                <Field label={t("dialog.breakpoint.partitionLabel")}>
                  {/*
                    * Opt in, rather than a "(none)" entry in the picker: most breakpoints are not
                    * partition-bound, and the bank matrix has no room for a "none" cell. The
                    * picker sits on the checkbox's own line, so ticking it moves nothing below.
                    * Disabled rather than hidden for an I/O type or a bank-relative address, so
                    * switching type does not make the row jump away.
                    */}
                  <div className={styles.inline}>
                    <Checkbox
                      key={`partition-${partitionEnabled}`}
                      initialValue={form.partition !== undefined}
                      enabled={partitionEnabled}
                      label={t("dialog.breakpoint.partitionCheckbox")}
                      right={true}
                      onChange={(on) => {
                        setTouched((t) => ({ ...t, partition: true }));
                        update({ partition: on ? (initial?.partition ?? defaultPartition) : undefined });
                      }}
                    />
                    {form.partition !== undefined && (
                      <PartitionPicker
                        value={form.partition}
                        onChange={(partition) => {
                          setTouched((t) => ({ ...t, partition: true }));
                          update({ partition });
                        }}
                        displayBankMatrix={machineSetup.displayBankMatrix}
                        segmentOptions={machineSetup.segmentOptions}
                        partitionOptions={machineSetup.partitionOptions}
                      />
                    )}
                  </div>
                  {!partitionEnabled && (
                    <div className={styles.hint}>
                      {bankRelative && !ioKind
                        ? t("dialog.breakpoint.partitionHint.bankRelative")
                        : t("dialog.breakpoint.partitionHint.io")}
                    </div>
                  )}
                  {shows("partition") && errors.partition && (
                    <div className={styles.error} role="alert">
                      {errors.partition}
                    </div>
                  )}
                </Field>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );

  const conditionPage = (
    <>
      <section className={styles.group}>
        <h4 className={styles.groupTitle}>{t("dialog.breakpoint.conditionLabel")}</h4>
        {/*
          * Validated on every keystroke, by the same checker the emulator arms with. Errors show
          * once the field has been touched; warnings (an unknown label) show at once, because the
          * breakpoint is accepted and they explain why it may not stop yet.
          */}
        <TextInput
          value={form.condition}
          error={errorFor("condition")}
          autoFocus={focusCondition}
          ariaLabel={t("dialog.breakpoint.conditionLabel")}
          placeholder={t("dialog.breakpoint.conditionExample", {
            first: CONDITION_EXAMPLE_1,
            second: CONDITION_EXAMPLE_2
          })}
          onChange={(condition) => {
            setTouched((t) => ({ ...t, condition: true }));
            update({ condition });
          }}
        />
        {warnings.condition && !errorFor("condition") && (
          <div className={styles.warning} role="status">
            {warnings.condition}
          </div>
        )}
        <div className={styles.hint}>
          {t("dialog.breakpoint.conditionHint", {
            action: logging ? "log" : "stop",
            operands: copperKind
              ? "copper"
              : spriteKind
                ? "sprite"
                : nextRegKind || !(form.kind === "exec" || sourceMode)
                  ? "valAddr"
                  : "none"
          })}{" "}
          <button
            type="button"
            className={styles.link}
            onClick={() => void mainApi.showWebsite(CONDITION_SYNTAX_PAGE)}
          >
            {t("dialog.breakpoint.syntaxLink")}
          </button>
        </div>
      </section>

      <section className={styles.group}>
        <h4 className={styles.groupTitle}>{t("dialog.breakpoint.hitCountLabel")}</h4>
        <div className={styles.inline}>
          <Dropdown
            options={HIT_MODE_OPTIONS}
            initialValue={form.hitMode}
            ariaLabel={t("dialog.breakpoint.hitRuleAria")}
            width="14ch"
            onChanged={(hitMode) => {
              setTouched((t) => ({ ...t, hitCount: true }));
              update({ hitMode: hitMode as BreakpointFormState["hitMode"] });
            }}
          />
          {form.hitMode !== "always" && (
            <TextInput
              value={form.hitCount}
              width={BYTE_FIELD}
              ariaLabel={t("dialog.breakpoint.hitCountLabel")}
              autoFocus={focus === "hitCount"}
              error={errorFor("hitCount")}
              onChange={(hitCount) => {
                setTouched((t) => ({ ...t, hitCount: true }));
                update({ hitCount });
              }}
            />
          )}
        </div>
        <div className={styles.hint}>{t("dialog.breakpoint.hitCountHint")}</div>
      </section>
    </>
  );

  const actionPage = (
    <>
      <section className={styles.group}>
        <h4 className={styles.groupTitle}>{t("dialog.breakpoint.actionLabel")}</h4>
        <RadioGroup
          ariaLabel={t("dialog.breakpoint.actionAria")}
          options={ACTION_OPTIONS}
          value={form.action}
          columns={2}
          onChange={(action) => update({ action: action as BreakpointFormState["action"] })}
        />
        {/* A one-shot (G1.6): session-owned and never saved; a logpoint never stops, so never */}
        {!logging && (
          <div className={styles.below}>
            <Checkbox
              initialValue={form.oneShot}
              label={t("dialog.breakpoint.oneShot")}
              right={true}
              onChange={(oneShot) => update({ oneShot })}
            />
          </div>
        )}
        {/*
          * The one place a user meets the timing contract. The machine cannot stop mid-instruction,
          * so the breakpoint reports the write with both values rather than withholding it; saying
          * so stops the feature reading as a write-veto.
          */}
        {stopNote && <div className={styles.hint}>{stopNote}</div>}
      </section>

      {logging && (
        <section className={styles.group}>
          <h4 className={styles.groupTitle}>{t("dialog.breakpoint.messageLabel")}</h4>
          {/*
            * The template, validated on every keystroke by the compiler the emulator arms it with
            * (the Klive dialect): column-accurate errors once touched, label warnings at once.
            */}
          <TextInput
            value={form.logMessage}
            error={errorFor("logMessage")}
            autoFocus={focus === "logMessage"}
            ariaLabel={t("dialog.breakpoint.messageAria")}
            placeholder={t("dialog.breakpoint.example", { example: LOG_EXAMPLE })}
            onChange={(logMessage) => {
              setTouched((t) => ({ ...t, logMessage: true }));
              update({ logMessage });
            }}
          />
          {warnings.logMessage && !errorFor("logMessage") && (
            <div className={styles.warning} role="status">
              {warnings.logMessage}
            </div>
          )}
          <div className={styles.hint}>
            {t("dialog.breakpoint.messageHint", { expr: LOG_EXPR, exprHex: LOG_EXPR_HEX })}{" "}
            <button
              type="button"
              className={styles.link}
              onClick={() => void mainApi.showWebsite(LOGPOINT_SYNTAX_PAGE)}
            >
              {t("dialog.breakpoint.syntaxLink")}
            </button>
          </div>
        </section>
      )}
    </>
  );

  return (
    <DialogForm
      submitLabel={editing ? t("dialog.breakpoint.save") : t("dialog.breakpoint.add")}
      submitDisabled={submitted && !valid}
      onSubmit={submit}
      onCancel={controls.cancel}
      footerStart={
        <>
          {/* Enabled is the whole breakpoint's state, not any one page's */}
          <Checkbox
            initialValue={!form.disabled}
            label={t("dialog.breakpoint.enabled")}
            right={true}
            onChange={(enabled) => update({ disabled: !enabled })}
          />
          {/*
            * The duplicate-key rule belongs to no single field, so it renders beside the buttons.
            * `bp-set` would silently merge onto the existing breakpoint; here that would read as a
            * rename.
            */}
          {submitted && errors.form && (
            <div className={styles.error} role="alert">
              {errors.form}
            </div>
          )}
        </>
      }
    >
      {/*
        * The Settings dialog's frame: the pages on the left, the page on the right, one fixed
        * height for every type, page and machine, so switching never makes the dialog jump.
        */}
      <div className={styles.body} data-testid="breakpoint-dialog">
        <nav className={styles.nav}>
          <div className={styles.pages} role="tablist" aria-orientation="vertical" aria-label={t("dialog.breakpoint.pagesAria")}>
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`bp-page-${p.id}`}
                aria-selected={page === p.id}
                aria-controls="bp-page-panel"
                className={classnames(styles.pageButton, {
                  [styles.selected]: page === p.id,
                  [styles.pageError]: pageHasError(p.id)
                })}
                onClick={() => setPage(p.id)}
              >
                <span className={styles.pageName}>
                  {p.label}
                  {pageHasError(p.id) && (
                    <span className={styles.errorDot} role="img" aria-label={t("dialog.breakpoint.pageError")} />
                  )}
                </span>
                <span className={styles.pageSummary} title={p.summary}>
                  {p.summary}
                </span>
              </button>
            ))}
          </div>
          {editing && hits !== undefined && (
            <div className={styles.hitsBox}>
              <span>
                {t("dialog.breakpoint.hitsSoFar")}{" "}
                <span className={styles.hits} data-testid="breakpoint-hits">
                  {hits}
                </span>
              </span>
              {onResetHits && (
                <Button
                  text={t("dialog.breakpoint.resetHits")}
                  variant="secondary"
                  clicked={() => {
                    void onResetHits().then(() => setHits(0));
                  }}
                />
              )}
            </div>
          )}
        </nav>
        <div
          className={styles.page}
          role="tabpanel"
          id="bp-page-panel"
          aria-labelledby={`bp-page-${page}`}
        >
          {page === "trigger" ? triggerPage : page === "condition" ? conditionPage : actionPage}
        </div>
      </div>
    </DialogForm>
  );
};

/**
 * One labelled field of the Where group: the label in the group's shared first column, the control
 * and its hint in the second. Label beside field rather than over it, which is what lets every
 * type's fields fit the fixed page without scrolling.
 */
const Field = ({ label, children }: { label?: string; children: ReactNode }) => (
  <>
    <span className={styles.fieldLabel}>{label}</span>
    <div className={styles.fieldControl}>{children}</div>
  </>
);

/** `main.asm:42` (with the column of a statement breakpoint) and where it resolved to. */
export function sourceLocationText(bp: BreakpointInfo): string {
  const column = bp.column !== undefined ? `:${bp.column + 1}` : "";
  const place = `${bp.resource}:${bp.line}${column}`;
  return bp.resolvedAddress === undefined
    ? translate("dialog.breakpoint.location.unresolved", { place })
    : `${place} ($${bp.resolvedAddress.toString(16).toUpperCase().padStart(4, "0")})`;
}
