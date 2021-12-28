import * as React from "react";

/**
 * Represents the root container of a statusbar
 */
export const StatusbarRoot: React.FC = (props) => {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        flexGrow: 0,
        height: 28,
        width: "100%",
        padding: "0px 8px",
        backgroundColor: "var(--statusbar-background-color)",
        boxSizing: "border-box",
        alignContent: "start",
        alignItems: "center",
        justifyItems: "start",
        fontSize: "0.9em",
      }}
    >
      {props.children}
    </div>
  );
};

/**
 * Properties of a statusbar section
 */
export type SectionProps = { title?: string };

/**
 * Represents a statusbar section
 */
export const Section: React.FC<SectionProps> = (props) => {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        flexGrow: 0,
        height: "100%",
        margin: "0 4px",
        alignContent: "flex-start",
        alignItems: "center",
        justifyItems: "start",
      }}
    >
      {props.children}
    </div>
  );
};

type LabelProps = {
  style?: React.CSSProperties;
};
/**
 * Represents a statusbar label
 */
export const Label: React.FC<LabelProps> = (props) => {
  return (
    <span
      style={{
        margin: "0 8px",
        color: "var(--statusbar-foreground-color)",
        ...props.style,
      }}
    >
      {props.children}
    </span>
  );
};

export const DataLabel: React.FC = (props) => {
  return (
    <Label style={{ fontFamily: "var(--console-font)" }}>
      {props.children}
    </Label>
  );
};
