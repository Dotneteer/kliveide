import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { RadioGroup } from "@renderer/controls/RadioGroup";

import type { Z88dkIntent } from "./Z88dkIntents";
import type { Z88dkViewModel } from "./Z88dkViewModel";
import { ApplyBlock } from "./parts/ApplyBlock";
import { Row } from "./parts/Row";
import { SourcePanelLocal } from "./parts/SourcePanelLocal";
import { SourcePanelOnline } from "./parts/SourcePanelOnline";
import { StatusBlock } from "./parts/StatusBlock";
import styles from "./Z88dkIntegrationDialog.module.scss";

export type Z88dkIntegrationViewProps = {
  vm: Z88dkViewModel;
  dispatch: (intent: Z88dkIntent) => void;
};

/** The dialog body: it renders the view model and reports what the user did. */
export const Z88dkIntegrationView = ({ vm, dispatch }: Z88dkIntegrationViewProps) => {
  const t = useT();
  return (
    <div className={styles.body}>
      <StatusBlock status={vm.status} />

      <div className={styles.divider} />

      <Row label={t("dialog.z88dk.row.source")}>
        <RadioGroup
          ariaLabel={t("dialog.z88dk.source.ariaLabel")}
          columns={2}
          enabled={!vm.source.disabled}
          value={vm.source.mode}
          options={[
            { value: "local", label: t("dialog.z88dk.source.local") },
            { value: "online", label: t("dialog.z88dk.source.online") }
          ]}
          onChange={(mode) => dispatch({ type: "setupModeSelected", mode: mode as "local" | "online" })}
        />
      </Row>
      <Row label={t("dialog.z88dk.row.saveTo")}>
        <RadioGroup
          ariaLabel={t("dialog.z88dk.scope.ariaLabel")}
          columns={2}
          enabled={!vm.scopeChoice.disabled}
          value={vm.scopeChoice.value}
          options={[
            { value: "user", label: t("dialog.z88dk.scope.user") },
            { value: "project", label: t("dialog.z88dk.scope.project"), disabled: !vm.scopeChoice.projectEnabled }
          ]}
          onChange={(scope) => dispatch({ type: "scopeSelected", scope: scope as "user" | "project" })}
        />
        {vm.scopeChoice.note && <span className={classnames(styles.muted, styles.message)}>{vm.scopeChoice.note}</span>}
      </Row>

      <div className={styles.divider} />

      {/* --- Only the selected source's controls; the panel's fixed minimum height keeps both the same size */}
      <div className={styles.panel}>
        {vm.source.mode === "local" ? (
          <SourcePanelLocal source={vm.source} dispatch={dispatch} />
        ) : (
          <SourcePanelOnline online={vm.source.online} dispatch={dispatch} />
        )}
      </div>

      <div className={styles.divider} />

      <ApplyBlock apply={vm.apply} />
    </div>
  );
};
