import styles from "./Toolbar.module.scss";
import Dropdown from "./Dropdown";

type StartOption = {
  value: string;
  label: string;
  labelCont: string;
  iconName: string;
  cmd: string | null;
};

type Props = {
  startOptions: StartOption[];
  startMode: string;
  canPickStartOption: boolean;
  onChanged: (mode: string) => void;
};

export const StartModeSelector = ({ startOptions, startMode, canPickStartOption, onChanged }: Props) => {
  return (
    <div className={styles.toolbarDropdownContainer}>
      {/*
        * `enabled`, not a `pointer-events: none` wrapper.
        *
        * The wrapper greyed the trigger and blocked the mouse, and did nothing about the keyboard:
        * the trigger stayed in the tab order, so a keyboard user could still open a control the UI
        * was presenting as unavailable and change the start mode. Radix's `disabled` removes it
        * from the tab order and marks it for assistive technology, and looks the same.
        */}
      <Dropdown
        placeholder={undefined}
        options={[...startOptions]}
        initialValue={startMode}
        width={184}
        enabled={canPickStartOption}
        onChanged={onChanged}
      />
    </div>
  );
};
