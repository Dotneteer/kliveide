import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";
import { Button } from "@renderer/controls/Button";

import type { DetectIntent } from "./DetectIntents";
import type { DetectOptionsState, DetectScopeChoice } from "./DetectModel";
import type { DetectViewModel } from "./DetectViewModel";
import styles from "./DetectDialog.module.scss";

export type DetectViewProps = {
  vm: DetectViewModel;
  dispatch: (intent: DetectIntent) => void;
};

const SCOPES: { value: DetectScopeChoice; label: string }[] = [
  { value: "paged", label: "Banks paged in" },
  { value: "all", label: "All banks with coverage" },
  { value: "rom", label: "The ROM (your ROM annotations)" }
];
const MODES = [
  { value: "fill", label: "Fill gaps" },
  { value: "replace", label: "Replace my regions" },
  { value: "clear", label: "Clear detected regions" }
];
const SKOOL_MODES = MODES.slice(0, 2);

/** The Detect dialog body: renders the view model and reports what the user did. */
export const DetectView = ({ vm, dispatch }: DetectViewProps) => {
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
      {vm.skool && <div className={styles.hint}>{`Importing ${vm.skool.fileName}: its instructions are checked against the machine's bytes.`}</div>}
      <div className={styles.options}>
        {!vm.skool && (
        <Dropdown
          ariaLabel="Which banks"
          options={SCOPES}
          initialValue={options.scope}
          width={240}
          enabled={!vm.busy}
          onChanged={(value) => change({ scope: value as DetectScopeChoice })}
        />
        )}
        <Dropdown
          ariaLabel="Mode"
          options={vm.skool ? SKOOL_MODES : MODES}
          initialValue={options.mode}
          width={190}
          enabled={!vm.busy}
          onChanged={(value) => change({ mode: value as DetectOptionsState["mode"] })}
        />
      </div>
      {!vm.skool && (
      <div className={styles.options}>
        <Checkbox label="Follow branches (reached)" initialValue={options.reach} enabled={!vm.busy} onChange={(reach) => change({ reach })} />
        <Checkbox label="Text" initialValue={options.text} enabled={!vm.busy} onChange={(text) => change({ text })} />
        <Checkbox label="Pointer tables" initialValue={options.words} enabled={!vm.busy} onChange={(words) => change({ words })} />
        <Checkbox label="Screen as skip" initialValue={options.screen} enabled={!vm.busy} onChange={(screen) => change({ screen })} />
        <Checkbox
          label="Unknown is data"
          initialValue={options.unknownAsData}
          enabled={!vm.busy}
          onChange={(unknownAsData) => change({ unknownAsData })}
        />
        <Button text="Detect" variant="secondary" disabled={!vm.buttons.detectEnabled} clicked={() => dispatch({ type: "detectRequested" })} />
      </div>
      )}
      {vm.skool && (
        <div className={styles.options}>
          <Button text="Read again" variant="secondary" disabled={!vm.buttons.detectEnabled} clicked={() => dispatch({ type: "detectRequested" })} />
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
          <Button text="Turn on coverage" variant="secondary" clicked={() => dispatch({ type: "coverageOnRequested" })} />
          <Button text="Load .kcov…" variant="secondary" clicked={() => dispatch({ type: "loadKcovRequested" })} />
        </div>
      )}
      {vm.rows.length > 0 && (
        <table className={styles.table} data-testid="detect-table">
          <thead>
            <tr>
              <th>Include</th>
              <th>Where</th>
              <th>Code</th>
              <th>Data</th>
              <th>Unknown</th>
              <th>Changes</th>
              <th>Conflicts</th>
              <th>Notes</th>
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
        <ul className={styles.details} aria-label="Import notes">
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
}) => (
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
            {`${row.expanded ? "Hide" : "Show"} ${row.warningCount}`}
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
                  title="Go to"
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
