import { withLabels } from "@common/i18n/labels";
import { useT } from "@common/i18n/useT";
import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";
import { Button } from "@renderer/controls/Button";

import type { MessageKey } from "@common/i18n/keys.generated";

import type { DetectIntent } from "./DetectIntents";
import type { DetectOptionsState, DetectScopeChoice } from "./DetectModel";
import type { DetectViewModel } from "./DetectViewModel";
import styles from "./DetectDialog.module.scss";

export type DetectViewProps = {
  vm: DetectViewModel;
  dispatch: (intent: DetectIntent) => void;
};

const SCOPES = withLabels<{ value: DetectScopeChoice; labelKey: MessageKey }>([
  { value: "paged", labelKey: "dialog.detect.scope.paged" },
  { value: "all", labelKey: "dialog.detect.scope.all" },
  { value: "rom", labelKey: "dialog.detect.scope.rom" }
]);
const MODES = withLabels<{ value: string; labelKey: MessageKey }>([
  { value: "fill", labelKey: "dialog.detect.mode.fill" },
  { value: "replace", labelKey: "dialog.detect.mode.replace" },
  { value: "clear", labelKey: "dialog.detect.mode.clear" }
]);
const SKOOL_MODES = MODES.slice(0, 2);

/** The Detect dialog body: renders the view model and reports what the user did. */
export const DetectView = ({ vm, dispatch }: DetectViewProps) => {
  const t = useT();
  const { options } = vm;
  const change = (patch: Partial<DetectOptionsState>) => dispatch({ type: "optionsChanged", patch });
  if (vm.unavailable) {
    return (
      <div className={styles.body}>
        <div className={styles.problem} role="alert">
          {vm.unavailable}
        </div>
      </div>
    );
  }
  return (
    <div className={styles.body}>
      {vm.skool && <div className={styles.hint}>{t("dialog.detect.skool.hint", { fileName: vm.skool.fileName })}</div>}
      <div className={styles.options}>
        {!vm.skool && (
        <Dropdown
          ariaLabel={t("dialog.detect.scope.ariaLabel")}
          options={SCOPES}
          initialValue={options.scope}
          width={240}
          enabled={!vm.busy}
          onChanged={(value) => change({ scope: value as DetectScopeChoice })}
        />
        )}
        <Dropdown
          ariaLabel={t("dialog.detect.mode.ariaLabel")}
          options={vm.skool ? SKOOL_MODES : MODES}
          initialValue={options.mode}
          width={190}
          enabled={!vm.busy}
          onChanged={(value) => change({ mode: value as DetectOptionsState["mode"] })}
        />
      </div>
      {!vm.skool && (
      <div className={styles.options}>
        <Checkbox label={t("dialog.detect.option.reach")} initialValue={options.reach} enabled={!vm.busy} onChange={(reach) => change({ reach })} />
        <Checkbox label={t("dialog.detect.option.text")} initialValue={options.text} enabled={!vm.busy} onChange={(text) => change({ text })} />
        <Checkbox label={t("dialog.detect.option.words")} initialValue={options.words} enabled={!vm.busy} onChange={(words) => change({ words })} />
        <Checkbox label={t("dialog.detect.option.screen")} initialValue={options.screen} enabled={!vm.busy} onChange={(screen) => change({ screen })} />
        <Checkbox
          label={t("dialog.detect.option.unknownAsData")}
          initialValue={options.unknownAsData}
          enabled={!vm.busy}
          onChange={(unknownAsData) => change({ unknownAsData })}
        />
        <Button text={t("dialog.detect.button.detect")} variant="secondary" disabled={!vm.buttons.detectEnabled} clicked={() => dispatch({ type: "detectRequested" })} />
      </div>
      )}
      {vm.skool && (
        <div className={styles.options}>
          <Button text={t("dialog.detect.button.readAgain")} variant="secondary" disabled={!vm.buttons.detectEnabled} clicked={() => dispatch({ type: "detectRequested" })} />
        </div>
      )}
      {vm.notPausedHint && <div className={styles.hint}>{vm.notPausedHint}</div>}
      {vm.busyLabel && <div className={styles.hint}>{vm.busyLabel}</div>}
      {vm.problem && (
        <div className={styles.problem} role="alert">
          {vm.problem}
        </div>
      )}
      {vm.showCoverageHelp && (
        <div className={styles.options}>
          <Button text={t("dialog.detect.button.coverageOn")} variant="secondary" clicked={() => dispatch({ type: "coverageOnRequested" })} />
          <Button text={t("dialog.detect.button.loadKcov")} variant="secondary" clicked={() => dispatch({ type: "loadKcovRequested" })} />
        </div>
      )}
      {vm.rows.length > 0 && (
        <table className={styles.table} data-testid="detect-table">
          <thead>
            <tr>
              <th>{t("dialog.detect.column.include")}</th>
              <th>{t("dialog.detect.column.where")}</th>
              <th>{t("dialog.detect.column.code")}</th>
              <th>{t("dialog.detect.column.data")}</th>
              <th>{t("dialog.detect.column.unknown")}</th>
              <th>{t("dialog.detect.column.changes")}</th>
              <th>{t("dialog.detect.column.conflicts")}</th>
              <th>{t("dialog.detect.column.notes")}</th>
            </tr>
          </thead>
          <tbody>
            {vm.rows.map((row) => (
              <DetectTableRow key={row.index} row={row} dispatch={dispatch} />
            ))}
          </tbody>
        </table>
      )}
      {vm.notes.length > 0 && (
        <ul className={styles.details} aria-label={t("dialog.detect.importNotes")}>
          {vm.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
      {vm.replaceWarning && <div className={styles.warning}>{vm.replaceWarning}</div>}
      {vm.message && <div className={styles.message}>{vm.message}</div>}
      {vm.error && (
        <div className={styles.problem} role="alert">
          {vm.error}
        </div>
      )}
    </div>
  );
};

const DetectTableRow = ({
  row,
  dispatch
}: {
  row: DetectViewModel["rows"][number];
  dispatch: (intent: DetectIntent) => void;
}) => {
  const t = useT();
  return (
  <>
    <tr>
      <td>
        <Checkbox
          initialValue={row.include}
          enabled={row.includeEnabled}
          onChange={() => dispatch({ type: "includeToggled", index: row.index })}
        />
      </td>
      <td>{row.name}</td>
      <td>{row.code}</td>
      <td>{row.data}</td>
      <td>{row.unknown}</td>
      <td>{row.changes}</td>
      <td>{row.conflicts}</td>
      <td>
        {row.warningCount > 0 ? (
          <button type="button" className={styles.linkButton} onClick={() => dispatch({ type: "detailsToggled", index: row.index })}>
            {row.expanded
              ? t("dialog.detect.notes.hide", { count: row.warningCount })
              : t("dialog.detect.notes.show", { count: row.warningCount })}
          </button>
        ) : (
          "—"
        )}
      </td>
    </tr>
    {row.expanded && (
      <tr>
        <td colSpan={8}>
          <ul className={styles.details}>
            {row.details.map((detail, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.linkButton}
                  title={t("dialog.detect.notes.goTo")}
                  onClick={() => dispatch({ type: "goToRequested", index: row.index, offset: detail.offset })}
                >
                  {detail.text}
                </button>
              </li>
            ))}
          </ul>
        </td>
      </tr>
    )}
  </>
  );
};
