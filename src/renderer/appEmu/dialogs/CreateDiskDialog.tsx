import styles from "./CreateDiskDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { TextInput } from "@renderer/controls/TextInput";
import { useMainApi } from "@renderer/core/MainApi";
import { useEffect, useRef, useState } from "react";

const NEW_DISK_FOLDER_ID = "newDiskFolder";

const diskTypesIds = [
  { value: "ss", label: "Single-sided CPC (180K)" },
  { value: "ds", label: "Double-sided CPC (360K)" },
  { value: "sse", label: "Single-sided ECPC (180K)" },
  { value: "dse", label: "Double-sided ECPC (360K)" }
];

type Props = {
  onClose: () => void;
};

export const CreateDiskDialog = ({ onClose }: Props) => {
  const modalApi = useRef<ModalApi>(null);
  const mainApi = useMainApi();
  const { validationService } = useAppServices();

  const [diskType, setDiskType] = useState<string>("ss");
  const [diskFileFolder, setDiskFileFolder] = useState("");
  const [filename, setFilename] = useState("");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [fileIsValid, setFileIsValid] = useState(true);

  useEffect(() => {
    const fValid = validationService.isValidPath(diskFileFolder);
    setFolderIsValid(fValid);
    const nValid = validationService.isValidFilename(filename);
    setFileIsValid(nValid);
    modalApi.current.enablePrimaryButton(fValid && nValid);
  }, [diskFileFolder, filename]);

  return (
    <Modal
      title="Create a new disk file"
      isOpen={true}
      fullScreen={false}
      translateY={0}
      width={500}
      onApiLoaded={(api) => (modalApi.current = api)}
      primaryLabel="Create"
      primaryEnabled={true}
      initialFocus="none"
      onPrimaryClicked={async (result) => {
        const name = result ? result[0] : filename;
        const folder = result ? result[1] : diskFileFolder;
        // --- Create the project
        try {
          const path = await mainApi.createDiskFile(folder, name, diskType);
          await mainApi.displayMessageBox(
            "info",
            "Disk created",
            `Disk file successfully created: ${path}`
          );
          return false;
        } catch (err) {
          await mainApi.displayMessageBox("error", "Create Disk File Error", err.toString());
          return true;
        }
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow rows={true} label="Disk type">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={diskTypesIds}
            value={"ss"}
            width={240}
            onSelectionChanged={(option) => {
              setDiskType(option);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Disk file folder:">
        <TextInput
          value={diskFileFolder}
          isValid={folderIsValid}
          focusOnInit={true}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          buttonClicked={async () => {
            const folder = await mainApi.showOpenFolderDialog(NEW_DISK_FOLDER_ID);
            if (folder) {
              setDiskFileFolder(folder);
            }
            return folder;
          }}
          valueChanged={(val) => {
            setDiskFileFolder(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label="Project name:">
        <TextInput
          value={filename}
          isValid={fileIsValid}
          focusOnInit={true}
          keyPressed={(e) => {
            if (e.code === "Enter") {
              if (folderIsValid && fileIsValid) {
                e.preventDefault();
                e.stopPropagation();
                modalApi.current.triggerPrimary([filename, diskFileFolder]);
              }
            }
          }}
          valueChanged={(val) => {
            setFilename(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
