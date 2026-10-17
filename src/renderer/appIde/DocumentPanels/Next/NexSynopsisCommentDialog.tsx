import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useT } from "@common/i18n/useT";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import styles from "./NexSynopsisCommentDialog.module.scss";
import { normalizeMultilineComment } from "@renderer/appIde/annotations/programAnnotations";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

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
  const t = useT();
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
      <DialogRow label={t("panels.next.field.location")} rows={true}>
        <div className={styles.location}>
          <span className={styles.locationLabel}>{t("panels.next.field.bank")}</span>
          <span>{bank}</span>
          <span className={styles.locationLabel}>{t("panels.next.field.bankOffset")}</span>
          <span>{`$${toHexa4(bankOffset)} (${bankOffset})`}</span>
          <span className={styles.locationLabel}>{t("panels.next.field.address")}</span>
          <span>{`$${toHexa4(effectiveAddress)} (${effectiveAddress})`}</span>
        </div>
      </DialogRow>
      <DialogRow label={t("panels.next.field.comment")} rows={true}>
        <textarea
          autoFocus
          className={styles.comment}
          spellCheck={false}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </DialogRow>
      <DialogRow label={t("panels.next.field.preview")} rows={true}>
        <div className={styles.preview} aria-label={t("panels.next.synopsis.previewLabel")}>
          {preview}
        </div>
      </DialogRow>
      <DialogFooter>
        <Button text={t("panels.next.button.save")} type="submit" />
        <Button variant="secondary" text={t("common.button.cancel")} clicked={controls.cancel} />
        {hasExistingSynopsis && (
          <>
            <DialogFooterSpacer />
            <Button variant="secondary" text={t("panels.next.button.clear")} clicked={() => closeWithComment(undefined)} />
          </>
        )}
      </DialogFooter>
    </form>
  );
}

/** The synopsis's normalization is the shared one; kept under its own name for its callers. */
export function normalizeSynopsisComment(comment: string): string | undefined {
  return normalizeMultilineComment(comment);
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
