import styles, { StyledComponent } from "styled-components";

export interface StyledPanelOptions {
  splitsVertical?: boolean;
  fixed?: boolean;
  width?: string | number;
  height?: string | number;
  background?: string;
  others?: Record<string, any>;
}

export function createStyledPanel(options: StyledPanelOptions) {
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
    flex-grow: ${options?.fixed ?? true ? 1 : 0};
    flex-shrink: ${options?.fixed ?? true ? 1 : 0};
    width: ${typeof defWidth === "string" ? defWidth : `${defWidth}px`};
    height: ${typeof defHeight === "string" ? defHeight : `${defHeight}px`};
    background-color: ${options?.background ?? "transparent"};
    ${others.join(";")}
  `;
}
