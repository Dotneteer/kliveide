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
    <div
      className={styles.toolbarDropdownContainer}
      style={!canPickStartOption ? { pointerEvents: "none", opacity: ".4" } : {}}
    >
      <Dropdown
        placeholder={undefined}
        options={[...startOptions]}
        initialValue={startMode}
        width={184}
        onChanged={onChanged}
      />
    </div>
  );
};
