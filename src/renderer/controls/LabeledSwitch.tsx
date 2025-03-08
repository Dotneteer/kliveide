import styles from "./LabeledSwitch.module.scss";

import { useState } from "react";
import Switch from "react-switch";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import { useTheme } from "@renderer/theming/ThemeProvider";
import classnames from "classnames";

type Props = {
  label: string;
  title?: string;
  value: boolean;
  clicked?: (val: boolean) => void;
};

export const LabeledSwitch = ({ label, title, value, clicked }: Props) => {
  const ref = useTooltipRef();
  const [switchState, setSwitchState] = useState(value);
  const themeSrv = useTheme();
  const onColor = themeSrv.getThemeProperty("--bgcolor-switch-on");
  const onHandleColor = themeSrv.getThemeProperty("--color-switch-on");
  const offColor = themeSrv.getThemeProperty("--bgcolor-switch-off");
  const offHandleColor = themeSrv.getThemeProperty("--color-switch-off");

  return (
    <div ref={ref} className={styles.labeledSwitch}>
      <span
        className={classnames(styles.headerLabel, { [styles.active]: switchState })}
        onClick={() => {
          setSwitchState(!switchState);
          clicked?.(!switchState);
        }}
      >
        {label}
      </span>
      <Switch
        onChange={(v) => {
          setSwitchState(v);
          clicked?.(v);
        }}
        checked={switchState ?? false}
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
