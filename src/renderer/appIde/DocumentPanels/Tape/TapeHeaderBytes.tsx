import { useMemo } from "react";
import { ByteAnatomy } from "@renderer/controls/bankBrowser/ByteAnatomy";
import { useT } from "@common/i18n/useT";
import { initialHeaderField, tapeHeaderFields } from "./tapeHeaderFields";

/*
 * A header block's 19 bytes, explained (option C of the header mockups), drawn by the shared
 * `ByteAnatomy`.
 *
 * One field is explained from the start - the autostart line or the load address, what a header is
 * mostly for - so the panel teaches something before anyone hovers.
 */

type Props = {
  bytes: Uint8Array;
  /** The block index of the data block the header describes */
  dataIndex?: number;
};

export const TapeHeaderBytes = ({ bytes, dataIndex }: Props) => {
  const t = useT();
  // --- `t` changes with the language, so the fields are worded again
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fields = useMemo(() => tapeHeaderFields(bytes, dataIndex), [bytes, dataIndex, t]);
  return (
    <ByteAnatomy
      title={t("panels.tape.headerBytes")}
      bytes={bytes}
      fields={fields}
      initialKey={initialHeaderField(fields)}
      testId="tape-header"
    />
  );
};
