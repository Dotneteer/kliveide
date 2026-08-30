import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import styles from "./NexEndOfLineCommentDialog.module.scss";

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
      {generatedHardComment && (
        <DialogRow label="Generated hard comment" rows={true}>
          <div className={styles.readOnlyValue}>{generatedHardComment}</div>
        </DialogRow>
      )}
      <DialogRow label="User comment" rows={true}>
        <input
          autoFocus
          className={styles.comment}
          spellCheck={false}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </DialogRow>
      <DialogRow label="Preview" rows={true}>
        <div className={styles.preview} aria-label="End-of-line preview">
          {preview}
        </div>
      </DialogRow>
      <footer className={styles.footer}>
        <Button text="Save" type="submit" />
        <Button text="Cancel" clicked={controls.cancel} />
        {hasExistingComment && (
          <>
            <div className={styles.footerSpacer} />
            <Button text="Clear" clicked={() => closeWithComment(undefined)} />
          </>
        )}
      </footer>
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

export function formatEndOfLinePreview(
  generatedHardComment?: string,
  comment?: string
): string {
  const parts = [generatedHardComment, normalizeEndOfLineComment(comment ?? "")]
    .filter((part): part is string => !!part);
  return parts.length > 0 ? `; ${parts.join(" | ")}` : "";
}
