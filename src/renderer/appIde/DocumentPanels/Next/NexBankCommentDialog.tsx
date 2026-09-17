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
import { NEX_BANK_COMMENT_SOFT_LIMIT, normalizeMultilineComment } from "./nexAnnotations";
import { flattenBankComment } from "./nexAnnotationEdits";

export type NexBankCommentDialogResult = {
  comment?: string;
};

export type NexBankCommentDialogProps = DialogComponentProps<NexBankCommentDialogResult> & {
  bank: number;
  initialComment?: string;
};

export const BANK_COMMENT_DIALOG_TITLE = "Bank comment";
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
  const [comment, setComment] = useState(initialComment);
  const normalizedComment = useMemo(() => normalizeMultilineComment(comment), [comment]);
  const flattened = useMemo(() => flattenBankComment(normalizedComment), [normalizedComment]);
  const hasExistingComment = initialComment.length > 0;
  const overLimit = comment.length > NEX_BANK_COMMENT_SOFT_LIMIT;

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
      <DialogRow label="Location" rows={true}>
        <div className={styles.location}>
          <span className={styles.locationLabel}>Bank</span>
          <span>{`$${toHexa2(bank)} (${bank})`}</span>
        </div>
      </DialogRow>
      <DialogRow label="Comment" rows={true}>
        <textarea
          autoFocus
          aria-label="Bank comment"
          className={styles.comment}
          spellCheck={false}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={keyDown}
        />
        <div className={styles.hint}>
          <span>Enter starts a new line. Ctrl+Enter saves.</span>
          <span
            className={overLimit ? styles.countOver : styles.count}
            title={`Comments longer than ${NEX_BANK_COMMENT_SOFT_LIMIT} characters are reported when the file is loaded.`}
          >
            {`${comment.length} / ${NEX_BANK_COMMENT_SOFT_LIMIT}`}
          </span>
        </div>
      </DialogRow>
      <DialogRow label="Heading preview" rows={true}>
        <div className={styles.preview} aria-label="Heading preview">
          <span className={styles.previewBank}>{`Bank $${toHexa2(bank)}`}</span>
          <span className={styles.previewComment}>{flattened}</span>
        </div>
      </DialogRow>
      <DialogFooter>
        <Button text="Save" type="submit" />
        <Button variant="secondary" text="Cancel" clicked={controls.cancel} />
        {hasExistingComment && (
          <>
            <DialogFooterSpacer />
            <Button
              variant="secondary"
              text="Clear"
              clicked={() => controls.close({ comment: undefined })}
            />
          </>
        )}
      </DialogFooter>
    </form>
  );
}
