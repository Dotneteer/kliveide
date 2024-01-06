import styles from "./CreateDiskDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { TextInput } from "@renderer/controls/TextInput";
import { useRendererContext } from "@renderer/core/RendererProvider";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { useEffect, useRef, useState } from "react";

const NEW_DISK_FOLDER_ID = "newDiskFolder";

const diskTypesIds = [
  { value: "cpc-s", label: "Single-sided CPC (180K)" },
  { value: "cpc-d", label: "Double-sided CPC (360K)" },
  { value: "cpce-s", label: "Single-sided ECPC (180K)" },
  { value: "cpce-d", label: "Double-sided ECPC (360K)" }
];

type Props = {
  onClose: () => void;
  onCreate: (name: string, format: string) => Promise<void>;
};

export const CreateDiskDialog = ({ onClose, onCreate }: Props) => {
  const modalApi = useRef<ModalApi>(null);
  const { messenger } = useRendererContext();
  const { validationService } = useAppServices();

  const [diskType, setDiskType] = useState<string>("cpc-d");
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
      title='Create a new disk file'
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Create'
      primaryEnabled={true}
      initialFocus='none'
      onPrimaryClicked={async result => {
        const name = result ? result[0] : filename;
        const folder = result ? result[1] : diskFileFolder;
        // --- Create the project
        const response = await messenger.sendMessage({
          type: "MainCreateDiskFile",
          diskFolder: folder,
          filename: name,
          diskType
        });
        if (response.type === "ErrorResponse") {
          reportMessagingError(
            `MainCreateDiskFile call failed: ${response.message}`
          );
        } else if (response.type !== "MainCreateDiskFileResponse") {
          reportUnexpectedMessageType(response.type);
        } else {
          if (response.errorMessage) {
            // --- Display the error
            const dlgResponse = await messenger.sendMessage({
              type: "MainDisplayMessageBox",
              messageType: "error",
              title: "Create Disk File Error",
              message: response.errorMessage
            });
            if (dlgResponse.type === "ErrorResponse") {
              reportMessagingError(
                `MainDisplayMessaBox call failed: ${dlgResponse.message}`
              );
            }

            // --- Keep the dialog open
            return true;
          }

          // --- Close the dialog
          return false;
        }
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow rows={true} label='Disk type'>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder='Select...'
            options={diskTypesIds}
            value={"cpc-d"}
            width={240}
            onSelectionChanged={option => {
              setDiskType(option);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label='Disk file folder:'>
        <TextInput
          value={diskFileFolder}
          isValid={folderIsValid}
          focusOnInit={true}
          buttonIcon='folder'
          buttonTitle='Select the root project folder'
          buttonClicked={async () => {
            const response = await messenger.sendMessage({
              type: "MainShowOpenFolderDialog",
              settingsId: NEW_DISK_FOLDER_ID
            });
            if (response.type === "ErrorResponse") {
              reportMessagingError(
                `MainShowOpenFolderDialog call failed: ${response.message}`
              );
            } else if (response.type !== "MainShowOpenFolderDialogResponse") {
              reportUnexpectedMessageType(response.type);
            } else {
              if (response.folder) {
                setDiskFileFolder(response.folder);
              }
              return response.folder;
            }
          }}
          valueChanged={val => {
            setDiskFileFolder(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label='Project name:'>
        <TextInput
          value={filename}
          isValid={fileIsValid}
          focusOnInit={true}
          keyPressed={e => {
            if (e.code === "Enter") {
              if (folderIsValid && fileIsValid) {
                e.preventDefault();
                e.stopPropagation();
                modalApi.current.triggerPrimary([filename, diskFileFolder]);
              }
            }
          }}
          valueChanged={val => {
            setFilename(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
