import styles from "./Z88InsertCardDialog.module.scss";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { Modal } from "@renderer/controls/Modal";
import { CardTypeData, cardTypes } from "../machines/Z88ToolArea";
import { useState } from "react";
import { MessengerBase } from "@common/messaging/MessengerBase";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { useRendererContext } from "@renderer/core/RendererProvider";
import classnames from "@renderer/utils/classnames";
import { IconButton } from "@renderer/controls/IconButton";

const Z88_CARDS_FOLDER_ID = "z88CardsFolder";

type Props = {
  slot: number;
  onClose: () => void;
};

export const Z88InsertCardDialog = ({ slot, onClose }: Props) => {
  const { messenger } = useRendererContext();
  const [cardType, setCardType] = useState<CardTypeData>();
  const [file, setFile] = useState<string>();

  let allowedCardTypes = cardTypes.filter(ct => ct.allowInSlot0 || slot > 0);
  const cardOptions = allowedCardTypes.map(ct => ({
    value: ct.value,
    label: ct.label.replace("*", " ")
  }));

  const selectCardFile = async () => {
    const filename = await getCardFile(messenger);
    if (filename) {
      setFile(filename);
    }
  };

  return (
    <Modal
      isOpen={true}
      title={`Insert Z88 Card into Slot ${slot}`}
      width={400}
      onPrimaryClicked={async () => {
        console.log("Insert card into slot", slot);
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label='Card type:'>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder='Select...'
            options={cardOptions}
            value={cardType?.value}
            width={406}
            onSelectionChanged={async option => {
              setCardType(cardTypes.find(ct => ct.value === option));
              console.log("Selected card", option);
            }}
          />
        </div>
      </DialogRow>
      {cardType?.getFile && (
        <DialogRow label='Select the card file:'>
          <div className={styles.filenameRow}>
            <div className={styles.fileButton} onClick={selectCardFile}>
              <IconButton
                iconName='file-code'
                buttonWidth={20}
                buttonHeight={20}
                title="Select card file"
              />
            </div>
            <div
              className={classnames(styles.filename, {
                [styles.fileSelected]: !!file
              })}
              onClick={selectCardFile}
            >
              {file && file.startsWith("/") ? file.substring(1) : file}
              {!file && "(Use pristine card)"}
            </div>
            {file && (
              <IconButton
                iconName='close'
                buttonWidth={20}
                buttonHeight={20}
                title='Use pristine card'
                clicked={() => setFile(undefined)}
              />
            )}
          </div>
        </DialogRow>
      )}
    </Modal>
  );
};

async function getCardFile (
  messenger: MessengerBase
): Promise<string | undefined> {
  const response = await messenger.sendMessage({
    type: "MainShowOpenFileDialog",
    filters: [
      { name: "EPROM files", extensions: ["epr"] },
      { name: "All Files", extensions: ["*"] }
    ],
    settingsId: Z88_CARDS_FOLDER_ID
  });
  if (response.type === "ErrorResponse") {
    reportMessagingError(
      `MainShowOpenFolderDialog call failed: ${response.message}`
    );
  } else if (response.type !== "MainShowOpenFileDialogResponse") {
    reportUnexpectedMessageType(response.type);
  } else {
    // --- No card is selected
    if (!response.file) return;

    // --- Check the selected file
    const checkResponse = await messenger.sendMessage({
      type: "MainCheckZ88Card",
      path: response.file
    });
    if (checkResponse.type === "ErrorResponse") {
      reportMessagingError(
        `MainShowOpenFolderDialog call failed: ${checkResponse.message}`
      );
    } else if (checkResponse.type !== "MainCheckZ88CardResponse") {
      reportUnexpectedMessageType(checkResponse.type);
    } else {
      // --- Result of test
      if (checkResponse.content) {
        return response.file;
      } else if (checkResponse.message) {
        messenger.sendMessage({
          type: "MainDisplayMessageBox",
          title: "Invalid Z88 Card",
          messageType: "error",
          message: checkResponse.message
        });
        return;
      }
      return response.file;
    }
  }
}
