import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";
import styles from "./NexBankCommentDialog.module.scss";
import { BANK_COMMENT_SOFT_LIMIT, normalizeMultilineComment } from "@renderer/appIde/annotations/programAnnotations";
import { flattenBankComment } from "@renderer/appIde/annotations/annotationEdits";
import { useT } from "@common/i18n/useT";

export type NexBankCommentDialogResult = {
  comment?: string;
};

export type NexBankCommentDialogProps = DialogComponentProps<NexBankCommentDialogResult> & {
  bank: number;
  initialComment?: string;
};

export const BANK_COMMENT_DIALOG_WIDTH = 560;

/**
 * Write the comment for a whole bank.
 *
 * The synopsis dialog's shape, with one difference in the preview: a synopsis is shown as the lines
 * it will become in the listing, while a bank comment is mostly *read* as one line in the NEX
 * viewer's heading. So the preview is that line — flattened, and cut with the same ellipsis — which
 * shows where the heading will stop before anyone has to go and look.
 *
 * Enter is a new line, since a comment may have several; `Ctrl+Enter` (`Cmd+Enter` on macOS) saves.
 */
export function NexBankCommentDialog({
  bank,
  initialComment = "",
  controls
}: NexBankCommentDialogProps) {
  const t = useT();
  const [comment, setComment] = useState(initialComment);
  const normalizedComment = useMemo(() => normalizeMultilineComment(comment), [comment]);
  const flattened = useMemo(() => flattenBankComment(normalizedComment), [normalizedComment]);
  const hasExistingComment = initialComment.length > 0;
  const overLimit = comment.length > BANK_COMMENT_SOFT_LIMIT;

  const save = () => controls.close({ comment: normalizedComment });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save();
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <form onSubmit={submit}>
      <DialogRow label={t("panels.next.field.location")} rows={true}>
        <div className={styles.location}>
          <span className={styles.locationLabel}>{t("panels.next.field.bank")}</span>
          <span>{`$${toHexa2(bank)} (${bank})`}</span>
        </div>
      </DialogRow>
      <DialogRow label={t("panels.next.field.comment")} rows={true}>
        <textarea
          autoFocus
          aria-label={t("panels.next.bankComment.title")}
          className={styles.comment}
          spellCheck={false}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={keyDown}
        />
        <div className={styles.hint}>
          <span>{t("panels.next.bankComment.hint")}</span>
          <span
            className={overLimit ? styles.countOver : styles.count}
            title={t("panels.next.bankComment.limitTitle", { limit: BANK_COMMENT_SOFT_LIMIT })}
          >
            {`${comment.length} / ${BANK_COMMENT_SOFT_LIMIT}`}
          </span>
        </div>
      </DialogRow>
      <DialogRow label={t("panels.next.bankComment.headingPreview")} rows={true}>
        <div className={styles.preview} aria-label={t("panels.next.bankComment.headingPreview")}>
          <span className={styles.previewBank}>{t("panels.next.bankComment.previewBank", { bank: toHexa2(bank) })}</span>
          <span className={styles.previewComment}>{flattened}</span>
        </div>
      </DialogRow>
      <DialogFooter>
        <Button text={t("panels.next.button.save")} type="submit" />
        <Button variant="secondary" text={t("common.button.cancel")} clicked={controls.cancel} />
        {hasExistingComment && (
          <>
            <DialogFooterSpacer />
            <Button
              variant="secondary"
              text={t("panels.next.button.clear")}
              clicked={() => controls.close({ comment: undefined })}
            />
          </>
        )}
      </DialogFooter>
    </form>
  );
}
