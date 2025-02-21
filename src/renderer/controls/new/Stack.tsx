import { CSSProperties } from "react";
import styles from "./Stack.module.scss";
import { createThemeVar } from "@renderer/theming/theme-utils";

type Props = {
  children: React.ReactNode;
  padding?: string;
  paddingHorizontal?: string;
  paddingVertical?: string;
  gap?: string;
  backgroundColor?: string;
  style?: CSSProperties;
};

type StackProps = Props & {
  className?: string;
};

const Stack = ({
  children,
  padding,
  paddingHorizontal,
  paddingVertical,
  gap,
  backgroundColor,
  style,
  className
}: StackProps) => {
  const elementStyle: React.CSSProperties = {
    padding: createThemeVar(padding) || 0,
    paddingLeft: createThemeVar(paddingHorizontal) || 0,
    paddingRight: createThemeVar(paddingHorizontal) || 0,
    paddingTop: createThemeVar(paddingVertical) || 0,
    paddingBottom: createThemeVar(paddingVertical) || 0,
    backgroundColor: createThemeVar(backgroundColor),
    gap: createThemeVar(gap) || 0
  };
  return (
    <div className={className} style={{ ...elementStyle, ...style }}>
      {children}
    </div>
  );
};

export const VStack = ({
  children,
  ...rest
}: Props) => {
  return (
    <Stack className={styles.vstack} {...rest}>
      {children}
    </Stack>
  );
};

export const HStack = ({
  children,
  ...rest
}: Props) => {
  return (
    <Stack className={styles.hstack} {...rest}>
      {children}
    </Stack>
  );
};
