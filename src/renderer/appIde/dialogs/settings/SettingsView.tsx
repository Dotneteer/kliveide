import classnames from "classnames";

import { Button } from "@renderer/controls/Button";
import { Checkbox } from "@renderer/controls/Checkbox";
import Dropdown from "@renderer/controls/Dropdown";
import { PanelFilter } from "@renderer/controls/data";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { ACCENTS, isAccentId, type Tone } from "@renderer/theming/tokens/palette";
import type { SettingsIntent } from "./SettingsController";
import type { SettingsRowVm, SettingsVm } from "./SettingsViewModel";

import styles from "./SettingsDialog.module.scss";

type Props = {
  vm: SettingsVm;
  tone: Tone;
  dispatch: (intent: SettingsIntent) => void;
};

/**
 * The Settings dialog's body: the pages on the left, the selected page (or every search hit) on the
 * right. Dumb: it renders the view model and turns gestures into intents.
 */
export const SettingsView = ({ vm, tone, dispatch }: Props) => (
  <div className={styles.body} data-testid="settings-dialog">
    <nav className={styles.nav} aria-label="Settings pages">
      <div className={styles.search}>
        <PanelFilter
          value={vm.query}
          placeholder="Search settings"
          label="Search settings"
          onChange={(query) => dispatch({ type: "queryChanged", query })}
        />
      </div>
      <div className={styles.pagesPane}>
        <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
          <ul className={styles.pages} role="tablist" aria-orientation="vertical">
            {vm.nav.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={page.selected}
                  data-testid={`settings-page-${page.id}`}
                  className={classnames(styles.pageButton, {
                    [styles.selected]: page.selected,
                    [styles.noMatch]: page.matches === 0
                  })}
                  onClick={() => dispatch({ type: "pageSelected", page: page.id })}
                >
                  <span>{page.title}</span>
                  {page.matches !== undefined && (
                    <span className={styles.count}>{page.matches}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </ScrollViewer>
      </div>
    </nav>
    <div className={styles.contentPane}>
      <ScrollViewer allowHorizontal={false}>
        <div className={styles.content} role="tabpanel">
          {vm.machineNote && <p className={styles.note}>{vm.machineNote}</p>}
          {vm.sections.map((section) => (
            <section key={section.pageId} className={styles.section}>
              {vm.searching && <h3 className={styles.pageTitle}>{section.title}</h3>}
              {section.groups.map((group) => (
                <div key={group.title} className={styles.group}>
                  <h4 className={styles.groupTitle}>{group.title}</h4>
                  {group.rows.map((row) => (
                    <SettingsRowView key={row.id} row={row} tone={tone} dispatch={dispatch} />
                  ))}
                </div>
              ))}
            </section>
          ))}
          {vm.emptyMessage && <p className={styles.empty}>{vm.emptyMessage}</p>}
          {vm.error && (
            <p className={styles.error} role="alert">
              {vm.error}
            </p>
          )}
        </div>
      </ScrollViewer>
    </div>
  </div>
);

const SettingsRowView = ({
  row,
  tone,
  dispatch
}: {
  row: SettingsRowVm;
  tone: Tone;
  dispatch: (intent: SettingsIntent) => void;
}) => {
  const text = (
    <>
      {row.description && <span className={styles.description}>{row.description}</span>}
      {row.replaces && <span className={styles.replaces}>{row.replaces}</span>}
    </>
  );

  if (row.editor === "switch") {
    return (
      <div className={styles.row} data-testid={`settings-row-${row.id}`}>
        <div className={styles.switchCell}>
          <Checkbox
            label={row.title}
            right={true}
            initialValue={row.checked}
            enabled={row.enabled}
            onChange={(value) => dispatch({ type: "valueChanged", rowId: row.id, value })}
          />
          <div className={styles.switchText}>{text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row} data-testid={`settings-row-${row.id}`}>
      <div className={styles.label}>
        <span className={styles.title}>{row.title}</span>
        {text}
      </div>
      <div className={styles.control}>
        {row.editor === "select" && (
          <Dropdown
            ariaLabel={row.title}
            options={row.options}
            initialValue={row.value}
            enabled={row.enabled}
            width="100%"
            testId={`settings-select-${row.id}`}
            onChanged={(value) => dispatch({ type: "valueChanged", rowId: row.id, value })}
          />
        )}
        {row.editor === "accent" && (
          <div className={styles.swatches} role="radiogroup" aria-label={row.title}>
            {row.options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === row.value}
                aria-label={option.label}
                title={option.label}
                disabled={!row.enabled}
                className={classnames(styles.swatch, {
                  [styles.swatchSelected]: option.value === row.value
                })}
                style={{
                  background: isAccentId(option.value)
                    ? ACCENTS[option.value].solid[tone]
                    : undefined
                }}
                onClick={() =>
                  dispatch({ type: "valueChanged", rowId: row.id, value: option.value })
                }
              />
            ))}
          </div>
        )}
        {row.editor === "file" && (
          <span className={styles.fileValue} title={row.displayValue}>
            {row.displayValue}
          </span>
        )}
        {row.buttons.length > 0 && (
          <div className={styles.buttons}>
            {row.buttons.map((button) => (
              <Button
                key={button.index}
                text={button.label}
                variant="secondary"
                disabled={!button.enabled}
                clicked={() =>
                  dispatch({ type: "buttonClicked", rowId: row.id, index: button.index })
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
