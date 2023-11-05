import styles from "./ExportCodeDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@controls/Dropdown";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogRow } from "@renderer/controls/DialogRow";
import { getNodeExtension, getNodeName } from "../project/project-node";
import { useAppServices } from "../services/AppServicesProvider";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";

const EXPORT_CODE_FOLDER_ID = "exportCodeFolder";
const VALID_INTEGER = /^\d+$/;

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
  const {
    outputPaneService,
    ideCommandsService,
    validationService
  } = useAppServices();
  const modalApi = useRef<ModalApi>(null);
  const [formatId, setFormatId] = useState("tzx");
  const [exportFolder, setExportFolder] = useState("");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [exportName, setExportName] = useState("");
  const [exportIsValid, setExportIsValid] = useState(true);
  const [programName, setProgramName] = useState("");
  const [borderId, setBorderId] = useState("none");
  const [screenFilename, setScreenFilename] = useState("");
  const [screenFileIsValid, setScreenFileIsValid] = useState(true);
  const [startAddress, setStartAddress] = useState("");
  const [startAddressIsValid, setStartAddressIsValid] = useState(true);
  const [startBlock, setStartBlock] = useState(true);
  const [addPause, setAddPause] = useState(false);
  const [addClear, setAddClear] = useState(true);
  const [singleBlock, setSingleBlock] = useState(false);

  useEffect(() => {
    const fValid = validationService.isValidPath(exportFolder);
    setFolderIsValid(fValid);
    const nValid = validationService.isValidFilename(exportName);
    setExportIsValid(nValid);
    const addressValid =
      startAddress.trim() === "" || VALID_INTEGER.test(startAddress);
    setStartAddressIsValid(addressValid);
    const scrValid = validationService.isValidPath(screenFilename);
    setScreenFileIsValid(scrValid);
    modalApi.current.enablePrimaryButton(
      fValid && nValid && addressValid && scrValid
    );
  }, [exportFolder, exportName, startAddress, screenFilename]);

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
      onPrimaryClicked={async () => {
        // --- Dialog can be closed
        let filename = exportName;
        let exportExt = getNodeExtension(exportName);
        if (!exportExt || exportExt === ".") {
          filename += `.${formatId}`;
        }
        const fullFilename = exportFolder
          ? `${exportFolder}/${filename}`
          : filename;
        const name = programName ? programName : getNodeName(exportName);
        const command = `expc ${fullFilename} -n ${name} -f ${formatId}${
          startBlock ? " -as" : ""
        }${addPause ? " -p" : ""}${
          borderId !== "none" ? ` -b ${borderId}` : ""
        }${singleBlock ? " -sb" : ""}${
          startAddress ? ` -addr ${startAddress}` : ""
        }${addClear ? " -c" : ""}${
          screenFilename ? ` -scr "${screenFilename}"` : ""
        }`;
        console.log(command);
        const buildPane = outputPaneService.getOutputPaneBuffer("build");
        const result = await ideCommandsService.executeCommand(
          command,
          buildPane
        );
        if (result.success) {
          const response = await messenger.sendMessage({
            type: "MainDisplayMessageBox",
            messageType: "info",
            title: "Exporting code",
            message: result.finalMessage ?? "Code successfully exported."
          });
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `MainDisplayMessagBox call failed: ${response.message}`
            );
          }
        } else {
          const response = await messenger.sendMessage({
            type: "MainDisplayMessageBox",
            messageType: "error",
            title: "Exporting code",
            message: result.finalMessage ?? "Code export failed."
          });
          if (response.type === "ErrorResponse") {
            reportMessagingError(
              `MainDisplayMessagBox call failed: ${response.message}`
            );
          }
        }
        return !result.success;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label='Export format:'>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder='Select...'
            options={formatIds}
            value={"tzx"}
            onSelectionChanged={option => setFormatId(option)}
          />
        </div>
      </DialogRow>
      <DialogRow label='Export folder:'>
        <TextInput
          value={exportFolder}
          isValid={folderIsValid}
          buttonIcon='folder'
          buttonTitle='Select the root project folder'
          buttonClicked={async () => {
            const response = await messenger.sendMessage({
              type: "MainShowOpenFolderDialog",
              settingsId: EXPORT_CODE_FOLDER_ID
            });
            if (response.type === "ErrorResponse") {
              reportMessagingError(
                `MainShowOpenFolderDialog call failed: ${response.message}`
              );
            } else if (response.type !== "MainShowOpenFolderDialogResponse") {
              reportUnexpectedMessageType(response.type);
            } else {
              if (response.folder) {
                setExportFolder(response.folder);
              }
              return response.folder;
            }
          }}
          valueChanged={val => {
            setExportFolder(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label='Export file name: *'>
        <TextInput
          value={exportName}
          isValid={exportIsValid}
          focusOnInit={true}
          valueChanged={val => {
            setExportName(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label='Program name:'>
        <TextInput
          value={programName}
          width={100}
          maxLength={10}
          isValid={true}
          valueChanged={val => {
            setProgramName(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label='Startup border:'>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder='Select...'
            options={borderIds}
            value={"none"}
            onSelectionChanged={option => setBorderId(option)}
          />
        </div>
      </DialogRow>
      <DialogRow label='Screen file:'>
        <TextInput
          value={screenFilename}
          isValid={screenFileIsValid}
          buttonIcon='file-code'
          buttonTitle='Select the screen file'
          buttonClicked={async () => {
            const response = await messenger.sendMessage({
              type: "MainShowOpenFileDialog",
              settingsId: EXPORT_CODE_FOLDER_ID
            });
            if (response.type === "ErrorResponse") {
              reportMessagingError(
                `MainShowOpenFolderDialog call failed: ${response.message}`
              );
            } else if (response.type !== "MainShowOpenFileDialogResponse") {
              reportUnexpectedMessageType(response.type);
            } else {
              if (response.file) {
                setScreenFilename(response.file);
              }
              return response.file;
            }
          }}
          valueChanged={val => {
            setScreenFilename(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow rows={true}>
        <Checkbox
          initialValue={startBlock}
          right={true}
          label='Create startup block'
          onChange={v => setStartBlock(v)}
        />
        <Checkbox
          initialValue={addClear}
          right={true}
          label='Add CLEAR'
          onChange={v => setAddClear(v)}
          enabled={startBlock}
        />
        <Checkbox
          initialValue={addPause}
          right={true}
          label='Add PAUSE 0'
          onChange={v => setAddPause(v)}
          enabled={startBlock}
        />
        <Checkbox
          initialValue={singleBlock}
          right={true}
          label='Use a single code block'
          onChange={v => setSingleBlock(v)}
          enabled={startBlock}
        />
      </DialogRow>
      <DialogRow label='Code start address:'>
        <TextInput
          value={startAddress.toString()}
          maxLength={5}
          width={60}
          isValid={startAddressIsValid}
          valueChanged={val => {
            setStartAddress(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
