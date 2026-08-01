import type { FormEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { Button } from "./Button";
import styles from "./DialogForm.module.scss";

type DialogFormProps = {
  children: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
  submitDanger?: boolean;
  cancelLabel?: string;
  submitting?: boolean;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
};

export function DialogForm({
  children,
  submitLabel,
  submitDisabled = false,
  submitDanger = false,
  cancelLabel = "Cancel",
  submitting: submittingProp,
  onSubmit,
  onCancel
}: DialogFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = submittingProp ?? isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || submitDisabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    const event = new CustomEvent("klive-dialog-cancel", {
      bubbles: true,
      cancelable: true
    });
    formRef.current?.dispatchEvent(event);
    if (!event.defaultPrevented) onCancel();
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.body}>{children}</div>
      <footer className={styles.footer}>
        <Button text={cancelLabel} disabled={submitting} clicked={handleCancel} />
        <Button
          type='submit'
          text={submitting ? "Working…" : submitLabel}
          disabled={submitDisabled || submitting}
          isDanger={submitDanger}
        />
      </footer>
    </form>
  );
}
