import type { FormEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { useT } from "@common/i18n/useT";
import { Button } from "./Button";
import styles from "./DialogForm.module.scss";

type DialogFormProps = {
  children: ReactNode;
  submitLabel: string;
  submitDisabled?: boolean;
  submitDanger?: boolean;
  cancelLabel?: string;
  submitting?: boolean;
  /**
   * Content at the footer's start, across from the buttons: a setting of the whole dialog rather
   * than of any one field or page (the breakpoint dialog's Enabled box), or a message that belongs
   * to no single field.
   */
  footerStart?: ReactNode;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
};

export function DialogForm({
  children,
  submitLabel,
  submitDisabled = false,
  submitDanger = false,
  cancelLabel,
  submitting: submittingProp,
  footerStart,
  onSubmit,
  onCancel
}: DialogFormProps) {
  const t = useT();
  cancelLabel ??= t("common.button.cancel");
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
        <Button
          text={cancelLabel}
          variant='secondary'
          disabled={submitting}
          clicked={handleCancel}
        />
        <Button
          type='submit'
          text={submitting ? "Working…" : submitLabel}
          disabled={submitDisabled || submitting}
          isDanger={submitDanger}
        />
        {/* Last in the DOM: the footer is `row-reverse`, so this lands at the start */}
        {footerStart && <div className={styles.footerStart}>{footerStart}</div>}
      </footer>
    </form>
  );
}
