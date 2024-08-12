import styles from "./Z88InsertCardDialog.module.scss";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { Modal } from "@renderer/controls/Modal";
import { CardTypeData, applyCardStateChange, cardTypes } from "../machines/Z88ToolArea";
import { useState } from "react";
import { useRendererContext } from "@renderer/core/RendererProvider";
import classnames from "@renderer/utils/classnames";
import { IconButton } from "@renderer/controls/IconButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { MC_Z88_SLOT0 } from "@common/machines/constants";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import { MainApi } from "@common/messaging/MainApi";
import { useMainApi } from "@renderer/core/MainApi";

const Z88_CARDS_FOLDER_ID = "z88CardsFolder";

type Props = {
  slot: number;
  onClose: () => void;
};

export const Z88InsertCardDialog = ({ slot, onClose }: Props) => {
  const { store } = useRendererContext();
  const mainApi = useMainApi();
  const { machineService } = useAppServices();
  const machine = machineService.getMachineController().machine as IZ88Machine;
  const [cardType, setCardType] = useState<CardTypeData>();
  const [file, setFile] = useState<string>();
  const [acceptedSizes, setAcceptedSizes] = useState<number[]>([]);
  const [_rom0Changed, setRom0Changed] = useState(false);

  // --- Get the allowed card sizes (Slot 0 allows only a subset)
  let allowedCardTypes = cardTypes.filter((ct) => (ct.allowInSlot0 || slot > 0) && !ct.noUi);
  const cardOptions = allowedCardTypes.map((ct) => ({
    value: ct.value,
    label: ct.label.replace("*", " ")
  }));

  // --- Select the card file from a file dialog
  const selectCardFile = async () => {
    const slot0AcceptedSizes = acceptedSizes.filter((s) => [128, 256, 512].includes(s));
    const cardFileInfo = await getCardFile(
      mainApi,
      slot,
      slot ? acceptedSizes : slot0AcceptedSizes
    );
    if (!cardFileInfo) {
      setFile(undefined);
      return;
    }
    const { filename, contents } = cardFileInfo;
    if (filename) {
      setFile(filename);
    }
    if (!cardType?.fallback) return;
    const lengthKb = Math.floor(contents.length / 1024);
    const selectedType = cardType.fallback?.find((f) => f.size === lengthKb);
    if (selectedType) {
      const newType = cardTypes.find((ct) => ct.value === selectedType.type);
      setCardType(newType);
    }
  };

  return (
    <Modal
      isOpen={true}
      title={`${slot ? "Insert" : "Replace"} Z88 Card - Slot ${slot}`}
      width={438}
      translateY={0}
      primaryEnabled={!!cardType && (!!slot || !!file)}
      onPrimaryClicked={async () => {
        const controller = machineService.getMachineController();
        const slotState: CardSlotState = {
          cardType: cardType?.value,
          size: cardType?.size,
          file
        };
        if (slot) {
          // --- Slot 1-3: Update the slot configuration state
          if (cardType.getFile && !file) {
            slotState.pristine = true;
          }
          await applyCardStateChange(store, controller, `slot${slot}` as any, slotState);
        } else {
          // --- Slot 0: update the Internal ROM configuration, require a restart
          const emulatorState = store.getState().emulatorState;
          const machineConfig = emulatorState.config ?? {};
          const newConfig = { ...machineConfig, [MC_Z88_SLOT0]: slotState };
          console.log(newConfig);
          const machineId = emulatorState?.machineId;
          const modelId = emulatorState?.modelId;

          // --- Change the configuration
          await machineService.setMachineType(machineId, modelId, newConfig);
        }
        return false;
      }}
      onClose={() => {
        machine.signalFlapClosed();
        onClose();
      }}
    >
      <DialogRow label="Card type:">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={cardOptions}
            value={cardType?.value}
            width={406}
            onSelectionChanged={async (option) => {
              const cardType = cardTypes.find((ct) => ct.value === option);
              setRom0Changed(true);
              setCardType(cardType);
              if (cardType) {
                setAcceptedSizes(cardType.fallback?.map((f) => f.size) || []);
              }
            }}
          />
        </div>
      </DialogRow>
      {cardType?.getFile && (
        <DialogRow label="Select the card file:">
          <div className={styles.filenameRow}>
            <div className={styles.fileButton} onClick={selectCardFile}>
              <IconButton
                iconName="file-code"
                buttonWidth={20}
                buttonHeight={20}
                title="Select card file"
              />
            </div>
            <div
              className={classnames(styles.filename, {
                [styles.fileSelected]: !!file,
                [styles.warning]: !file && !slot
              })}
              onClick={selectCardFile}
            >
              {file && file.startsWith("/") ? file.substring(1) : file}
              {!file && !!slot && "Use pristine card (or click to select a file)"}
              {!file && !slot && "You must select a card file - click here"}
            </div>
            {file && (
              <IconButton
                iconName="close"
                buttonWidth={20}
                buttonHeight={20}
                title="Use pristine card"
                clicked={() => setFile(undefined)}
              />
            )}
          </div>
        </DialogRow>
      )}
    </Modal>
  );
};

type GetCardFileMessage = {
  filename: string;
  contents: Uint8Array;
};

async function getCardFile(
  mainApi: MainApi,
  slot: number,
  acceptedSizes: number[]
): Promise<GetCardFileMessage | undefined> {
  const filterName = slot == 0 ? "ROM files" : "EPROM files";
  const filterExtensions = slot == 0 ? ["bin", "rom"] : ["epr"];
  const response = await mainApi.showOpenFileDialog(
    [
      { name: filterName, extensions: filterExtensions },
      { name: "All Files", extensions: ["*"] }
    ],
    Z88_CARDS_FOLDER_ID
  );

  // --- No card is selected
  if (!response.file) return null;

  // --- Check the selected file
  const checkResponse = await mainApi.checkZ88Card(response.file);

  // --- Result of test
  if (checkResponse.content) {
    // --- Check for available size
    const fileSize = checkResponse.content.length;
    const isAllowed = acceptedSizes.some((s) => s * 1024 === fileSize);
    if (!isAllowed) {
      mainApi.displayMessageBox(
        "error",
        "Invalid Z88 Card",
        `The size of the selected card is ${fileSize} bytes (${Math.floor(
          fileSize / 1024
        )} KBytes), which is not allowed in this slot.`
      );
      return null;
    }
    return { filename: response.file, contents: checkResponse.content };
  } else if (checkResponse.message) {
    mainApi.displayMessageBox("error", "Invalid Z88 Card", checkResponse.message);
    return null;
  }
  return { filename: response.file, contents: checkResponse.content };
}
