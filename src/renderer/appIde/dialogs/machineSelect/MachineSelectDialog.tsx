import { useCallback, useMemo, useReducer, useRef } from "react";

import { machineRegistry } from "@common/machines/machine-registry";
import type {
  MachineSelectDialogData,
  MachineSelectDialogResult
} from "@common/messaging/machine-select-dialog";
import { Modal } from "@renderer/controls/Modal";
import {
  createInitialState,
  reduce,
  saveResult,
  switchResult
} from "./MachineSelectModel";
import { buildCatalogue, selectViewModel } from "./MachineSelectViewModel";
import { MachineSelectView } from "./MachineSelectView";

export type { MachineSelectDialogResult };

type Props = {
  data?: MachineSelectDialogData;
  onResult: (result: MachineSelectDialogResult) => void;
  onClose: () => void;
};

/**
 * Machine › Machine type › Select machine… (`.plans/MACHINE_SELECT_DIALOG_PLAN.md`).
 *
 * Wiring only: the rules live in `MachineSelectModel` / `MachineSelectViewModel`, and the dialog has
 * no side effects - it returns the edited favourites and the model to switch to, and the main
 * process applies them. Opens in whichever window has the focus, so both dialog registries render it.
 */
export const MachineSelectDialog = ({ data, onResult, onClose }: Props) => {
  const catalogue = useMemo(() => buildCatalogue(machineRegistry), []);
  const [state, dispatch] = useReducer(reduce, undefined, () => createInitialState(data, machineRegistry));
  const vm = useMemo(() => selectViewModel(state, catalogue), [state, catalogue]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const save = useCallback(async () => {
    onResult(saveResult(stateRef.current));
    return false;
  }, [onResult]);

  const switchTo = useCallback(async () => {
    const result = switchResult(stateRef.current);
    if (!result) return true;
    onResult(result);
    return false;
  }, [onResult]);

  // --- Double-click / Enter on a model: select it, then switch to it
  const switchRequested = useCallback(
    (key: string) => {
      const next = reduce(stateRef.current, { type: "modelSelected", key });
      const result = switchResult(next);
      if (result) onResult(result);
      else dispatch({ type: "modelSelected", key });
    },
    [onResult]
  );

  return (
    <Modal
      title="Select Machine"
      iconName="vm"
      isOpen={true}
      width={880}
      onClose={onClose}
      primaryLabel={vm.switchLabel}
      primaryEnabled={vm.switchEnabled}
      onPrimaryClicked={switchTo}
      secondaryLabel="Save"
      secondaryVisible={true}
      secondaryEnabled={vm.saveEnabled}
      onSecondaryClicked={save}
      initialFocus="none"
    >
      <MachineSelectView
        vm={vm}
        filter={state.filter}
        dispatch={dispatch}
        onSwitchRequested={switchRequested}
      />
    </Modal>
  );
};
