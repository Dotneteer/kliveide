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
import { useEffect, useRef, useState } from "react";
import { delay } from "@renderer/utils/timing";
import { setMachineConfigAction } from "@common/state/actions";
import {
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3
} from "@common/machines/constants";
import { LabelSeparator } from "@renderer/controls/Labels";
import {
  CARD_SIZE_128K,
  CARD_SIZE_1M,
  CARD_SIZE_32K,
  CARD_SIZE_512K,
  CT_EPROM,
  CT_INTEL_FLASH,
  CT_RAM,
  CT_ROM
} from "@emu/machines/z88/memory/CardType";

// --- ID of the open file dialog path
const Z88_CARDS_FOLDER_ID = "z88CardsFolder";

type OptionProps = {
  label: string;
  value: string;
  dependsOn?: string[];
  hasContent?: boolean;
};

const cardSizeOptions = [
  { value: "-", label: "(empty)", physicalSize: 0 },
  { value: CARD_SIZE_32K, label: "32K", physicalSize: 32 * 1024 },
  { value: CARD_SIZE_128K, label: "128K", physicalSize: 128 * 1024 },
  { value: CARD_SIZE_512K, label: "512K", physicalSize: 512 * 1024 },
  { value: CARD_SIZE_1M, label: "1M", physicalSize: 1024 * 1024 }
];

const cardTypeOptions: OptionProps[] = [
  { value: CT_RAM, label: "RAM" },
  { value: CT_ROM, label: "ROM", hasContent: true },
  { value: CT_EPROM, label: "Eprom (empty)", dependsOn: ["32K", "128K"] },
  {
    value: CT_EPROM + "-C",
    label: "Eprom (content)",
    dependsOn: ["32K", "128K"],
    hasContent: true
  },
  {
    value: CT_INTEL_FLASH,
    label: "Intel Flash (empty)",
    dependsOn: ["512K", "1M"]
  },
  {
    value: CT_INTEL_FLASH + "-C",
    label: "Intel Flash (content)",
    dependsOn: ["512K", "1M"],
    hasContent: true
  }
];

type Props = {
  onClose: () => void;
};

