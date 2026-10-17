import classnames from "classnames";

import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { IconButton } from "@renderer/controls/IconButton";
import { useT } from "@common/i18n/useT";

import type { Z88InsertCardIntent } from "./Z88InsertCardIntents";
import type { Z88InsertCardViewModel } from "./Z88InsertCardViewModel";
import styles from "./Z88InsertCardDialog.module.scss";

export type Z88InsertCardViewProps = {
  vm: Z88InsertCardViewModel;
  dispatch: (intent: Z88InsertCardIntent) => void;
};

/**
 * The Insert Card dialog body. Whether the file row appears, what it says and
 * whether it is a warning are all view-model fields; nothing is decided here.
 */
export const Z88InsertCardView = ({ vm, dispatch }: Z88InsertCardViewProps) => {
  const t = useT();
  return (
    <>
      <DialogRow label={t("dialog.z88.insertCard.cardTypeLabel")}>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder={t("dialog.z88.selectPlaceholder")}
            options={vm.cardType.options}
            initialValue={vm.cardType.value}
            width={406}
            onChanged={(cardTypeId) => dispatch({ type: "cardTypeSelected", cardTypeId })}
          />
        </div>
      </DialogRow>
      {vm.file.kind === "shown" && (
        <DialogRow label={t("dialog.z88.insertCard.fileLabel")}>
          <div className={styles.filenameRow}>
            <div
              data-testid="z88-card-file-browse"
              className={styles.fileButton}
              onClick={() => dispatch({ type: "selectCardFileRequested" })}
            >
              <IconButton
                iconName="file-code"
                buttonWidth={20}
                buttonHeight={20}
                title={t("dialog.z88.insertCard.selectFileTooltip")}
              />
            </div>
            <div
              data-testid="z88-card-file"
              className={classnames(styles.filename, {
                [styles.fileSelected]: vm.file.selected,
                [styles.warning]: vm.file.warning
              })}
              onClick={() => dispatch({ type: "selectCardFileRequested" })}
            >
              {vm.file.text}
            </div>
            {vm.file.clearable && (
              // --- The click lives on the wrapper rather than the IconButton so
              // --- the control is addressable: IconButton renders a div with no
              // --- role or accessible name of its own.
              <div
                data-testid="z88-card-file-clear"
                onClick={() => dispatch({ type: "clearCardFileRequested" })}
              >
                <IconButton
                  iconName="close"
                  buttonWidth={20}
                  buttonHeight={20}
                  title={t("dialog.z88.insertCard.usePristineTooltip")}
                />
              </div>
            )}
          </div>
        </DialogRow>
      )}
    </>
  );
};
