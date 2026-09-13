import classnames from "classnames";

import type { SjasmplusIntent } from "./SjasmplusIntents";
import type { SjasmplusViewModel } from "./SjasmplusViewModel";
import { ApplyBlock } from "./parts/ApplyBlock";
import { Row } from "./parts/Row";
import { RadioGroup } from "@renderer/controls/RadioGroup";
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
    {/*
      * `RadioGroup`, not four hand-rolled `<input type="radio">`.
      *
      * The shared control is built on the same native radios, so nothing about the keyboard
      * contract changes — but the group is announced as a group, each option's label is actually
      * associated with its input, and the styling comes from the same place as every other radio
      * in the app. This dialog is the MVC pattern's reference implementation and was the one place
      * still hand-rolling its fields.
      */}
    <Row label="Source">
      <RadioGroup
        ariaLabel="SjasmPlus source"
        columns={2}
        enabled={!vm.source.disabled}
        value={vm.source.mode}
        options={[
          { value: "local", label: "Local executable" },
          { value: "online", label: "Online release" }
        ]}
        onChange={(mode) =>
          dispatch({ type: "setupModeSelected", mode: mode as "local" | "online" })
        }
      />
    </Row>
    <Row label="Save to">
      <RadioGroup
        ariaLabel="Save settings to"
        columns={2}
        enabled={!vm.scopeChoice.disabled}
        value={vm.scopeChoice.value}
        options={[
          { value: "user", label: "User settings" },
          // --- Per-option, not per-group: a project scope is unavailable with no project open,
          // --- while "User settings" stays selectable. `RadioGroup` supports exactly this.
          {
            value: "project",
            label: "Project settings",
            disabled: !vm.scopeChoice.projectEnabled
          }
        ]}
        onChange={(scope) =>
          dispatch({ type: "scopeSelected", scope: scope as "user" | "project" })
        }
      />
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
