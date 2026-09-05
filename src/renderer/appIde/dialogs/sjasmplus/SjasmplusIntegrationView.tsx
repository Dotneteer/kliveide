import classnames from "classnames";

import type { SjasmplusIntent } from "./SjasmplusIntents";
import type { SjasmplusViewModel } from "./SjasmplusViewModel";
import { ApplyBlock } from "./parts/ApplyBlock";
import { Row } from "./parts/Row";
import { SourcePanelLocal } from "./parts/SourcePanelLocal";
import { SourcePanelOnline } from "./parts/SourcePanelOnline";
import { StatusBlock } from "./parts/StatusBlock";
import styles from "./SjasmplusIntegrationDialog.module.scss";

export type SjasmplusIntegrationViewProps = {
  vm: SjasmplusViewModel;
  dispatch: (intent: SjasmplusIntent) => void;
};

/**
 * The SJASMPLUS dialog body. It renders the view model and reports what the
 * user did; every decision behind those fields belongs to the model.
 */
export const SjasmplusIntegrationView = ({ vm, dispatch }: SjasmplusIntegrationViewProps) => (
  <div className={styles.body}>
    <StatusBlock status={vm.status} />

    <div className={styles.divider} />

    {/* --- Setup source and save scope: one row each */}
    <Row label="Source">
      <label className={styles.option}>
        <input
          type="radio"
          name="sjasmplus-setup-mode"
          checked={vm.source.mode === "local"}
          disabled={vm.source.disabled}
          onChange={() => dispatch({ type: "setupModeSelected", mode: "local" })}
        />
        Local executable
      </label>
      <label className={styles.option}>
        <input
          type="radio"
          name="sjasmplus-setup-mode"
          checked={vm.source.mode === "online"}
          disabled={vm.source.disabled}
          onChange={() => dispatch({ type: "setupModeSelected", mode: "online" })}
        />
        Online release
      </label>
    </Row>
    <Row label="Save to">
      <label className={styles.option}>
        <input
          type="radio"
          name="sjasmplus-scope"
          checked={vm.scopeChoice.value === "user"}
          disabled={vm.scopeChoice.disabled}
          onChange={() => dispatch({ type: "scopeSelected", scope: "user" })}
        />
        User settings
      </label>
      <label
        className={classnames(styles.option, {
          [styles.disabled]: !vm.scopeChoice.projectEnabled
        })}
      >
        <input
          type="radio"
          name="sjasmplus-scope"
          checked={vm.scopeChoice.value === "project"}
          disabled={!vm.scopeChoice.projectEnabled || vm.scopeChoice.disabled}
          onChange={() => dispatch({ type: "scopeSelected", scope: "project" })}
        />
        Project settings
      </label>
      {vm.scopeChoice.note && (
        <span className={classnames(styles.muted, styles.message)}>{vm.scopeChoice.note}</span>
      )}
    </Row>

    <div className={styles.divider} />

    {/* --- Only the controls of the selected source are shown. The panel has a
        --- fixed minimum height, so both sources render the same dialog height. */}
    <div className={styles.panel}>
      {vm.source.mode === "local" ? (
        <SourcePanelLocal source={vm.source} dispatch={dispatch} />
      ) : (
        <SourcePanelOnline
          online={vm.source.online}
          disabled={vm.source.disabled}
          dispatch={dispatch}
        />
      )}
    </div>

    <div className={styles.divider} />

    <ApplyBlock apply={vm.apply} />
  </div>
);
