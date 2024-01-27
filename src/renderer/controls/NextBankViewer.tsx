import styles from "./NextBankViewer.module.scss";
import { Label } from "./Labels";
import { Column } from "./generic/Column";

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
