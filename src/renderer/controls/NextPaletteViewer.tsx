import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { Column, Label, Row, Value } from "./GeneralControls";
import styles from "./NextPaletteViewer.module.scss";

type Props = {
  palette: number[];
  is8BitPalette?: boolean;
};

export const NextPaletteViewer = ({ palette, is8BitPalette }: Props) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return (
    <Column>
      {indexes.map(idx => (
        <PaletteRow
          palette={palette}
          firstIndex={idx * 0x10}
          is8BitPalette={is8BitPalette}
        />
      ))}
    </Column>
  );
};

type PaletteRowProps = {
  firstIndex: number;
  palette: number[];
  is8BitPalette?: boolean;
};

const PaletteRow = ({
  firstIndex,
  palette,
  is8BitPalette
}: PaletteRowProps) => {
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return (
    <Row>
      {indexes.map(idx => (
        <PaletteItem
          index={firstIndex + idx}
          value={palette[firstIndex + idx]}
          is8BitPalette={is8BitPalette}
        />
      ))}
    </Row>
  );
};

type PaletteItemProps = {
  index: number;
  value: number;
  is8BitPalette?: boolean;
};

const PaletteItem = ({ index, value, is8BitPalette }: PaletteItemProps) => {
  return (
    <>
      <Label text={`${toHexa2(index)}: `} />
      <Value text={toHexa2(value)} />
    </>
  );
};
