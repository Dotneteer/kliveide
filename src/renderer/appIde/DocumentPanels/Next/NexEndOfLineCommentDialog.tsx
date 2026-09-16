import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { TextInput } from "@renderer/controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import styles from "./NexEndOfLineCommentDialog.module.scss";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

export type NexEndOfLineCommentDialogResult = {
  comment?: string;
};

export type NexEndOfLineCommentDialogProps =
  DialogComponentProps<NexEndOfLineCommentDialogResult> & {
    bank: number;
    bankOffset: number;
    effectiveAddress: number;
    instruction: string;
    generatedHardComment?: string;
    initialComment?: string;
  };

export function NexEndOfLineCommentDialog({
  bank,
  bankOffset,
  effectiveAddress,
  instruction,
  generatedHardComment,
  initialComment = "",
  controls
}: NexEndOfLineCommentDialogProps) {
  const [comment, setComment] = useState(initialComment);
  const normalizedComment = useMemo(() => normalizeEndOfLineComment(comment), [comment]);
  const preview = useMemo(
    () => formatEndOfLinePreview(generatedHardComment, comment),
    [comment, generatedHardComment]
  );
  const hasExistingComment = initialComment.length > 0;

  const closeWithComment = (nextComment?: string) => {
    controls.close({ comment: nextComment });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    closeWithComment(normalizedComment);
  };

  return (
    <form onSubmit={submit}>
      <DialogRow label="Location" rows={true}>
        <div className={styles.location}>
          <span className={styles.locationLabel}>Bank</span>
          <span>{bank}</span>
          <span className={styles.locationLabel}>Bank offset</span>
          <span>{`$${toHexa4(bankOffset)} (${bankOffset})`}</span>
          <span className={styles.locationLabel}>Address</span>
          <span>{`$${toHexa4(effectiveAddress)} (${effectiveAddress})`}</span>
        </div>
      </DialogRow>
      <DialogRow label="Instruction" rows={true}>
        <div className={styles.readOnlyValue}>{instruction}</div>
      </DialogRow>
      {/* --- Kept on show while you type: a user comment replaces this one in the listing, so this
          --- row is what says which note is being given up. */}
      {generatedHardComment && (
        <DialogRow label="Generated hard comment" rows={true}>
          <div className={styles.readOnlyValue}>{generatedHardComment}</div>
        </DialogRow>
      )}
      <DialogRow label="User comment" rows={true}>
        <TextInput autoFocus value={comment} onChange={setComment} />
      </DialogRow>
      <DialogRow label="Preview" rows={true}>
        <div className={styles.preview} aria-label="End-of-line preview">
          {preview}
        </div>
      </DialogRow>
      <DialogFooter>
        <Button text="Save" type="submit" />
        <Button variant="secondary" text="Cancel" clicked={controls.cancel} />
        {hasExistingComment && (
          <>
            <DialogFooterSpacer />
            <Button variant="secondary" text="Clear" clicked={() => closeWithComment(undefined)} />
          </>
        )}
      </DialogFooter>
    </form>
  );
}

export function normalizeEndOfLineComment(comment: string): string | undefined {
  const normalized = comment
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/[ \t]+/g, " ");

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * The row's comment column as it will look once this dialog is saved.
 *
 * A user comment **replaces** the generated one rather than being appended to it, which is what the
 * listing does — see `decorateAnnotatedItems`. The preview exists to show the row as it will be, so
 * it has to make the same choice; showing them joined here while the listing shows only one would
 * make the preview a small lie about the thing it is previewing.
 *
 * With the user comment empty, the generated one is what the row will show — which is also how this
 * previews the Clear button's effect.
 */
export function formatEndOfLinePreview(
  generatedHardComment?: string,
  comment?: string
): string {
  const text = normalizeEndOfLineComment(comment ?? "") ?? generatedHardComment;
  return text ? `; ${text}` : "";
}
