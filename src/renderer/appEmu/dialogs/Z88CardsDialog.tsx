import styles from "./Z88CardsDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { Icon } from "@renderer/controls/Icon";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useEffect, useRef, useState } from "react";
import { delay } from "@renderer/utils/timing";
import { setMachineConfigAction } from "@common/state/actions";
import { MC_Z88_SLOT1, MC_Z88_SLOT2, MC_Z88_SLOT3 } from "@common/machines/constants";
import { LabelSeparator } from "@renderer/controls/Labels";
import {
  CARD_SIZE_128K,
  CARD_SIZE_1M,
  CARD_SIZE_32K,
  CARD_SIZE_512K,
  CARD_SIZE_EMPTY,
  CT_EPROM,
  CT_INTEL_FLASH,
  CT_RAM,
  CT_ROM
} from "@emu/machines/z88/memory/CardType";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { IMachineController } from "@renderer/abstractions/IMachineController";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MainApi } from "@common/messaging/MainApi";
import { useMainApi } from "@renderer/core/MainApi";

// --- ID of the open file dialog path
const Z88_CARDS_FOLDER_ID = "z88CardsFolder";

type OptionProps = {
  label: string;
  value: string;
  dependsOn?: string[];
  hasContent?: boolean;
};

const cardSizeOptions = [
  { value: CARD_SIZE_EMPTY, label: "(empty)", physicalSize: 0 },
  { value: CARD_SIZE_32K, label: "32K", physicalSize: 32 * 1024 },
  { value: CARD_SIZE_128K, label: "128K", physicalSize: 128 * 1024 },
  { value: CARD_SIZE_512K, label: "512K", physicalSize: 512 * 1024 },
  { value: CARD_SIZE_1M, label: "1M", physicalSize: 1024 * 1024 }
];

const cardTypeOptions: OptionProps[] = [
  { value: CT_RAM, label: "RAM" },
  { value: CT_ROM, label: "ROM", hasContent: true },
  {
    value: CT_EPROM,
    label: "Eprom",
    dependsOn: ["32K", "128K"],
    hasContent: true
  },
  {
    value: CT_INTEL_FLASH,
    label: "Intel Flash",
    dependsOn: ["512K", "1M"],
    hasContent: true
  }
];

type Props = {
  onClose: () => void;
};

