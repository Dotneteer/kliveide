import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { useT } from "@common/i18n/useT";

import type { Z88ChangeRamIntent } from "./Z88ChangeRamIntents";
import type { Z88ChangeRamViewModel } from "./Z88ChangeRamViewModel";
import styles from "./Z88ChangeRamDialog.module.scss";

export type Z88ChangeRamViewProps = {
  vm: Z88ChangeRamViewModel;
  dispatch: (intent: Z88ChangeRamIntent) => void;
};

/**
 * The Change RAM dialog body. It renders the view model and reports what the
 * user did; whether a restart warning is earned is the model's decision.
 */
export const Z88ChangeRamView = ({ vm, dispatch }: Z88ChangeRamViewProps) => {
  const t = useT();
  return (
    <>
      <DialogRow label={t("dialog.z88.changeRam.sizeLabel")}>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder={t("dialog.z88.selectPlaceholder")}
            options={vm.ramSize.options}
            initialValue={vm.ramSize.value}
            width={268}
            onChanged={(size) => dispatch({ type: "ramSizeSelected", size })}
          />
        </div>
      </DialogRow>
      {vm.warning && (
        <DialogRow>
          <div className={styles.warning} data-testid="z88-ram-warning">
            {vm.warning}
          </div>
        </DialogRow>
      )}
    </>
  );
};
