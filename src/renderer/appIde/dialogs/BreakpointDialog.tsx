import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import type { BreakpointDialogResult } from "@renderer/appIde/utils/breakpoint-actions";
import type {
  BreakpointEnvironment,
  BreakpointFormState,
  BreakpointKind
} from "@renderer/appIde/utils/breakpoint-form";

import { useMemo, useState } from "react";
import { TextInput } from "@controls/TextInput";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";
import { DialogRow } from "@renderer/controls/DialogRow";
import { RadioGroup, type RadioGroupOption } from "@renderer/controls/RadioGroup";
import { PartitionPicker } from "@renderer/controls/PartitionPicker";
import type { MemoryMachineSetupState } from "@renderer/features/memory/useMemoryMachineSetup";
import {
  applyKindChange,
  breakpointToForm,
  createEmptyForm,
  formToBreakpointInfo,
  isBankRelativeInput,
  isFormValid,
  isNextRegKind,
  parseNumericInput,
  validateBreakpointForm
} from "@renderer/appIde/utils/breakpoint-form";
import { NEXT_REG_DESCRIPTORS } from "@emu/machines/zxNext/nextRegDescriptors";
import styles from "./BreakpointDialog.module.scss";

/**
 * Authors a binary (address-bound) breakpoint.
 *
 * Source-code breakpoints are not editable here — they belong to the editor's glyph margin, which
 * places them by clicking a line and tracks them as lines move. Callers must gate on
 * `isAuthorableBreakpoint` before opening this on an existing breakpoint.
 *
 * Every rule lives in `breakpoint-form.ts`, which has no React in it and is tested without mounting
 * anything. This component decides only what to *show*.
 */

const KIND_OPTIONS: RadioGroupOption[] = [
  { value: "exec", label: "Execution" },
  { value: "memRead", label: "Memory read" },
  { value: "memWrite", label: "Memory write" },
  { value: "ioRead", label: "I/O read" },
  { value: "ioWrite", label: "I/O write" }
];

/** The sixth option, offered only on a machine that has Next Registers. */
const NEXT_REG_OPTION: RadioGroupOption = { value: "nextRegWrite", label: "NextReg write" };

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
  const described = NEXT_REG_DESCRIPTORS.find((d) => d.id === parsed.value);
  return described ? `${hex} — ${described.description}` : `${hex} — undocumented register`;
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
};

