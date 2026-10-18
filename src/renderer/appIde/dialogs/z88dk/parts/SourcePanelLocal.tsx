import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { Button } from "@renderer/controls/Button";

import type { Z88dkIntent } from "../Z88dkIntents";
import type { Z88dkViewModel } from "../Z88dkViewModel";
import styles from "../Z88dkIntegrationDialog.module.scss";
import { Row } from "./Row";

type Props = {
  source: Z88dkViewModel["source"];
  dispatch: (intent: Z88dkIntent) => void;
};

export const SourcePanelLocal = ({ source, dispatch }: Props) => {
  const t = useT();
  return (
    <>
      <Row label={t("dialog.z88dk.row.folder")}>
        <Button
          text={t("dialog.z88dk.button.chooseFolder")}
          variant="secondary"
          disabled={source.disabled}
          clicked={() => dispatch({ type: "chooseFolderRequested" })}
        />
      </Row>
      {/* --- Installs found on this machine, each with its version; hidden when there are none */}
      {source.local.suggestions.length > 0 && (
        <Row label={t("dialog.z88dk.row.detected")}>
          <div className={styles.suggestions}>
            {source.local.suggestions.map((suggestion) => (
              <button
                key={suggestion.root}
                type="button"
                className={classnames(styles.suggestionButton, { [styles.muted]: !suggestion.supported })}
                disabled={source.disabled}
                title={suggestion.title}
                data-testid="z88dk-suggestion"
                onClick={() => dispatch({ type: "suggestionPicked", root: suggestion.root })}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </Row>
      )}
      <div className={styles.spacer} />
    </>
  );
};
