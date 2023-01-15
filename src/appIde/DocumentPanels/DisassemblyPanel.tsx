import { SmallIconButton } from "@/controls/common/IconButton";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { useState } from "react";
import styles from "./DisassemblyPanel.module.scss";

const DisassemblyPanel = () => {
  const [followPc, setFollowPc] = useState(false)
  const [ram, setRam] = useState(true);
  const [screen, setScreen] = useState(false);

  return (
    <div className={styles.disassemblyPanel}>
      <div className={styles.header}>
        <SmallIconButton
          iconName='refresh'
          title={"Refresh now"}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel text='Follow PC:' />
        <SmallIconButton
          iconName={followPc ? "circle-filled": "circle-outline"}
          title='Follow the changes of PC'
          clicked={() => setFollowPc(!followPc)}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel text='RAM:' />
        <SmallIconButton
          iconName={ram ? "circle-filled": "circle-outline"}
          title='Disasseble RAM?'
          clicked={() => setRam(!ram)}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel text='Screen:' />
        <SmallIconButton
          iconName={screen ? "circle-filled": "circle-outline"}
          title='Disasseble screen?'
          clicked={() => setScreen(!screen)}
        />
        <ToolbarSeparator small={true} />
        <ValueLabel text='0000 - ffff' />
      </div>
      <div>DisassemblyPanel</div>
    </div>
  );
};

type LabelProps = {
  text: string;
};

const HeaderLabel = ({ text }: LabelProps) => {
  return <div className={styles.headerLabel}>{text}</div>;
};

const ValueLabel = ({ text }: LabelProps) => {
  return <div className={styles.valueLabel}>{text}</div>;
};

export const createDisassemblyPanel = () => <DisassemblyPanel />;
