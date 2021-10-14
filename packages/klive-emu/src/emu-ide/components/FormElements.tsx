import * as React from "react";

/**
 * Simple form labes
 */
export const Label: React.FC = (props) => {
  return <label className="dialog-label">{props.children}</label>;
};

/**
 * Error label
 */
export const ErrorLabel: React.FC = (props) => {
  return <label className="dialog-label dialog-error">{props.children}</label>;
};

/**
 * Hint label
 */
 export const HintLabel: React.FC = (props) => {
  return <label className="dialog-label dialog-hint">{props.children}</label>;
};

/**
 * Field container
 */
export const Field: React.FC = (props) => {
  return <div className="dialog-field">{props.children}</div>;
};

/**
 * Field row container
 */
export const FieldRow: React.FC = (props) => {
  return <div className="dialog-field-row">{props.children}</div>;
};
