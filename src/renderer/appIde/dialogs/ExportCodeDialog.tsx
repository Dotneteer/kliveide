import styles from "./ExportCodeDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogRow } from "@renderer/controls/DialogRow";
import { getNodeExtension, getNodeName } from "../project/project-node";
import { useAppServices } from "../services/AppServicesProvider";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { useMainApi } from "@renderer/core/MainApi";
import Dropdown from "@renderer/controls/Dropdown";
import { useDispatch, useRendererContext } from "@renderer/core/RendererProvider";
import { incProjectFileVersionAction, setExportDialogInfoAction } from "@common/state/actions";

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
    label: "Black"
  },
  {
    value: "1",
    label: "Blue"
  },
  {
    value: "2",
    label: "Red"
  },
  {
    value: "3",
    label: "Magenta"
  },
  {
    value: "4",
    label: "Green"
  },
  {
    value: "5",
    label: "Cyan"
  },
  {
    value: "6",
    label: "Yellow"
  },
  {
    value: "7",
    label: "White"
  }
];

type Props = {
  onClose: () => void;
  onExport: () => Promise<void>;
};

export const ExportCodeDialog = ({ onClose }: Props) => {
  const dispatch = useDispatch();
  const { store } = useRendererContext();
  const exportSettings = store.getState()?.project?.exportSettings ?? {};
  const mainApi = useMainApi();
  const { outputPaneService, ideCommandsService, validationService } = useAppServices();
  const modalApi = useRef<ModalApi>(null);
  const [formatId, setFormatId] = useState(exportSettings.formatId ?? "tzx");
  const [exportFolder, setExportFolder] = useState(exportSettings?.exportFolder ?? "");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [exportName, setExportName] = useState(exportSettings?.exportName ?? "");
  const [exportIsValid, setExportIsValid] = useState(true);
  const [programName, setProgramName] = useState(exportSettings?.programName ?? "");
  const [borderId, setBorderId] = useState(exportSettings?.border?.toString() ?? "none");
  const [screenFilename, setScreenFilename] = useState(exportSettings?.screenFilename ?? "");
  const [screenFileIsValid, setScreenFileIsValid] = useState(true);
  const [startAddress, setStartAddress] = useState(exportSettings?.startAddress?.toString() ?? "");
  const [startAddressIsValid, setStartAddressIsValid] = useState(true);
  const [startBlock, setStartBlock] = useState(exportSettings?.startBlock ?? true);
  const [addPause, setAddPause] = useState(exportSettings?.addPause ?? false);
  const [addClear, setAddClear] = useState(exportSettings?.addClear ?? true);
  const [singleBlock, setSingleBlock] = useState(exportSettings?.singleBlock ?? false);

  useEffect(() => {
    const fValid = validationService.isValidPath(exportFolder);
    setFolderIsValid(fValid);
    const nValid = validationService.isValidFilename(exportName);
    setExportIsValid(nValid);
    const addressValid = startAddress.trim() === "" || VALID_INTEGER.test(startAddress);
    setStartAddressIsValid(addressValid);
    const scrValid = validationService.isValidPath(screenFilename);
    setScreenFileIsValid(scrValid);
    modalApi.current.enablePrimaryButton(fValid && nValid && addressValid && scrValid);
  }, [exportFolder, exportName, startAddress, screenFilename]);

  // --- Save the dialog data whenever it changes
  useEffect(() => {
    let border: number | undefined = parseInt(borderId, 10);
    if (isNaN(border)) border = undefined;
    dispatch(
      setExportDialogInfoAction({
        formatId,
        exportName,
        exportFolder,
        programName,
        border,
        screenFilename,
        startBlock,
        addClear,
        addPause,
        singleBlock,
        startAddress
      })
    );
    (async () => {
      await mainApi.saveProject();
      dispatch(incProjectFileVersionAction());
    })();
  }, [
    formatId,
    exportFolder,
    exportName,
    programName,
    borderId,
    screenFilename,
    startAddress,
    startBlock,
    addPause,
    addClear,
    singleBlock
  ]);

  return (
    <Modal
      title="Export Code"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      onApiLoaded={(api) => (modalApi.current = api)}
      primaryLabel="Export"
      primaryEnabled={true}
      initialFocus="none"
      onPrimaryClicked={async () => {
        // --- Dialog can be closed
        let filename = exportName;
        let exportExt = getNodeExtension(exportName);
        if (!exportExt || exportExt === ".") {
          filename += `.${formatId}`;
        }
        const fullFilename = (exportFolder ? `${exportFolder}/${filename}` : filename).replaceAll(
          "\\",
          "/"
        );
        const name = programName ? programName : getNodeName(exportName);
        const command = `expc "${fullFilename}" -n ${name} -f ${formatId}${
          startBlock ? " -as" : ""
        }${addPause ? " -p" : ""}${
          borderId !== "none" ? ` -b ${borderId}` : ""
        }${singleBlock ? " -sb" : ""}${
          startAddress ? ` -addr ${startAddress}` : ""
        }${addClear ? " -c" : ""}${screenFilename ? ` -scr "${screenFilename.replaceAll("\\", "/")}"` : ""}`;
        const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
        console.log("export command:", command);
        const result = await ideCommandsService.executeCommand(command, buildPane);
        if (result.success) {
          await mainApi.displayMessageBox(
            "info",
            "Exporting code",
            result.finalMessage ?? "Code successfully exported."
          );
        } else {
          // --- Analyze the message and
          let message = result.finalMessage;
          if (message.includes("-addr")) {
            message = "Code start address must be between 16384 and 65535.";
          } else {
            // --- Other messages
          }
          await mainApi.displayMessageBox(
            "error",
            "Exporting code",
            message ?? result.finalMessage ?? "Code export failed"
          );
        }
        return !result.success;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label="Export format:">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={formatIds}
            initialValue={formatId}
            width={140}
            onChanged={(option) => setFormatId(option)}
          />
        </div>
      </DialogRow>
      <DialogRow label="Export folder:">
        <TextInput
          value={exportFolder}
          isValid={folderIsValid}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          buttonClicked={async () => {
            const folder = await mainApi.showOpenFolderDialog(EXPORT_CODE_FOLDER_ID);
            if (folder) {
              setExportFolder(folder);
            }
            return folder;
          }}
          valueChanged={(val) => {
            setExportFolder(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label="Export file name: *">
        <TextInput
          value={exportName}
          isValid={exportIsValid}
          focusOnInit={true}
          valueChanged={(val) => {
            setExportName(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label="Program name:">
        <TextInput
          value={programName}
          width={100}
          maxLength={10}
          isValid={true}
          valueChanged={(val) => {
            setProgramName(val);
            return false;
          }}
        />
      </DialogRow>
      {formatId !== "hex" && (
        <DialogRow rows={true}>
          <Checkbox
            initialValue={startBlock}
            right={true}
            label="Create BASIC loader"
            onChange={(v) => setStartBlock(v)}
          />
        </DialogRow>
      )}
      {formatId !== "hex" && startBlock && (
        <>
          <DialogRow label="Startup options:" />
          <DialogRow rows={true}>
            <Checkbox
              initialValue={addClear}
              right={true}
              label="Add CLEAR"
              onChange={(v) => setAddClear(v)}
              enabled={startBlock}
            />
            <Checkbox
              initialValue={addPause}
              right={true}
              label="Add PAUSE 0"
              onChange={(v) => setAddPause(v)}
              enabled={startBlock}
            />
            <Checkbox
              initialValue={singleBlock}
              right={true}
              label="Use a single code block"
              onChange={(v) => setSingleBlock(v)}
              enabled={startBlock}
            />
          </DialogRow>
          <DialogRow label="Set border color:">
            <div className={styles.dropdownWrapper}>
              <Dropdown
                placeholder="Select..."
                options={borderIds}
                initialValue={borderId}
                width={92}
                onChanged={(option) => setBorderId(option)}
              />
            </div>
          </DialogRow>
          <DialogRow label="Screen file:">
            <TextInput
              value={screenFilename}
              isValid={screenFileIsValid}
              buttonIcon="file-code"
              buttonTitle="Select the screen file"
              buttonClicked={async () => {
                const file = await mainApi.showOpenFileDialog(
                  [
                    { name: "Tape files", extensions: ["tap", "tzx"] },
                    { name: "Screen files", extensions: ["scr"] },
                    { name: "All Files", extensions: ["*"] }
                  ],
                  EXPORT_CODE_FOLDER_ID
                );
                if (file) {
                  setScreenFilename(file);
                }
                return file;
              }}
              valueChanged={(val) => {
                setScreenFilename(val);
                return false;
              }}
            />
          </DialogRow>
          <DialogRow label="Code start address:">
            <TextInput
              value={startAddress.toString()}
              maxLength={5}
              width={60}
              numberOnly
              isValid={startAddressIsValid}
              valueChanged={(val) => {
                setStartAddress(val);
                return false;
              }}
            />
          </DialogRow>
        </>
      )}
    </Modal>
  );
};