export const Z88CardsDialog = ({ onClose }: Props) => {
  const modalApi = useRef<ModalApi>(null);
  const { store, messageSource } = useRendererContext();
  const machineConfig = store.getState().emulatorState?.config ?? {};
  const initialState = {
    [MC_Z88_SLOT1]: machineConfig[MC_Z88_SLOT1] ?? { size: "-" },
    [MC_Z88_SLOT2]: machineConfig[MC_Z88_SLOT2] ?? { size: "-" },
    [MC_Z88_SLOT3]: machineConfig[MC_Z88_SLOT3] ?? { size: "-" }
  };
  const [newState, setNewState] = useState<Z88CardsState>(
    initialState as Z88CardsState
  );
  const [saveEnabled, setSaveEnabled] = useState(false);

  useEffect(() => {
    setSaveEnabled(slotStateValid());
  }, [newState]);

  return (
    <Modal
      title='Insert or Remove Z88 Cards'
      isOpen={true}
      fullScreen={false}
      width={600}
      onApiLoaded={api => (modalApi.current = api)}
      initialFocus='cancel'
      primaryEnabled={saveEnabled}
      onPrimaryClicked={async () => {
        if (slotStateChanged()) {
          applyCardStateChange();
        }
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

  function slotStateChanged (): boolean {
    return (
      initialState.slot1.content !== newState.slot1.content ||
      initialState.slot1.epromFile !== newState.slot1.file ||
      initialState.slot2.content !== newState.slot2.content ||
      initialState.slot2.epromFile !== newState.slot2.file ||
      initialState.slot3.content !== newState.slot3.content ||
      initialState.slot3.epromFile !== newState.slot3.file
    );
  }

  function slotStateValid (): boolean {
    return (
      (newState.slot1.isValid ?? true) &&
      (newState.slot2.isValid ?? true) &&
      (newState.slot3.isValid ?? true)
    );
  }

  async function applyCardStateChange (): Promise<void> {
    // --- Save the new change
    const machineConfig = store.getState().emulatorState.config ?? {};
    store.dispatch(
      setMachineConfigAction({ ...machineConfig, ...newState }),
      messageSource
    );

    // TODO: Apply the card state change
    let changed = false;
    let useSoftReset = true;
  }
};

type CardColumnProps = {
  slot: number;
  initialState?: SlotState;
  changed?: (newState: SlotState) => void;
};

const CardData = ({ slot, initialState, changed }: CardColumnProps) => {
  const { messenger } = useRendererContext();
  const [slotState, setSlotState] = useState<SlotState>(initialState);
  const [cardTypes, setCardTypes] = useState<OptionProps[]>([]);

  useEffect(() => {
    if (!initialState) return;
    setSlotState(initialState);
    setCardTypes(getCardTypes(initialState.size));
  }, [initialState]);

  const hasNewState = () =>
    slotState.size !== initialState.size ||
    slotState.content !== initialState.content ||
    slotState.file !== initialState.file;

  const isValidState = (st: SlotState) => st.size && st.content !== "-";

  const getCardTypes = (size: string) => {
    return cardTypeOptions.filter(
      co => !!size && (!co.dependsOn || co.dependsOn.includes(size))
    );
  };

  return (
    <div className={styles.column}>
      <div className={styles.labelRow}>
        <div className={styles.slotLabel}>Slot {slot}</div>
        <Icon
          iconName={hasNewState() ? "circle-filled" : "empty-icon"}
          fill={
            slotState.isValid
              ? "--color-text-hilite"
              : "--console-ansi-bright-red"
          }
          width={16}
          height={16}
        />
        {slotState.file && (
          <Filename
            file={slotState.file}
            size={slotState.size}
            changed={async (name: string) => {
              const newSlotState: SlotState = {
                ...slotState,
                file: name
              };
              setSlotState(newSlotState);
              changed?.(newSlotState);
            }}
          />
        )}
      </div>
      <div className={styles.row}>
        <Dropdown
          placeholder='Size...'
          options={cardSizeOptions}
          value={slotState.size}
          width={100}
          onSelectionChanged={async option => {
            // --- Back if size is the same
            if (option === slotState.content) return;

            // --- Prepare the new slot record
            const newSlotState: SlotState = {
              ...slotState,
              size: option
            };

            const newCardTypes = getCardTypes(option);
            if (slotState.size !== newSlotState.size) {
              // --- This is a new size
              const newCard = newCardTypes.find(
                ct => ct.value === slotState.content
              );
              if (!newCard || newCard.hasContent) {
                // --- The old content is not valid for the new size
                newSlotState.content = "-";
                delete newSlotState.file;
              }
            }
            setCardTypes(getCardTypes(option));

            // --- Now, validate the slot again
            newSlotState.isValid = isValidState(newSlotState);
            setSlotState(newSlotState);
            changed?.(newSlotState);
          }}
        />
        {slotState.size && slotState.size !== "-" && (
          <>
            <LabelSeparator width={16} />
            <Dropdown
              placeholder='Type...'
              options={cardTypes}
              value={slotState.content}
              width={180}
              onSelectionChanged={async option => {
                if (option === slotState.content) return;
                const card = cardTypeOptions.find(ct => ct.value === option);
                let filename: string | undefined;
                if (card?.hasContent) {
                  await delay(10);
                  filename = await getCardFile(messenger, slotState.size);
                  if (!filename) {
                    return true;
                  }
                }
                const newSlotState: SlotState = {
                  ...slotState,
                  content: option,
                  file: filename
                };

                // --- Now, validate the slot again
                newSlotState.isValid = isValidState(newSlotState);
                setSlotState(newSlotState);
                changed?.(newSlotState);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

async function getCardFile (
  messenger: MessengerBase,
  size: string
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
    // --- Check the selected file
    const expectedSize = cardSizeOptions.find(
      co => co.value === size
    )?.physicalSize;
    const checkResponse = await messenger.sendMessage({
      type: "MainCheckZ88Card",
      path: response.file,
      expectedSize
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

type FileNameProps = {
  file?: string;
  size: string;
  changed: (name: string) => void;
};

const Filename = ({ file, size, changed }: FileNameProps) => {
  const { messenger } = useRendererContext();
  return (
    <div
      className={styles.filenameRow}
      style={{ cursor: file ? "pointer" : undefined }}
      onClick={async () => {
        if (!file) return;
        const filename = await getCardFile(messenger, size);
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
 * State of a particular slot
 */
export type SlotState = {
  size: string;
  content: string;
  file?: string;
  isValid?: boolean;
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
