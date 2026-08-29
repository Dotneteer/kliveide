import styles from "./CreateDiskDialog.module.scss";
import { Modal } from "@controls/Modal";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { TextInput } from "@renderer/controls/TextInput";
import { DialogForm } from "@renderer/controls/DialogForm";
import { useMainApi } from "@renderer/core/MainApi";
import { useState } from "react";
import { requiredFilename, requiredPath } from "@renderer/appIde/dialogs/dialogValidators";

const NEW_DISK_FOLDER_ID = "newDiskFolder";

const diskTypesIds = [
  { value: "ss", label: "Single-sided CPC (180K)" },
  { value: "ds", label: "Double-sided CPC (360K)" },
  { value: "sse", label: "Single-sided ECPC (180K)" },
  { value: "dse", label: "Double-sided ECPC (360K)" }
];

type Props = {
  onClose: () => void;
  onCreate?: (result: CreateDiskDialogResult) => void;
};

export type CreateDiskDialogResult = {
  diskType: string;
  folder: string;
  filename: string;
  path: string;
};

export const CreateDiskDialog = ({ onClose, onCreate }: Props) => {
  const mainApi = useMainApi();
  const { validationService } = useAppServices();

  const [diskType, setDiskType] = useState<string>("ss");
  const [diskFileFolder, setDiskFileFolder] = useState("");
  const [filename, setFilename] = useState("");
  const folderError = requiredPath(validationService, diskFileFolder);
  const fileError = requiredFilename(validationService, filename);

  const createDisk = async (): Promise<boolean> => {
    // --- Create the project
    try {
      const path = await mainApi.createDiskFile(diskFileFolder, filename, diskType);
      await mainApi.displayMessageBox(
        "info",
        "Disk created",
        `Disk file successfully created: ${path}`
      );
      onCreate?.({ diskType, folder: diskFileFolder, filename, path });
      return false;
    } catch (err) {
      await mainApi.displayMessageBox("error", "Create Disk File Error", err.toString());
      return true;
    }
  };

  return (
    <Modal
      title="Create a new disk file"
      isOpen={true}
      fullScreen={false}
      translateY={0}
      width={500}
      footerVisible={false}
      onClose={() => {
        onClose();
      }}
    >
      <DialogForm
        submitLabel="Create"
        submitDisabled={Boolean(folderError || fileError)}
        onSubmit={async () => {
          if (!(await createDisk())) onClose();
        }}
        onCancel={onClose}
      >
      <DialogRow rows={true} label="Disk type">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={diskTypesIds}
            initialValue={"ss"}
            width={200}
            onChanged={(option) => {
              setDiskType(option);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Disk file folder:">
        <TextInput
          value={diskFileFolder}
          error={folderError}
          autoFocus={true}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          browse={() => mainApi.showOpenFolderDialog(NEW_DISK_FOLDER_ID)}
          onChange={setDiskFileFolder}
        />
      </DialogRow>
      <DialogRow label="Project name:">
        <TextInput
          value={filename}
          error={fileError}
          onChange={setFilename}
        />
      </DialogRow>
      </DialogForm>
    </Modal>
  );
};
