import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import type { BreakpointDialogResult } from "@renderer/appIde/utils/breakpoint-actions";
import type {
  BreakpointEnvironment,
  BreakpointFormState,
  BreakpointKind
} from "@renderer/appIde/utils/breakpoint-form";

import { useEffect, useMemo, useState } from "react";
import { TextInput } from "@controls/TextInput";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
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
  isSpriteKind,
  isNextRegKind,
  parseNumericInput,
  validateBreakpointForm
} from "@renderer/appIde/utils/breakpoint-form";
// --- Register names: the union of every core's set (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D5)
import { nextRegUnion } from "@emu/machines/zxNext/nextRegSets";
import { SPRITE_ATTRIBUTE_LABELS } from "@common/zxnext/sprites/spriteBreakpoints";
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
 * (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2).
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

/** What the breakpoint does when its filters pass (`.plans/LOGPOINTS_PLAN.md` §4.5). */
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
  // --- The sixth to eighth types are offered only where they mean something.
  // --- `validateBreakpointForm` refuses them anyway, but a type a machine cannot have should not be
  // --- on screen to choose.
  const kindOptions = useMemo(
    () =>
      env.supportsNextRegBreakpoints
        ? [...KIND_OPTIONS, NEXT_REG_OPTION, COPPER_OPTION, SPRITE_OPTION]
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

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    controls.close({
      breakpoint: formToBreakpointInfo(form),
      replaces: initial
    });
  };

  return (
    <DialogForm
      submitLabel={editing ? t("dialog.breakpoint.save") : t("dialog.breakpoint.add")}
      submitDisabled={submitted && !valid}
      onSubmit={submit}
      onCancel={controls.cancel}
    >
      {sourceMode && (
        <DialogRow rows={true} label={t("dialog.breakpoint.locationLabel")}>
          <div className={styles.location}>{sourceLocationText(form.source!)}</div>
        </DialogRow>
      )}

      {!sourceMode && (
      <DialogRow rows={true} label={t("dialog.breakpoint.typeLabel")}>
        <RadioGroup
          ariaLabel={t("dialog.breakpoint.typeAria")}
          options={kindOptions}
          value={form.kind}
          columns={2}
          onChange={(kind) => setForm((prev) => applyKindChange(prev, kind as BreakpointKind))}
        />
      </DialogRow>
      )}

      {!sourceMode && env.supportsPartitions && !nextRegKind && !copperKind && !spriteKind && (
        <DialogRow rows={true} label={t("dialog.breakpoint.partitionLabel")}>
          {/*
            * Opt in, rather than a "(none)" entry in the picker.
            *
            * Most breakpoints are not partition-bound, and the bank matrix has no room for a
            * "none" cell among 247 banks without it reading as bank zero. A checkbox also states
            * the default plainly instead of hiding it behind an open menu.
            */}
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
        </DialogRow>
      )}

      {!sourceMode && nextRegKind && (
        <>
          <DialogRow rows={true} label={t("dialog.breakpoint.registerLabel")}>
            <TextInput
              value={form.nextReg}
              width={BYTE_FIELD}
              error={errorFor("nextReg")}
              autoFocus={!focus}
              onChange={(nextReg) => {
                setTouched((t) => ({ ...t, nextReg: true }));
                update({ nextReg });
              }}
            />
            <div className={styles.hint}>
              {describeNextReg(form.nextReg) ?? t("dialog.breakpoint.registerHint")}
            </div>
          </DialogRow>

          {/* Names the whole group - a toggle and, when it is on, two fields - rather than the
            * first field in it, which carries its own name. */}
          <DialogRow rows={true} label={t("dialog.breakpoint.valueFilterLabel")}>
            <Checkbox
              initialValue={form.filterValue}
              label={t("dialog.breakpoint.valueFilterCheckbox")}
              right={true}
              onChange={(on) => {
                setTouched((t) => ({ ...t, nextRegValue: true }));
                // --- Clearing on the way out, so an abandoned filter cannot survive invisibly and
                // --- fail validation against a field that is no longer on screen.
                update(on ? { filterValue: true } : { filterValue: false, nextRegValue: "", nextRegMask: "" });
              }}
            />
            {form.filterValue && (
              <>
                <div className={styles.filterFields}>
                  {/*
                    * Named for a screen reader, because neither field has a visible label of its
                    * own: the separator between them is what tells a sighted reader which is which,
                    * and a separator is not an accessible name.
                    */}
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
                </div>
                {/* No backticks: this is a plain text node, not Markdown, and they render as
                  * themselves. */}
                <div className={styles.hint}>
                  {t("dialog.breakpoint.valueFilterHint")}
                </div>
              </>
            )}
          </DialogRow>

          <DialogRow>
            <Checkbox
              initialValue={form.nextRegCopper}
              label={t("dialog.breakpoint.nextRegCopper")}
              right={true}
              onChange={(nextRegCopper) => update({ nextRegCopper })}
            />
          </DialogRow>
        </>
      )}

      {!sourceMode && copperKind && (
        <DialogRow rows={true} label={t("dialog.breakpoint.copperIndexLabel")}>
          <TextInput
            value={form.copperIndex}
            width={BYTE_FIELD}
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
        </DialogRow>
      )}

      {!sourceMode && spriteKind && (
        <>
          <DialogRow rows={true} label={t("dialog.breakpoint.spriteLabel")}>
            <TextInput
              value={form.spriteIndex}
              width={BYTE_FIELD}
              error={errorFor("spriteIndex")}
              autoFocus={!focus}
              onChange={(spriteIndex) => {
                setTouched((t) => ({ ...t, spriteIndex: true }));
                update({ spriteIndex });
              }}
            />
            <div className={styles.hint}>{t("dialog.breakpoint.spriteHint")}</div>
          </DialogRow>
          <DialogRow rows={true} label={t("dialog.breakpoint.attrBytesLabel")}>
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
          </DialogRow>
        </>
      )}

      {!sourceMode && !nextRegKind && !copperKind && !spriteKind && (
      <DialogRow rows={true} label={t("dialog.breakpoint.requiredLabel", { label: addressLabel })}>
        <TextInput
          value={form.address}
          width={WORD_FIELD}
          error={errorFor("address")}
          autoFocus={!focus}
          onChange={(address) => {
            setTouched((t) => ({ ...t, address: true }));
            update({ address });
          }}
        />
        <div className={styles.hint}>
          {/*
            * The bank-relative spelling is offered here rather than as controls of its own: it is
            * what `bp-set` accepts, so there is one syntax to learn, and the Type selector above is
            * then all a bank *watchpoint* needs. See `breakpoint-form.ts`.
            */}
          {!ioKind && env.supportsBankRelative
            ? t("dialog.breakpoint.addressHintBank")
            : t("dialog.breakpoint.addressHint")}
        </div>
      </DialogRow>
      )}

      {!sourceMode && (form.kind === "memRead" || form.kind === "memWrite") && (
        <DialogRow rows={true} label={t("dialog.breakpoint.lengthLabel")}>
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
          <div className={styles.hint}>
            {t("dialog.breakpoint.lengthHint")}
          </div>
        </DialogRow>
      )}

      {!sourceMode && ioKind && (
        <DialogRow rows={true} label={t("dialog.breakpoint.portMaskLabel")}>
          <TextInput
            value={form.ioMask}
            width={WORD_FIELD}
            error={errorFor("ioMask")}
            onChange={(ioMask) => {
              setTouched((t) => ({ ...t, ioMask: true }));
              update({ ioMask });
            }}
          />
          <div className={styles.hint}>
            {t("dialog.breakpoint.portMaskHint")}
          </div>
        </DialogRow>
      )}

      <DialogRow rows={true} label={t("dialog.breakpoint.actionLabel")}>
        <RadioGroup
          ariaLabel={t("dialog.breakpoint.actionAria")}
          options={ACTION_OPTIONS}
          value={form.action}
          columns={2}
          onChange={(action) => update({ action: action as BreakpointFormState["action"] })}
        />
      </DialogRow>

      {logging && (
        <DialogRow rows={true} label={t("dialog.breakpoint.messageLabel")}>
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
        </DialogRow>
      )}

      <DialogRow rows={true} label={t("dialog.breakpoint.conditionLabel")}>
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
      </DialogRow>

      <DialogRow rows={true} label={t("dialog.breakpoint.hitCountLabel")}>
        <div className={styles.hitFields}>
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
        <div className={styles.hint}>
          {t("dialog.breakpoint.hitCountHint")}
        </div>
      </DialogRow>

      {editing && hits !== undefined && (
        <DialogRow rows={true} label={t("dialog.breakpoint.hitsSoFar")}>
          <div className={styles.hitsRow}>
            <span className={styles.hits} data-testid="breakpoint-hits">
              {hits}
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
        </DialogRow>
      )}

      <DialogRow>
        <Checkbox
          initialValue={!form.disabled}
          label={t("dialog.breakpoint.enabled")}
          right={true}
          onChange={(enabled) => update({ disabled: !enabled })}
        />
        {/* A one-shot (G1.6): session-owned and never saved; a logpoint never stops, so never */}
        {!logging && (
          <Checkbox
            initialValue={form.oneShot}
            label={t("dialog.breakpoint.oneShot")}
            right={true}
            onChange={(oneShot) => update({ oneShot })}
          />
        )}
      </DialogRow>

      {!sourceMode && nextRegKind && (
        <DialogRow rows={true}>
          {/*
            * The one place a user meets this contract. The machine cannot stop mid-instruction, so
            * the breakpoint reports the write with both values rather than withholding it; saying
            * so here stops the feature reading as a write-veto.
            */}
          <div className={styles.hint}>
            {t("dialog.breakpoint.nextRegStopNote")}
          </div>
        </DialogRow>
      )}

      {!sourceMode && copperKind && (
        <DialogRow rows={true}>
          <div className={styles.hint}>
            {t("dialog.breakpoint.copperStopNote")}
          </div>
        </DialogRow>
      )}

      {!sourceMode && spriteKind && (
        <DialogRow rows={true}>
          <div className={styles.hint}>
            {t("dialog.breakpoint.spriteStopNote")}
          </div>
        </DialogRow>
      )}

      {/*
        * The duplicate-key rule belongs to no single field, so it renders on its own. `bp-set`
        * would silently merge onto the existing breakpoint; here that would read as a rename.
        */}
      {submitted && errors.form && (
        <DialogRow rows={true}>
          <div className={styles.error} role="alert">
            {errors.form}
          </div>
        </DialogRow>
      )}
    </DialogForm>
  );
};

/** `main.asm:42` (with the column of a statement breakpoint) and where it resolved to. */
export function sourceLocationText(bp: BreakpointInfo): string {
  const column = bp.column !== undefined ? `:${bp.column + 1}` : "";
  const place = `${bp.resource}:${bp.line}${column}`;
  return bp.resolvedAddress === undefined
    ? translate("dialog.breakpoint.location.unresolved", { place })
    : `${place} ($${bp.resolvedAddress.toString(16).toUpperCase().padStart(4, "0")})`;
}
