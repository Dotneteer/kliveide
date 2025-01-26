import { useState } from "react";
// import { Icon } from "./Icon";
import styles from "./LabeledSwitch.module.scss";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import Switch from "react-switch";
import { useTheme } from "@renderer/theming/ThemeProvider";

type Props = {
  label: string;
  title?: string;
  value: boolean;
  clicked?: (val: boolean) => void;
};

export const LabeledSwitch = ({ label, title, value, clicked }: Props) => {
  const ref = useTooltipRef();
  const [chState, setChState] = useState(value);
  const themeSrv = useTheme();
  const onColor = themeSrv.getThemeProperty("--bgcolor-switch-on");
  const onHandleColor = themeSrv.getThemeProperty("--color-switch-on");
  const offColor = themeSrv.getThemeProperty("--bgcolor-switch-off");
  const offHandleColor = themeSrv.getThemeProperty("--color-switch-off");

  return (
    <div
      ref={ref}
      className={styles.labeledSwitch}
      onClick={async () => {
        // --- Delay 100ms
        await new Promise((resolve) => setTimeout(resolve, 250));
        clicked?.(!value);
      }}
    >
      <span className={styles.headerLabel}>{label}</span>
      <Switch
        onChange={(v) => {
          setChState(v);
        }}
        checked={chState}
        checkedIcon={false}
        uncheckedIcon={false}
        height={14}
        width={28}
        onColor={onColor}
        onHandleColor={onHandleColor}
        offColor={offColor}
        offHandleColor={offHandleColor}
      />

      {/* <Icon
        iconName={value ? "circle-filled" : "circle-outline"}
        fill={value ? "--color-value" : "--color-command-icon"}
        width={20}
        height={20}
      /> */}
      <div style={{ width: 8 }}></div>
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={-8}
          offsetY={32}
          content={title}
        />
      )}
    </div>
  );
};
