import * as React from "react";

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

export type SectionProps = { title?: string };
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

export const Label: React.FC = (props) => {
  return (
    <span
      style={{ margin: "0 8px", color: "var(--statusbar-foreground-color)" }}
    >
      {props.children}
    </span>
  );
};