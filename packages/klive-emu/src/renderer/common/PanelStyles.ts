import styles from "styled-components";

export interface StyledPanelOptions {
  splitsVertical?: boolean;
  fitToClient?: boolean;
  width?: string | number;
  height?: string | number;
  background?: string;
  others?: Record<string, any>;
}

export function createPanel(options: Record<string, any> = {}) {
  const props: string[] = [];
  if (options) {
    for (const propKey in options) {
      props.push(`${propKey}: ${options[propKey]}`);
    }
  }
  return styles.div`
    display: flex;
    ${props.join(";")}
  `;
}

export function createSizedStyledPanel(options: StyledPanelOptions = {}) {
  const defWidth = options?.width ?? "100%";
  const defHeight = options?.height ?? "100%";
  const others: string[] = [];
  if (options.others) {
    for (const propKey in options.others) {
      others.push(`${propKey}: ${options.others[propKey]}`);
    }
  }
  return styles.div`
    display: flex;
    flex-direction: ${options?.splitsVertical ?? true ? "column" : "row"};
    flex-grow: ${options?.fitToClient ?? true ? 1 : 0};
    flex-shrink: ${options?.fitToClient ?? true ? 1 : 0};
    width: ${typeof defWidth === "string" ? defWidth : `${defWidth}px`};
    height: ${typeof defHeight === "string" ? defHeight : `${defHeight}px`};
    background-color: ${options?.background ?? "transparent"};
    ${others.join(";")}
  `;
}

export function createUnsizedStyledPanel(options: StyledPanelOptions = {}) {
  const others: string[] = [];
  if (options.others) {
    for (const propKey in options.others) {
      others.push(`${propKey}: ${options.others[propKey]}`);
    }
  }
  return styles.div`
    display: flex;
    flex-direction: ${options?.splitsVertical ?? true ? "column" : "row"};
    flex-grow: ${options?.fitToClient ?? true ? 1 : 0};
    flex-shrink: ${options?.fitToClient ?? true ? 1 : 0};
    background-color: ${options?.background ?? "transparent"};
    ${others.join(";")}
  `;
}