export const Z88CardsDialog = ({ onClose }: Props) => {
  const { machineService } = useAppServices();
  const modalApi = useRef<ModalApi>(null);
  const { store, messageSource } = useRendererContext();
  const machineConfig = store.getState().emulatorState?.config ?? {};
  const initialState = {
    [MC_Z88_SLOT1]: machineConfig[MC_Z88_SLOT1] ?? { size: CARD_SIZE_EMPTY },
    [MC_Z88_SLOT2]: machineConfig[MC_Z88_SLOT2] ?? { size: CARD_SIZE_EMPTY },
    [MC_Z88_SLOT3]: machineConfig[MC_Z88_SLOT3] ?? { size: CARD_SIZE_EMPTY }
  };
  const [newState, setNewState] = useState<Z88CardsState>(initialState as Z88CardsState);
  const [saveEnabled, setSaveEnabled] = useState(false);

  useEffect(() => {
    setSaveEnabled(slotStateValid());
  }, [newState]);

  return (
    <Modal
      title="Insert or Remove Z88 Cards"
      isOpen={true}
      fullScreen={false}
      width={600}
      onApiLoaded={(api) => (modalApi.current = api)}
      initialFocus="cancel"
      primaryEnabled={saveEnabled}
      onPrimaryClicked={async () => {
        if (hasCardConfigChanged()) {
          applyCardStateChange(machineService.getMachineController());
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
            changed={(ns) => {
              setNewState({ ...newState, slot1: ns });
            }}
          />
          <CardData
            slot={2}
            initialState={initialState.slot2}
            changed={(ns) => {
              setNewState({ ...newState, slot2: ns });
            }}
          />
          <CardData
            slot={3}
            initialState={initialState.slot3}
            changed={(ns) => {
              setNewState({ ...newState, slot3: ns });
            }}
          />
        </div>
      </DialogRow>
    </Modal>
  );

  function hasCardConfigChanged(): boolean {
    return (
      hasSlotChanged(initialState.slot1, newState.slot1) ||
      hasSlotChanged(initialState.slot2, newState.slot2) ||
      hasSlotChanged(initialState.slot3, newState.slot3)
    );

    function hasSlotChanged(a: SlotState, b: SlotState): boolean {
      return a.size !== b.size || a.content !== b.content || a.file !== b.file;
    }
  }

  function slotStateValid(): boolean {
    return (
      isValidSlot(newState.slot1) && isValidSlot(newState.slot2) && isValidSlot(newState.slot3)
    );
  }

  async function applyCardStateChange(controller: IMachineController): Promise<void> {
    // --- Save the new change
    const machineConfig = store.getState().emulatorState.config ?? {};
    store.dispatch(setMachineConfigAction({ ...machineConfig, ...newState }), messageSource);

    const machine = controller.machine as IZ88Machine;
    machine.dynamicConfig = newState;
    if (controller.state === MachineControllerState.Running) {
      machine.signalFlapOpened();
      await delay(1000);
      await machine.configure();
      machine.signalFlapClosed();
    }
    //store.dispatch(setMachineConfigAction({...machine.config ?? {}}), messageSource);
  }
};

type CardColumnProps = {
  slot: number;
  initialState?: SlotState;
  changed?: (newState: SlotState) => void;
};

const CardData = ({ slot, initialState, changed }: CardColumnProps) => {
  const mainApi = useMainApi();
  const [slotState, setSlotState] = useState<SlotState>(initialState);

  const getCardTypes = (size: string) => {
    return cardTypeOptions.filter((co) => !!size && (!co.dependsOn || co.dependsOn.includes(size)));
  };

  const [cardTypes, setCardTypes] = useState<OptionProps[]>(getCardTypes(initialState.size));

  const hasNewState = () =>
    slotState.size !== initialState.size ||
    slotState.content !== initialState.content ||
    slotState.file !== initialState.file;

  return (
    <div className={styles.column}>
      <div className={styles.labelRow}>
        <div className={styles.slotLabel}>Slot {slot}</div>
        <Icon
          iconName={hasNewState() ? "circle-filled" : "empty-icon"}
          fill={isValidSlot(slotState) ? "--color-text-hilite" : "--console-ansi-bright-red"}
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
          placeholder="Size..."
          options={cardSizeOptions}
          value={slotState.size}
          width={100}
          onSelectionChanged={async (option) => {
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
              const newCard = newCardTypes.find((ct) => ct.value === slotState.content);
              if (!newCard || newCard.hasContent) {
                // --- The old content is not valid for the new size
                delete newSlotState.content;
                delete newSlotState.file;
              }
            }
            setCardTypes(newCardTypes);

            // --- Now, validate the slot again
            setSlotState(newSlotState);
            changed?.(newSlotState);
          }}
        />
        {slotState.size && slotState.size !== CARD_SIZE_EMPTY && (
          <>
            <LabelSeparator width={16} />
            <Dropdown
              placeholder="Type..."
              options={cardTypes}
              value={slotState.content}
              width={180}
              onSelectionChanged={async (option) => {
                if (option === slotState.content) return false;
                const card = cardTypeOptions.find((ct) => ct.value === option);
                let filename: string | undefined;
                if (card?.hasContent) {
                  await delay(10);
                  filename = await getCardFile(mainApi, slotState.size);
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
                setSlotState(newSlotState);
                changed?.(newSlotState);

                return false;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

async function getCardFile(mainApiAlt: MainApi, size: string): Promise<string | undefined> {
  const file = await mainApiAlt.showOpenFileDialog(
    [
      { name: "ROM files", extensions: ["bin", "rom", "epr"] },
      { name: "EPROM files", extensions: ["epr"] },
      { name: "All Files", extensions: ["*"] }
    ],
    Z88_CARDS_FOLDER_ID
  );

  // --- Check the selected file
  const expectedSize = cardSizeOptions.find((co) => co.value === size)?.physicalSize;
  const checkResponse = await mainApiAlt.checkZ88Card(file, expectedSize);

  // --- Result of test
  if (checkResponse.content) {
    return file;
  } else if (checkResponse.message) {
    mainApiAlt.displayMessageBox("error", "Invalid Z88 Card", checkResponse.message);
    return null;
  }
  return file;

  return null;
}

type FileNameProps = {
  file?: string;
  size: string;
  changed: (name: string) => void;
};

const Filename = ({ file, size, changed }: FileNameProps) => {
  const mainApi = useMainApi();
  return (
    <div
      className={styles.filenameRow}
      style={{ cursor: file ? "pointer" : undefined }}
      onClick={async () => {
        if (!file) return;
        const filename = await getCardFile(mainApi, size);
        if (filename) changed?.(filename);
      }}
    >
      {file && <Icon iconName="file-code" width={20} height={20} />}
      {file && (
        <div className={styles.filename}>{file.startsWith("/") ? file.substring(1) : file}</div>
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

// --- Helper function to check if a slot state is valid
function isValidSlot(st: SlotState) {
  return st.size === CARD_SIZE_EMPTY || (st.size && !!st.content);
}
