import styles from "./ExportCodeDialog.module.scss";
import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useState } from "react";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { useMainApi } from "@renderer/core/MainApi";
import Dropdown from "@renderer/controls/Dropdown";
import { useDispatch, useRendererContext } from "@renderer/core/RendererProvider";
import { incProjectFileVersionAction, setExportDialogInfoAction } from "@common/state/actions";
import { DialogForm } from "@renderer/controls/DialogForm";
import { decimalAddress, optionalPath, requiredFilename } from "./dialogValidators";
import { buildExportCodeCommand } from "./exportCodeCommand";

const EXPORT_CODE_FOLDER_ID = "exportCodeFolder";

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
  onExport?: (result: ExportCodeDialogResult) => Promise<void> | void;
};

export type ExportCodeDialogResult = {
  command: string;
  fullFilename: string;
  formatId: string;
  exportName: string;
  exportFolder: string;
  programName: string;
  startAddress: string;
};

export const ExportCodeDialog = ({ onClose, onExport }: Props) => {
  const dispatch = useDispatch();
  const { store } = useRendererContext();
  const exportSettings = store.getState()?.project?.exportSettings ?? {};
  const mainApi = useMainApi();
  const { outputPaneService, ideCommandsService, validationService } = useAppServices();
  const [formatId, setFormatId] = useState(exportSettings.formatId ?? "tzx");
  const [exportFolder, setExportFolder] = useState(exportSettings?.exportFolder ?? "");
  const [exportName, setExportName] = useState(exportSettings?.exportName ?? "");
  const [programName, setProgramName] = useState(exportSettings?.programName ?? "");
  const [borderId, setBorderId] = useState(exportSettings?.border?.toString() ?? "none");
  const [screenFilename, setScreenFilename] = useState(exportSettings?.screenFilename ?? "");
  const [startAddress, setStartAddress] = useState(exportSettings?.startAddress?.toString() ?? "");
  const [startBlock, setStartBlock] = useState(exportSettings?.startBlock ?? true);
  const [addPause, setAddPause] = useState(exportSettings?.addPause ?? false);
  const [addClear, setAddClear] = useState(exportSettings?.addClear ?? true);
  const [singleBlock, setSingleBlock] = useState(exportSettings?.singleBlock ?? false);

  const folderError = optionalPath(validationService, exportFolder);
  const exportError = requiredFilename(validationService, exportName);
  const screenFileError = optionalPath(validationService, screenFilename);
  const startAddressError = decimalAddress(startAddress);

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

  const canExport = !folderError && !exportError && !startAddressError && !screenFileError;

  const exportCode = async (): Promise<boolean> => {
    // --- Dialog can be closed
    const { command, fullFilename } = buildExportCodeCommand({
      addClear, addPause, borderId, exportFolder, exportName, formatId, programName,
      screenFilename, singleBlock, startAddress, startBlock
    });
    const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
    const result = await ideCommandsService.executeCommand(command, buildPane);
    if (result.success) {
      await mainApi.displayMessageBox(
        "info",
        "Exporting code",
        result.finalMessage ?? "Code successfully exported."
      );
      await onExport?.({
        command,
        fullFilename,
        formatId,
        exportName,
        exportFolder,
        programName,
        startAddress
      });
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
  };

  return (
    <Modal
      title="Export Code"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      footerVisible={false}
      onClose={() => {
        onClose();
      }}
    >
      <DialogForm
        submitLabel="Export"
        submitDisabled={!canExport}
        onSubmit={async () => {
          if (!(await exportCode())) onClose();
        }}
        onCancel={onClose}
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
          error={folderError}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          browse={() => mainApi.showOpenFolderDialog(EXPORT_CODE_FOLDER_ID)}
          onChange={setExportFolder}
        />
      </DialogRow>
      <DialogRow label="Export file name: *">
        <TextInput
          value={exportName}
          error={exportError}
          autoFocus={true}
          onChange={setExportName}
        />
      </DialogRow>
      <DialogRow label="Program name:">
        <TextInput
          value={programName}
          width={100}
          maxLength={10}
          onChange={setProgramName}
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
              error={screenFileError}
              buttonIcon="file-code"
              buttonTitle="Select the screen file"
              browse={() => mainApi.showOpenFileDialog(
                  [
                    { name: "Tape files", extensions: ["tap", "tzx"] },
                    { name: "Screen files", extensions: ["scr"] },
                    { name: "All Files", extensions: ["*"] }
                  ],
                  EXPORT_CODE_FOLDER_ID
                )}
              onChange={setScreenFilename}
            />
          </DialogRow>
          <DialogRow label="Code start address:">
            <TextInput
              value={startAddress.toString()}
              maxLength={5}
              width={60}
              numberOnly
              error={startAddressError}
              onChange={setStartAddress}
            />
          </DialogRow>
        </>
      )}
      </DialogForm>
    </Modal>
  );
};