export const BreakpointDialog = ({
  initial,
  env,
  machineSetup,
  controls
}: Props) => {
  const [form, setForm] = useState<BreakpointFormState>(() =>
    initial ? breakpointToForm(initial) : createEmptyForm()
  );
  /**
   * Errors are shown only for fields the user has left, plus everything once Save is pressed.
   * Validating a blank Add form on first paint would greet the user with "Enter an address."
   * before they had a chance to type one.
   */
  const [touched, setTouched] = useState<Partial<Record<keyof BreakpointFormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateBreakpointForm(form, env), [form, env]);
  const valid = isFormValid(errors);
  const editing = initial !== undefined;

  const shows = (field: keyof BreakpointFormState) => submitted || touched[field];
  const errorFor = (field: keyof BreakpointFormState) =>
    shows(field) ? errors[field] : undefined;

  const update = (over: Partial<BreakpointFormState>) => setForm((prev) => ({ ...prev, ...over }));

  const ioKind = isIoKind(form.kind);
  const nextRegKind = isNextRegKind(form.kind);
  // --- The sixth type is offered only where it means something. `validateBreakpointForm` refuses
  // --- it anyway, but a type a machine cannot have should not be on screen to choose.
  const kindOptions = useMemo(
    () => (env.supportsNextRegBreakpoints ? [...KIND_OPTIONS, NEXT_REG_OPTION] : KIND_OPTIONS),
    [env.supportsNextRegBreakpoints]
  );
  // --- A bank-relative address names its own bank, so the partition control has nothing left to
  // --- choose. Judged from what is *typed*, so the row responds as the user finishes the spelling.
  const bankRelative = isBankRelativeInput(form.address);
  // --- A partition is meaningless on an I/O breakpoint, and the command layer rejects the pair
  // --- outright. Disable rather than hide, so switching type does not make a row jump away.
  // --- Hidden entirely for a NextReg breakpoint rather than disabled with an explanation: a
  // --- register has no location, so there is no "why not" worth a sentence - unlike the I/O case,
  // --- where a user might reasonably expect a partition to apply.
  const partitionEnabled = env.supportsPartitions && !ioKind && !bankRelative && !nextRegKind;
  /*
   * What ticking the partition box selects first. The lowest index the machine actually has, which
   * is ROM 0 where there are ROMs and bank 0 otherwise — never a hardcoded 0, which is not a
   * partition at all on a machine whose indices start negative.
   */
  const defaultPartition = useMemo(() => {
    const indices = Object.keys(env.partitionLabels ?? {}).map(Number);
    return indices.length ? Math.min(...indices) : 0;
  }, [env.partitionLabels]);
  const addressLabel = ioKind ? "Port" : "Address";

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
      submitLabel={editing ? "Save" : "Add"}
      submitDisabled={submitted && !valid}
      onSubmit={submit}
      onCancel={controls.cancel}
    >
      <DialogRow rows={true} label="Type">
        <RadioGroup
          ariaLabel="Breakpoint type"
          options={kindOptions}
          value={form.kind}
          columns={2}
          onChange={(kind) => setForm((prev) => applyKindChange(prev, kind as BreakpointKind))}
        />
      </DialogRow>

      {env.supportsPartitions && !nextRegKind && (
        <DialogRow rows={true} label="Partition">
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
            label="Break only in a specific partition"
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
                ? "A bank-relative address already names its bank."
                : "An I/O breakpoint watches a port, not a partition."}
            </div>
          )}
          {shows("partition") && errors.partition && (
            <div className={styles.error} role="alert">
              {errors.partition}
            </div>
          )}
        </DialogRow>
      )}

      {nextRegKind && (
        <>
          <DialogRow rows={true} label="Register *">
            <TextInput
              value={form.nextReg}
              width={BYTE_FIELD}
              error={errorFor("nextReg")}
              autoFocus={true}
              onChange={(nextReg) => {
                setTouched((t) => ({ ...t, nextReg: true }));
                update({ nextReg });
              }}
            />
            <div className={styles.hint}>
              {describeNextReg(form.nextReg) ?? `Accepts ${"$07"}, 7 or %00000111.`}
            </div>
          </DialogRow>

          {/* Names the whole group - a toggle and, when it is on, two fields - rather than the
            * first field in it, which carries its own name. */}
          <DialogRow rows={true} label="Value filter">
            <Checkbox
              initialValue={form.filterValue}
              label="Break only on a specific value"
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
                    ariaLabel="Value"
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
                    ariaLabel="Mask"
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
                  The value, then an optional mask &mdash; written =$03/$0F in the breakpoint&apos;s
                  key. Leave the mask empty to compare every bit.
                </div>
              </>
            )}
          </DialogRow>

          <DialogRow>
            <Checkbox
              initialValue={form.nextRegCopper}
              label="Also break on copper writes"
              right={true}
              onChange={(nextRegCopper) => update({ nextRegCopper })}
            />
          </DialogRow>
        </>
      )}

      {!nextRegKind && (
      <DialogRow rows={true} label={`${addressLabel} *`}>
        <TextInput
          value={form.address}
          width={WORD_FIELD}
          error={errorFor("address")}
          autoFocus={true}
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
          {ioKind
            ? "Accepts $8000, 32768 or %1000000000000000."
            : env.supportsBankRelative
              ? "Accepts $8000, 32768 or %1000000000000000 — or 05:+$0100 for an offset inside a 16K bank, wherever that bank is paged."
              : "Accepts $8000, 32768 or %1000000000000000."}
        </div>
      </DialogRow>
      )}

      {ioKind && (
        <DialogRow rows={true} label="Port mask">
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
            Leave empty to match the port exactly.
          </div>
        </DialogRow>
      )}

      <DialogRow>
        <Checkbox
          initialValue={!form.disabled}
          label="Enabled"
          right={true}
          onChange={(enabled) => update({ disabled: !enabled })}
        />
      </DialogRow>

      {nextRegKind && (
        <DialogRow rows={true}>
          {/*
            * The one place a user meets this contract. The machine cannot stop mid-instruction, so
            * the breakpoint reports the write with both values rather than withholding it; saying
            * so here stops the feature reading as a write-veto.
            */}
          <div className={styles.hint}>
            Stops after the instruction that wrote the register, reporting its previous and new
            values.
          </div>
        </DialogRow>
      )}

      {initial?.hitCount !== undefined && (
        <DialogRow rows={true}>
          <div className={styles.hint}>Hit count: {initial.hitCount}</div>
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
