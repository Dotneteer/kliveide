import styles from "./ExportCodeDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@controls/Dropdown";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { MainShowOpenFolderDialogResponse } from "@messaging/any-to-main";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogLabel } from "@renderer/controls/DialogLabel";

const EXPORT_CODE_FOLDER_ID = "expotCodeFolder";
const VALID_FILENAME = /^[^>:"/\\|?*]+$/;
const VALID_FOLDERNAME = /^[^>:"|?*]+$/;

const formatIds = [
  {
    value: "tap",
    label: "TAP format"
  },
  {
    value: "tzx",
    label: "TZX format"
  },
  {
    value: "hex",
    label: "Intel HEX format"
  }
];

const borderIds = [
  {
    value: "none",
    label: "None"
  },
  {
    value: "0",
    label: "black"
  },
  {
    value: "1",
    label: "blue"
  },
  {
    value: "2",
    label: "magenta"
  },
  {
    value: "3",
    label: "red"
  },
  {
    value: "4",
    label: "green"
  },
  {
    value: "5",
    label: "cyan"
  },
  {
    value: "6",
    label: "yellow"
  },
  {
    value: "7",
    label: "white"
  }
];

type Props = {
  onClose: () => void;
  onExport: () => Promise<void>;
};

export const ExportCodeDialog = ({ onClose, onExport }: Props) => {
  const { messenger } = useRendererContext();
  const modalApi = useRef<ModalApi>(null);
  const [formatId, setFormatId] = useState("tzx");
  const [exportFolder, setExportFolder] = useState("");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [exportName, setExportName] = useState("");
  const [exportIsValid, setExportIsValid] = useState(true);
  const [programName, setProgramName] = useState("");
  const [borderId, setBorderId] = useState("none");
  const [screenFileName, setScreenFileName] = useState("");
  const [screenFileIsValid, setScreenFileIsValid] = useState(true);
  const [startAddress, setStartAddress] = useState(32768);
  const [startAddressIsValid, setStartAddressIsValid] = useState(true);

  useEffect(() => {
    const fValid =
      exportFolder.trim() === "" || VALID_FOLDERNAME.test(exportFolder);
    const nValid = exportName.trim() !== "" && VALID_FILENAME.test(exportName);
    setFolderIsValid(fValid);
    setExportIsValid(nValid);
    modalApi.current.enablePrimaryButton(fValid && nValid);
  }, [exportFolder, exportName]);

  return (
    <Modal
      title='Export Code'
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={-100}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Export'
      primaryEnabled={true}
      initialFocus='none'
      onPrimaryClicked={async result => {
        // --- Dialog can be closed
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogLabel text="Export format:" />
      <div className={styles.dropdownWrapper}>
        <Dropdown
          placeholder='Select...'
          options={formatIds}
          value={"tzx"}
          onSelectionChanged={option => setFormatId(option)}
        />
      </div>
      <DialogLabel text="Export folder:" />
      <div className={styles.inputRow}>
        <TextInput
          value={exportFolder}
          isValid={folderIsValid}
          focusOnInit={true}
          buttonIcon='folder'
          buttonTitle='Select the root project folder'
          buttonClicked={async () => {
            const response = (await messenger.sendMessage({
              type: "MainShowOpenFolderDialog",
              settingsId: EXPORT_CODE_FOLDER_ID
            })) as MainShowOpenFolderDialogResponse;
            if (response.folder) {
              setExportFolder(response.folder);
            }
            return response.folder;
          }}
          valueChanged={val => {
            setExportFolder(val);
            return false;
          }}
        />
      </div>
      <DialogLabel text="Export file name:" />
      <TextInput
        value={exportName}
        isValid={exportIsValid}
        focusOnInit={true}
        keyPressed={e => {
          if (e.code === "Enter") {
            if (folderIsValid && exportIsValid) {
              e.preventDefault();
              e.stopPropagation();
              modalApi.current.triggerPrimary([exportName, exportFolder]);
            }
          }
        }}
        valueChanged={val => {
          setExportName(val);
          return false;
        }}
      />
      <DialogLabel text="Program name:" />
      <TextInput
        value={programName}
        maxLength={10}
        isValid={true}
        focusOnInit={true}
        valueChanged={val => {
          setProgramName(val);
          return false;
        }}
      />
      <DialogLabel text="Startup border:" />
      <div className={styles.dropdownWrapper}>
        <Dropdown
          placeholder='Select...'
          options={borderIds}
          value={"none"}
          onSelectionChanged={option => setBorderId(option)}
        />
      </div>
      <DialogLabel text="Screen file:" />
      <div className={styles.inputRow}>
        <TextInput
          value={screenFileName}
          isValid={screenFileIsValid}
          focusOnInit={true}
          buttonIcon='file-code'
          buttonTitle='Select the screen file'
          buttonClicked={async () => {
            const response = (await messenger.sendMessage({
              type: "MainShowOpenFolderDialog",
              settingsId: EXPORT_CODE_FOLDER_ID
            })) as MainShowOpenFolderDialogResponse;
            if (response.folder) {
              setScreenFileName(response.folder);
            }
            return response.folder;
          }}
          valueChanged={val => {
            setScreenFileName(val);
            return false;
          }}
        />
      </div>
      <div className={styles.inputRow}>
        <Checkbox initialValue={true} right={true} label="Use a single code block" />
      </div>
      <div className={styles.inputRow}>
        <Checkbox initialValue={true} right={true} label="Add CLEAR" />
      </div>
      <div className={styles.inputRow}>
        <Checkbox initialValue={true} right={true} label="Add PAUSE 0" />
      </div>
      <DialogLabel text="Code start address:" />
      <TextInput
        value={startAddress.toString()}
        maxLength={10}
        isValid={true}
        focusOnInit={true}
        valueChanged={val => {
          setStartAddress(parseInt(val, 10));
          return false;
        }}
      />
    </Modal>
  );
};
