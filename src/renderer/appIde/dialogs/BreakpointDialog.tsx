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
  isFormValid,
  validateBreakpointForm
} from "@renderer/appIde/utils/breakpoint-form";
import styles from "./BreakpointDialog.module.scss";

/**
 * Authors a binary (address-bound) breakpoint.
 *
 * Source-code breakpoints are not editable here — they belong to the editor's glyph margin, which
 * places them by clicking a line and tracks them as lines move. Callers must gate on
 * `isBinaryBreakpoint` before opening this on an existing breakpoint.
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

const isIoKind = (kind: BreakpointKind) => kind === "ioRead" || kind === "ioWrite";

type Props = DialogComponentProps<BreakpointDialogResult> & {
  /** The breakpoint being edited. Absent when adding. */
  initial?: BreakpointInfo;
  env: BreakpointEnvironment;
  /**
   * The same machine setup the Memory view uses, so the partition picker here is the very control
   * that view offers — a list on a machine with a handful of banks, a bank matrix on one with 247.
   */
  machineSetup: Pick<MemoryMachineSetupState, "displayBankMatrix" | "segmentOptions">;
  machineId?: string;
};

export const BreakpointDialog = ({
  initial,
  env,
  machineSetup,
  machineId,
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
  // --- A partition is meaningless on an I/O breakpoint, and the command layer rejects the pair
  // --- outright. Disable rather than hide, so switching type does not make a row jump away.
  const partitionEnabled = env.supportsPartitions && !ioKind;
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
          options={KIND_OPTIONS}
          value={form.kind}
          columns={2}
          onChange={(kind) => setForm((prev) => applyKindChange(prev, kind as BreakpointKind))}
        />
      </DialogRow>

      {env.supportsPartitions && (
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
              machineId={machineId}
              displayBankMatrix={machineSetup.displayBankMatrix}
              segmentOptions={machineSetup.segmentOptions}
            />
          )}
          {!partitionEnabled && (
            <div className={styles.hint}>An I/O breakpoint watches a port, not a partition.</div>
          )}
          {shows("partition") && errors.partition && (
            <div className={styles.error} role="alert">
              {errors.partition}
            </div>
          )}
        </DialogRow>
      )}

      <DialogRow rows={true} label={`${addressLabel} *`}>
        <TextInput
          value={form.address}
          error={errorFor("address")}
          autoFocus={true}
          onChange={(address) => {
            setTouched((t) => ({ ...t, address: true }));
            update({ address });
          }}
        />
        <div className={styles.hint}>
          Accepts $8000, 32768 or %1000000000000000.
        </div>
      </DialogRow>

      {ioKind && (
        <DialogRow rows={true} label="Port mask">
          <TextInput
            value={form.ioMask}
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
