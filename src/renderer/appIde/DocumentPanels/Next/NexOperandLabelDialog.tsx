import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import type { DisassemblyOperandInfo } from "@renderer/appIde/disassemblers/common-types";
import {
  NEX_BANK_LAST_OFFSET,
  type NexAnnotationLabelScope,
  type NexOperandReference
} from "./nexAnnotations";
import {
  formatNexLabelValue,
  suggestNexLabelName,
  type NexLabelDialogLabel
} from "./NexLabelDialog";
import styles from "./NexOperandLabelDialog.module.scss";

export type NexOperandLabelDialogResult =
  | {
      action: "apply";
      operandIndex: number;
      scope: NexAnnotationLabelScope;
      name: string;
    }
  | {
      action: "clear";
      operandIndex: number;
    }
  | {
      action: "create-label";
      operandIndex: number;
      scope: NexAnnotationLabelScope;
      name: string;
      value: number;
    };

export type NexOperandLabelDialogProps =
  DialogComponentProps<NexOperandLabelDialogResult> & {
    bank: number;
    bankAddressOffset: number;
    instruction: string;
    operands: DisassemblyOperandInfo[];
    explicitReferences?: NexOperandReference[];
    labels: NexLabelDialogLabel[];
  };

type CandidateGroup = "exact" | "nearby" | "all";
type Candidate = NexLabelDialogLabel & {
  effectiveValue: number;
  group: CandidateGroup;
};

const NEARBY_DISTANCE = 0x20;

export function NexOperandLabelDialog({
  bank,
  bankAddressOffset,
  instruction,
  operands,
  explicitReferences = [],
  labels,
  controls
}: NexOperandLabelDialogProps) {
  const [selectedOperandIndex, setSelectedOperandIndex] = useState(
    chooseInitialOperandIndex(operands, explicitReferences)
  );
  const [searchText, setSearchText] = useState("");
  const selectedOperand = operands.find((operand) => operand.operandIndex === selectedOperandIndex)
    ?? operands[0];
  const localValue = selectedOperand
    ? selectedOperand.operandValue - bankAddressOffset
    : undefined;
  const canCreateLocal = isBankOffset(localValue);
  const explicitReference = explicitReferences.find(
    (reference) => reference.operandIndex === selectedOperand?.operandIndex
  );
  const candidates = useMemo(
    () => createCandidates(labels, selectedOperand?.operandValue ?? 0, bankAddressOffset),
    [bankAddressOffset, labels, selectedOperand?.operandValue]
  );
  const filteredGroups = useMemo(
    () => groupFilteredCandidates(candidates, searchText),
    [candidates, searchText]
  );
  const [selectedLabelKey, setSelectedLabelKey] = useState(
    chooseInitialLabelKey(candidates, selectedOperand?.operandValue ?? 0, localValue, explicitReference)
  );
  const selectedCandidate = candidates.find((candidate) => getLabelKey(candidate) === selectedLabelKey);

  useEffect(() => {
    setSelectedLabelKey(
      chooseInitialLabelKey(candidates, selectedOperand?.operandValue ?? 0, localValue, explicitReference)
    );
  }, [candidates, explicitReference, localValue, selectedOperand?.operandValue]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOperand || !selectedCandidate) {
      return;
    }
    controls.close({
      action: "apply",
      operandIndex: selectedOperand.operandIndex,
      scope: selectedCandidate.scope,
      name: selectedCandidate.name
    });
  };

  const createLabel = (scope: NexAnnotationLabelScope) => {
    if (!selectedOperand) {
      return;
    }
    const value = scope === "global" ? selectedOperand.operandValue : localValue;
    if (!isBankOffset(value) && scope === "local") {
      return;
    }
    controls.close({
      action: "create-label",
      operandIndex: selectedOperand.operandIndex,
      scope,
      name: suggestUniqueLabelName(labels, scope, value!),
      value: value!
    });
  };

  return (
    <form onSubmit={submit}>
      <DialogRow label="Instruction" rows={true}>
        <div className={styles.readOnlyValue}>{instruction}</div>
      </DialogRow>
      {operands.length > 1 && (
        <DialogRow label="Operand" rows={true}>
          <select
            className={styles.input}
            value={selectedOperandIndex}
            onChange={(event) => setSelectedOperandIndex(Number(event.target.value))}
          >
            {operands.map((operand) => (
              <option key={operand.operandIndex} value={operand.operandIndex}>
                {`Operand ${operand.operandIndex + 1}: ${operand.defaultText}`}
              </option>
            ))}
          </select>
        </DialogRow>
      )}
      {selectedOperand && (
        <DialogRow label="Operand value" rows={true}>
          <div className={styles.readOnlyValue}>
            {`${formatNexLabelValue(selectedOperand.operandValue)} (${selectedOperand.operandValue})`}
          </div>
        </DialogRow>
      )}
      <DialogRow label="Candidate labels" rows={true}>
        <input
          className={styles.input}
          placeholder="Search labels"
          spellCheck={false}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <div className={styles.candidateList}>
          {filteredGroups.map((group) => (
            <div key={group.group}>
              <div className={styles.groupHeader}>{getGroupTitle(group.group)}</div>
              {group.candidates.map((candidate) => (
                <button
                  className={styles.candidateItem}
                  data-selected={getLabelKey(candidate) === selectedLabelKey ? "true" : undefined}
                  key={getLabelKey(candidate)}
                  type="button"
                  onClick={() => setSelectedLabelKey(getLabelKey(candidate))}
                >
                  <span className={styles.labelName}>{candidate.name}</span>
                  <span>{candidate.scope === "global" ? "Global" : `Bank ${candidate.bank ?? bank}`}</span>
                  <span>{formatNexLabelValue(candidate.value)}</span>
                  <span>{formatNexLabelValue(candidate.effectiveValue)}</span>
                </button>
              ))}
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <div className={styles.emptyList}>No matching labels</div>
          )}
        </div>
      </DialogRow>
      <div className={styles.createActions}>
        <Button text="Create Global Label" clicked={() => createLabel("global")} />
        <Button
          text="Create Local Label"
          disabled={!canCreateLocal}
          clicked={() => createLabel("local")}
        />
      </div>
      <footer className={styles.footer}>
        <Button text="Apply Reference" type="submit" disabled={!selectedCandidate} />
        <Button text="Cancel" clicked={controls.cancel} />
        <div className={styles.footerSpacer} />
        <Button
          text="Clear Reference"
          disabled={!explicitReference}
          clicked={() => {
            if (!selectedOperand) {
              return;
            }
            controls.close({
              action: "clear",
              operandIndex: selectedOperand.operandIndex
            });
          }}
        />
      </footer>
    </form>
  );
}

