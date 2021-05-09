import styles from "styled-components";

export const Root = styles.div`
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  height: 28px;
  width: 100%;
  padding: 0px 8px;
  background-color: var(--statusbar-background-color);
  box-sizing: border-box;
  align-content: start;
  align-items: center;
  justify-items: start;
  font-size: 0.9em;
`;

export const Section = styles.div`
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  height: 100%;
  margin: 0 4px;
  align-content: flex-start;
  align-items: center;
  justify-items: start;
`;

export const Label = styles.span`
  margin: 0px 8px;
  color: var(--statusbar-foreground-color);
`;

export const Gap = styles.div`
  width: 100%;
  flex-grow: 1;
  flex-shrink: 1;
`;
