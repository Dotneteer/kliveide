import classnames from "classnames";
import type { ReactNode } from "react";

import { useT } from "@common/i18n/useT";
import { Button } from "@renderer/controls/Button";
import { Checkbox } from "@renderer/controls/Checkbox";
import { TextInput } from "@renderer/controls/TextInput";

import type { BorielSetupIntent } from "./BorielSetupIntents";
import type { BorielSetupViewModel } from "./BorielSetupViewModel";
import styles from "./BorielSetupDialog.module.scss";

export type BorielSetupViewProps = {
  vm: BorielSetupViewModel;
  dispatch: (intent: BorielSetupIntent) => void;
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <div className={styles.value}>{children}</div>
  </div>
);

const STATUS_CLASS = {
  working: styles.working,
  outdated: styles.attention,
  broken: styles.failed,
  error: styles.failed
} as const;

/** The dialog body: renders the view model and reports what the user did. */
export const BorielSetupView = ({ vm, dispatch }: BorielSetupViewProps) => {
  const t = useT();
  return (
  <div className={styles.body}>
    {vm.intro && (
      <div className={styles.intro} data-testid="boriel-intro">
        {vm.intro}
      </div>
    )}

    <Row label={t("dialog.boriel.row.inUse")}>
      <div className={styles.stack}>
        <span
          className={classnames(STATUS_CLASS[vm.status.kind as keyof typeof STATUS_CLASS])}
          data-testid="boriel-status"
        >
          {vm.status.headline}
        </span>
        {vm.status.detail && (
          <span className={classnames(styles.muted, styles.ellipsis)} title={vm.status.detail} data-testid="boriel-status-detail">
            {vm.status.detail}
          </span>
        )}
      </div>
    </Row>
    <Row label={t("dialog.boriel.row.bundled")}>
      <span className={classnames({ [styles.muted]: !vm.kit.available })} data-testid="boriel-kit">
        {vm.kit.text}
      </span>
    </Row>

    <div className={styles.divider} />

    <Row label={t("dialog.boriel.row.folder")}>
      <div className={styles.grow}>
        <TextInput
          value={vm.folder.value}
          ariaLabel={t("dialog.boriel.folder.ariaLabel")}
          width="100%"
          onChange={(folder) => dispatch({ type: "folderEdited", folder })}
        />
      </div>
      <Button
        text={t("dialog.boriel.button.browse")}
        variant="secondary"
        disabled={!vm.folder.enabled}
        clicked={() => dispatch({ type: "browseFolderRequested" })}
      />
    </Row>
    <Row label="">
      <Button
        text={t("dialog.boriel.button.useExisting")}
        variant="secondary"
        disabled={!vm.useExisting.enabled}
        clicked={() => dispatch({ type: "useExistingRequested" })}
      />
    </Row>

    {vm.useBoriel.visible && (
      <Row label="">
        <div className={styles.stack}>
          <Checkbox
            label={t("dialog.boriel.useBoriel.label")}
            initialValue={vm.useBoriel.value}
            enabled={vm.useBoriel.enabled}
            onChange={(value) => dispatch({ type: "useBorielToggled", value })}
          />
          {vm.useBoriel.note && <span className={styles.muted}>{vm.useBoriel.note}</span>}
        </div>
      </Row>
    )}

    {vm.dontAskAgain.visible && (
      <Row label="">
        <Checkbox
          label={t("dialog.boriel.dontAskAgain")}
          initialValue={vm.dontAskAgain.value}
          enabled={vm.dontAskAgain.enabled}
          onChange={(value) => dispatch({ type: "dontAskAgainToggled", value })}
        />
      </Row>
    )}

    <div className={styles.divider} />

    <div
      className={classnames(styles.message, {
        [styles.working]: vm.message?.kind === "installed",
        [styles.failed]: vm.message?.kind === "failed",
        [styles.muted]: vm.message?.kind === "progress"
      })}
      role="status"
      data-testid="boriel-message"
    >
      {vm.message?.text}
    </div>
    <div className={styles.muted} data-testid="boriel-licence">
      {vm.licenceNote}
    </div>
  </div>
  );
};
