import { Column, Label } from "./GeneralControls";
import styles from "./NextBankViewer.module.scss";

type Props = {
  contents: Uint8Array;
  bank?: number;
};

export const NextBankViewer = ({ contents, bank }: Props) => {
  return (
    <Column>
      <Label text='Next Bank' />
    </Column>
  );
};
