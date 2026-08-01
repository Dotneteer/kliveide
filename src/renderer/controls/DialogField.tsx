import type { ReactNode } from "react";
import { useId } from "react";
import styles from "./DialogField.module.scss";

type DialogFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: ReactNode;
};

export function DialogField({
  label,
  htmlFor,
  required = false,
  helpText,
  error,
  children
}: DialogFieldProps) {
  const helpId = useId();
  const errorId = useId();

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}{required && <span aria-hidden='true'> *</span>}
      </label>
      {helpText && <div id={helpId} className={styles.help}>{helpText}</div>}
      {children}
      {error && <div id={errorId} className={styles.error} role='alert'>{error}</div>}
    </div>
  );
}
