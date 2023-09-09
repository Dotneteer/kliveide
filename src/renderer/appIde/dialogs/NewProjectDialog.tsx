import styles from "./NewProjectDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@controls/Dropdown";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";
import { useAppServices } from "../services/AppServicesProvider";

const NEW_PROJECT_FOLDER_ID = "newProjectFolder";

const machineIds = [
  {
    value: "sp48",
    label: "ZX Spectrum 48K"
  },
  {
    value: "sp128",
    label: "ZX Spectrum 128K"
  },
  {
    value: "spp2e",
    label: "ZX Spectrum +2E"
  },
  {
    value: "spp3e",
    label: "ZX Spectrum +3E (1 FDD)"
  },
  {
    value: "spp3ef2",
    label: "ZX Spectrum +3E (2 FDDs)"
  },
];

type Props = {
  onClose: () => void;
  onCreate: (
    machineId: string,
    projectName: string,
    folder?: string
  ) => Promise<void>;
};

export const NewProjectDialog = ({ onClose, onCreate }: Props) => {
  const { messenger } = useRendererContext();
  const { validationService } = useAppServices();
  const modalApi = useRef<ModalApi>(null);
  const [machineId, setMachineId] = useState("sp48");
  const [projectFolder, setProjectFolder] = useState("");
  const [projectName, setProjectName] = useState("");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [projectIsValid, setProjectIsValid] = useState(true);

  useEffect(() => {
    const fValid = validationService.isValidPath(projectFolder);
    setFolderIsValid(fValid);
    const nValid = validationService.isValidFilename(projectName);
    setProjectIsValid(nValid);
    modalApi.current.enablePrimaryButton(fValid && nValid);
  }, [projectFolder, projectName]);

  return (
    <Modal
      title='Create a new Klive project'
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Create'
      primaryEnabled={folderIsValid && projectIsValid}
      initialFocus='none'
      onPrimaryClicked={async result => {
        const name = result ? result[0] : projectName;
        const folder = result ? result[1] : projectFolder;

        // --- Create the project
        const response = await messenger.sendMessage({
          type: "MainCreateKliveProject",
          machineId,
          projectName: name,
          projectFolder: folder
        });
        if (response.type === "ErrorResponse") {
          reportMessagingError(
            `MainCreateKliveProject call failed: ${response.message}`
          );
        } else if (response.type !== "MainCreateKliveProjectResponse") {
          reportUnexpectedMessageType(response.type);
        } else {
          if (response.errorMessage) {
            // --- Display the error
            const dlgResponse = await messenger.sendMessage({
              type: "MainDisplayMessageBox",
              messageType: "error",
              title: "New Klive Project Error",
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

          // --- Open the newly created project
          const folderResponse = await messenger.sendMessage({
            type: "MainOpenFolder",
            folder: response.path
          });
          if (folderResponse.type === "ErrorResponse") {
            reportMessagingError(
              `MainOpenFolder call failed: ${folderResponse.message}`
            );
          }

          // --- Dialog can be closed
          return false;
        }
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label='Machine type: *'>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder='Select...'
            options={machineIds}
            value={"sp48"}
            onSelectionChanged={option => setMachineId(option)}
          />
        </div>
      </DialogRow>
      <DialogRow label='Project folder:'>
        <TextInput
          value={projectFolder}
          isValid={folderIsValid}
          focusOnInit={true}
          buttonIcon='folder'
          buttonTitle='Select the root project folder'
          buttonClicked={async () => {
            const response = await messenger.sendMessage({
              type: "MainShowOpenFolderDialog",
              settingsId: NEW_PROJECT_FOLDER_ID
            });
            if (response.type === "ErrorResponse") {
              reportMessagingError(
                `MainShowOpenFolderDialog call failed: ${response.message}`
              );
            } else if (response.type !== "MainShowOpenFolderDialogResponse") {
              reportUnexpectedMessageType(response.type);
            } else {
              if (response.folder) {
                setProjectFolder(response.folder);
              }
              return response.folder;
            }
          }}
          valueChanged={val => {
            setProjectFolder(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label='Project name:'>
        <TextInput
          value={projectName}
          isValid={projectIsValid}
          focusOnInit={true}
          keyPressed={e => {
            if (e.code === "Enter") {
              if (folderIsValid && projectIsValid) {
                e.preventDefault();
                e.stopPropagation();
                modalApi.current.triggerPrimary([projectName, projectFolder]);
              }
            }
          }}
          valueChanged={val => {
            setProjectName(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
