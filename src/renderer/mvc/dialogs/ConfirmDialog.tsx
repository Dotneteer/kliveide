import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import type { ConfirmRequest } from "./DialogPorts";
import styles from "./ConfirmDialog.module.scss";

export type ConfirmDialogProps = DialogComponentProps<boolean> & ConfirmRequest;

/**
 * The body a `ConfirmPort` opens. It is a managed dialog body in the sense of
 * `.docs/dialog-pattern.md`: the provider owns the modal frame, this component
 * only settles through `controls`.
 */
export const ConfirmDialog = ({
  lines,
  code,
  linesAfterCode,
  confirmLabel,
  cancelLabel,
  danger,
  controls
}: ConfirmDialogProps) => (
  <DialogForm
    submitLabel={confirmLabel}
    submitDanger={danger}
    cancelLabel={cancelLabel}
    onSubmit={() => controls.close(true)}
    onCancel={controls.cancel}
  >
    <div className={styles.body}>
      {lines.map((line, index) => (
        <div key={`line-${index}`}>{line}</div>
      ))}
      {code && (
        <code className={styles.code}>
          <bdi>{code}</bdi>
        </code>
      )}
      {linesAfterCode?.map((line, index) => (
        <div key={`after-${index}`}>{line}</div>
      ))}
    </div>
  </DialogForm>
);
