import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import styles from "./NexSynopsisCommentDialog.module.scss";

export type NexSynopsisCommentDialogResult = {
  synopsis?: string;
};

export type NexSynopsisCommentDialogProps =
  DialogComponentProps<NexSynopsisCommentDialogResult> & {
    bank: number;
    bankOffset: number;
    effectiveAddress: number;
    initialSynopsis?: string;
  };

export function NexSynopsisCommentDialog({
  bank,
  bankOffset,
  effectiveAddress,
  initialSynopsis = "",
  controls
}: NexSynopsisCommentDialogProps) {
  const [comment, setComment] = useState(initialSynopsis);
  const normalizedComment = useMemo(() => normalizeSynopsisComment(comment), [comment]);
  const preview = useMemo(() => formatSynopsisPreview(comment), [comment]);
  const hasExistingSynopsis = initialSynopsis.length > 0;

  const closeWithComment = (synopsis?: string) => {
    controls.close({ synopsis });
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
      <DialogRow label="Comment" rows={true}>
        <textarea
          autoFocus
          className={styles.comment}
          spellCheck={false}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </DialogRow>
      <DialogRow label="Preview" rows={true}>
        <div className={styles.preview} aria-label="Synopsis preview">
          {preview}
        </div>
      </DialogRow>
      <footer className={styles.footer}>
        <Button text="Save" type="submit" />
        <Button text="Cancel" clicked={controls.cancel} />
        {hasExistingSynopsis && (
          <>
            <div className={styles.footerSpacer} />
            <Button text="Clear" clicked={() => closeWithComment(undefined)} />
          </>
        )}
      </footer>
    </form>
  );
}

export function normalizeSynopsisComment(comment: string): string | undefined {
  const normalized = comment
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  return normalized.trim().length > 0 ? normalized : undefined;
}

export function formatSynopsisPreview(comment: string): string {
  const normalized = normalizeSynopsisComment(comment);
  if (!normalized) {
    return "";
  }
  return normalized
    .split("\n")
    .map((line) => `; ${line}`)
    .join("\n");
}
