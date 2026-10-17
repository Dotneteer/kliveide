import { useT } from "@common/i18n/useT";
import { Button } from "@renderer/controls/Button";

import type { SjasmplusIntent } from "../SjasmplusIntents";
import type { SjasmplusViewModel } from "../SjasmplusViewModel";
import styles from "../SjasmplusIntegrationDialog.module.scss";
import { Row } from "./Row";

type Props = {
  source: SjasmplusViewModel["source"];
  dispatch: (intent: SjasmplusIntent) => void;
};

export const SourcePanelLocal = ({ source, dispatch }: Props) => {
  const t = useT();
  return (
  <>
    <Row label={t("dialog.sjasmplus.row.executable")}>
      <Button
        text={t("dialog.sjasmplus.button.selectExecutable")}
        variant="secondary"
        disabled={source.disabled}
        clicked={() => dispatch({ type: "selectExecutableRequested" })}
      />
    </Row>
    {/* --- One-click shortcuts for binaries found on PATH. This is a convenience
        --- list, not a verdict on the user's own selection, so it stays hidden
        --- when PATH holds nothing. */}
    {source.local.suggestions.length > 0 && (
      <Row label={t("dialog.sjasmplus.row.onPath")}>
        <div className={styles.suggestions}>
          {source.local.suggestions.map((path) => (
            <button
              key={path}
              type="button"
              className={styles.suggestionButton}
              disabled={source.disabled}
              title={t("dialog.sjasmplus.local.useSuggestion", { path })}
              onClick={() => dispatch({ type: "suggestionPicked", executablePath: path })}
            >
              {path}
            </button>
          ))}
        </div>
      </Row>
    )}
    <div className={styles.spacer} />
  </>
  );
};
