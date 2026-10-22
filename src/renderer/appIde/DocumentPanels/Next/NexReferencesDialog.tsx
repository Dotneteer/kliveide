import classnames from "classnames";
import { InstructionText, disassemblyText } from "@renderer/controls/data/DisassemblyText";
import { Button } from "@renderer/controls/Button";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { DialogFooter } from "@renderer/controls/overlay/DialogFooter";
import type { DefinitionLabel } from "@renderer/appIde/annotations/goToDefinition";
import type { LabelReference } from "@renderer/appIde/annotations/labelReferences";
import { useT } from "@common/i18n/useT";
import { formatNexLabelValue } from "./NexLabelDialog";
import { renderMarkup } from "./NexLabelsDialog";
import styles from "./NexReferencesDialog.module.scss";

export type NexReferencesDialogProps = DialogComponentProps<LabelReference> & {
  label: DefinitionLabel;
  references: LabelReference[];
};

/**
 * "Go to References": the rows of the listing that name a label.
 *
 * Read-only, so going to a row is the only thing that ends it with a result — it scrolls the
 * listing underneath, and a list left open would cover the row it moved to (as in the Labels list).
 * A row goes there from its Go To button or a double-click.
 */
export function NexReferencesDialog({ label, references, controls }: NexReferencesDialogProps) {
  const t = useT();
  return (
    <div>
      <p className={styles.intro}>
        {renderMarkup(t("panels.next.references.intro", { count: references.length, name: label.name }))}
      </p>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{t("panels.next.labels.column.address")}</span>
          <span>{t("panels.next.references.column.instruction")}</span>
          <span>{t("panels.next.references.column.within")}</span>
          <span />
        </div>
        {references.map((reference) => (
          <div
            className={styles.referenceRow}
            key={reference.rowIndex}
            onDoubleClick={() => controls.close(reference)}
          >
            <span className={disassemblyText.address}>{formatNexLabelValue(reference.address)}</span>
            <span className={styles.instruction} title={reference.instruction}>
              <InstructionText text={reference.instruction} />
            </span>
            <span className={classnames(styles.within, disassemblyText.label)} title={reference.within}>
              {reference.within ?? ""}
            </span>
            <span className={styles.actions}>
              <button
                className={styles.actionButton}
                type="button"
                autoFocus={reference === references[0]}
                onClick={() => controls.close(reference)}
              >
                {t("panels.next.action.goTo")}
              </button>
            </span>
          </div>
        ))}
        {references.length === 0 && (
          <div className={styles.emptyList}>{t("panels.next.references.empty")}</div>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" text={t("common.button.close")} clicked={controls.cancel} />
      </DialogFooter>
    </div>
  );
}