export function createCandidates(
  labels: NexLabelDialogLabel[],
  operandValue: number,
  bankAddressOffset: number
): Candidate[] {
  const localValue = operandValue - bankAddressOffset;
  return labels.map((label) => {
    const effectiveValue = label.scope === "global"
      ? label.value
      : (bankAddressOffset + label.value) & 0xffff;
    return {
      ...label,
      effectiveValue,
      group: getCandidateGroup(label, operandValue, localValue, effectiveValue)
    };
  });
}

export function suggestUniqueLabelName(
  labels: NexLabelDialogLabel[],
  scope: NexAnnotationLabelScope,
  value: number
): string {
  const baseName = suggestNexLabelName(scope, value);
  let nextName = baseName;
  let index = 1;
  while (labels.some((label) => label.scope === scope && label.name === nextName)) {
    const suffix = `_${index}`;
    nextName = `${baseName.substring(0, Math.max(1, 16 - suffix.length))}${suffix}`;
    index++;
  }
  return nextName;
}

function groupFilteredCandidates(candidates: Candidate[], searchText: string) {
  const filteredCandidates = filterCandidates(candidates, searchText);
  return (["exact", "nearby", "all"] as CandidateGroup[])
    .map((group) => ({
      group,
      candidates: filteredCandidates.filter((candidate) => candidate.group === group)
    }))
    .filter((group) => group.candidates.length > 0);
}

function filterCandidates(candidates: Candidate[], searchText: string): Candidate[] {
  const normalizedSearch = searchText.trim().toLowerCase();
  if (!normalizedSearch) {
    return candidates;
  }
  return candidates.filter((candidate) => {
    const searchValues = [
      candidate.name,
      formatNexLabelValue(candidate.value),
      candidate.value.toString(10),
      formatNexLabelValue(candidate.effectiveValue),
      candidate.effectiveValue.toString(10),
      candidate.scope,
      candidate.scope === "local" ? `bank ${candidate.bank ?? ""}` : "global"
    ];
    return searchValues.some((value) => value.toLowerCase().includes(normalizedSearch));
  });
}

function getCandidateGroup(
  label: NexLabelDialogLabel,
  operandValue: number,
  localValue: number,
  effectiveValue: number
): CandidateGroup {
  if (label.scope === "global" && label.value === operandValue) {
    return "exact";
  }
  if (label.scope === "local" && isBankOffset(localValue) && label.value === localValue) {
    return "exact";
  }
  return Math.abs(effectiveValue - operandValue) <= NEARBY_DISTANCE ? "nearby" : "all";
}

function chooseInitialOperandIndex(
  operands: DisassemblyOperandInfo[],
  explicitReferences: NexOperandReference[]
): number {
  const explicitOperand = operands.find((operand) =>
    explicitReferences.some((reference) => reference.operandIndex === operand.operandIndex)
  );
  return explicitOperand?.operandIndex ?? operands[0]?.operandIndex ?? 0;
}

function chooseInitialLabelKey(
  candidates: Candidate[],
  operandValue: number,
  localValue: number | undefined,
  explicitReference?: NexOperandReference
): string | undefined {
  if (explicitReference) {
    const explicitCandidate = candidates.find((candidate) =>
      candidate.scope === explicitReference.scope && candidate.name === explicitReference.name
    );
    if (explicitCandidate) {
      return getLabelKey(explicitCandidate);
    }
  }

  const exactGlobal = candidates.find((candidate) =>
    candidate.scope === "global" && candidate.value === operandValue
  );
  if (exactGlobal) {
    return getLabelKey(exactGlobal);
  }

  const exactLocal = isBankOffset(localValue)
    ? candidates.find((candidate) => candidate.scope === "local" && candidate.value === localValue)
    : undefined;
  return exactLocal ? getLabelKey(exactLocal) : undefined;
}

function getLabelKey(label: Pick<NexLabelDialogLabel, "scope" | "bank" | "name">): string {
  return `${label.scope}:${label.bank ?? ""}:${label.name}`;
}

function getGroupTitle(group: CandidateGroup): string {
  switch (group) {
    case "exact":
      return "Exact matches";
    case "nearby":
      return "Nearby labels";
    default:
      return "All labels";
  }
}

function isBankOffset(value: number | undefined): value is number {
  return Number.isInteger(value) && value >= 0 && value <= NEX_BANK_LAST_OFFSET;
}
