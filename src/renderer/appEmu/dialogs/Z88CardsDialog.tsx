import { MessengerBase } from "@common/messaging/MessengerBase";
import styles from "./Z88CardsDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { Icon } from "@renderer/controls/Icon";
import { useRendererContext } from "@renderer/core/RendererProvider";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { useRef, useState } from "react";
import { delay } from "@renderer/utils/timing";
import { setMachineSpecificAction } from "@common/state/actions";

// --- ID of the open file dialog path
const Z88_CARDS_FOLDER_ID = "z88CardsFolder";

const cardData = [
  { value: "empty", label: "<no card>" },
  { value: "32K", label: "32K RAM" },
  { value: "128K", label: "128K RAM" },
  { value: "512K", label: "512K RAM" },
  { value: "1M", label: "1M RAM" },
  { value: "eprom", label: "EPROM" }
];

type Props = {
  onClose: () => void;
};

export const Z88CardsDialog = ({ onClose }: Props) => {
  const modalApi = useRef<ModalApi>(null);
  const { store, messageSource } = useRendererContext();
  const machineSpecific = store.getState().emulatorState?.machineSpecific ?? {};
  const initialState = machineSpecific.z88Cards ?? {
    slot1: { content: "empty" },
    slot2: { content: "empty" },
    slot3: { content: "empty" }
  };
  const [newState, setNewState] = useState<Z88CardsState>(initialState);
  return (
    <Modal
      title='Insert or Remove Z88 Cards'
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      initialFocus='cancel'
      onPrimaryClicked={async () => {
        const machineSpecific =
          store.getState().emulatorState.machineSpecific ?? {};
        store.dispatch(
          setMachineSpecificAction({ ...machineSpecific, z88Cards: newState }),
          messageSource
        );
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow>
        <div className={styles.cardRows}>
          <CardData
            slot={1}
            initialState={initialState.slot1}
            changed={ns => {
              setNewState({ ...newState, slot1: ns });
            }}
          />
          <CardData
            slot={2}
            initialState={initialState.slot2}
            changed={ns => {
              setNewState({ ...newState, slot2: ns });
            }}
          />
          <CardData
            slot={3}
            initialState={initialState.slot3}
            changed={ns => {
              setNewState({ ...newState, slot3: ns });
            }}
          />
        </div>
      </DialogRow>
    </Modal>
  );
};

type CardColumnProps = {
  slot: number;
  initialState?: SlotState;
  changed?: (newState: SlotState) => void;
};

const CardData = ({ slot, initialState, changed }: CardColumnProps) => {
  const { messenger } = useRendererContext();
  const [slotState, setSlotState] = useState<SlotState>(initialState);

  const hasNewState = () =>
    slotState.content !== initialState.content ||
    slotState.epromFile !== initialState.epromFile;
  return (
    <div className={styles.column}>
      <div className={styles.labelRow}>
        <div className={styles.slotLabel}>Slot {slot}</div>
        {hasNewState() && (
          <Icon iconName='circle-filled' fill="--color-text-hilite" width={16} height={16} />
        )}
      </div>
      <Dropdown
        placeholder='Select...'
        options={cardData}
        value={initialState.content}
        width={168}
        onSelectionChanged={async option => {
          if (option === slotState.content) return;
          let filename: string | undefined;
          if (option === "eprom") {
            await delay(10);
            filename = await openFileDialog(messenger);
            if (!filename) {
              return true;
            }
          }
          const newSlotState: SlotState = {
            ...slotState,
            content: option as SlotContent,
            epromFile: filename
          };

          setSlotState(newSlotState);
          changed?.(newSlotState);
        }}
      />
      <Filename
        file={slotState.epromFile}
        changed={async (name: string) => {
          const newSlotState: SlotState = {
            ...slotState,
            epromFile: name
          };
          setSlotState(newSlotState);
          changed?.(newSlotState);
        }}
      />
    </div>
  );
};

async function openFileDialog (
  messenger: MessengerBase
): Promise<string | undefined> {
  const response = await messenger.sendMessage({
    type: "MainShowOpenFileDialog",
    filters: [
      { name: "ROM files", extensions: ["bin", "rom"] },
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
    return response.file;
  }
}

type FileNameProps = {
  file?: string;
  changed: (name: string) => void;
};

const Filename = ({ file, changed }: FileNameProps) => {
  const { messenger } = useRendererContext();
  return (
    <div
      className={styles.filenameRow}
      style={{ cursor: file ? "pointer" : undefined }}
      onClick={async () => {
        if (!file) return;
        const filename = await openFileDialog(messenger);
        if (filename) changed?.(filename);
      }}
    >
      {file && <Icon iconName='file-code' width={20} height={20} />}
      {file && (
        <div className={styles.filename}>
          {file.startsWith("/") ? file.substring(1) : file}
        </div>
      )}
    </div>
  );
};

/**
 * Available Z88 card slot states
 */
export type SlotContent = "empty" | "32K" | "128K" | "512K" | "1M" | "eprom";

/**
 * State of a particular slot
 */
export type SlotState = {
  content: SlotContent;
  epromFile?: string;
};

/**
 * Represents the Z88 card states
 */
export type Z88CardsState = {
  slot1: SlotState;
  slot2: SlotState;
  slot3: SlotState;
};

/**
 * The contents of a particular card in a Z88 slot
 */
export type CardContent = {
  ramSize?: number;
  eprom?: Uint8Array;
};
