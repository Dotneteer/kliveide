import styles from "./NewProjectDialog.module.scss";
import { ModalApi, Modal } from "@/controls/Modal";
import { TextInput } from "@/controls/TextInput";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/controls/Dropdown";
import { useRendererContext } from "@/core/RendererProvider";
import { MainCreateKliveProjectResponse, MainShowOpenFolderDialogResponse } from "@messaging/any-to-main";

const NEW_PROJECT_FOLDER_ID = "newProjectFolder";
const VALID_FILENAME = /^[^>:"/\\|?*]+$/;
const VALID_FOLDERNAME = /^[^>:"|?*]+$/;

const machineIds = [
  {
    value: "sp48",
    label: "ZX Spectrum 48K"
  },
  {
    value: "sp128",
    label: "ZX Spectrum 128K"
  }
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
  const modalApi = useRef<ModalApi>(null);
  const [machineId, setMachineId] = useState("sp48");
  const [projectFolder, setProjectFolder] = useState("");
  const [projectName, setProjectName] = useState("");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [projectIsValid, setProjectIsValid] = useState(true);

  useEffect(() => {
    const fValid = projectFolder.trim() === "" || VALID_FOLDERNAME.test(projectFolder)
    const nValid = projectName.trim() !== "" && VALID_FILENAME.test(projectName)
    setFolderIsValid(fValid);
    setProjectIsValid(nValid);
    modalApi.current.enablePrimaryButton(fValid && nValid);
  }, [projectFolder, projectName])

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
      onPrimaryClicked={async () => {
        // --- Create the project
        const response = await messenger.sendMessage({
          type: "MainCreateKliveProject",
          machineId,
          projectName,
          projectFolder
        }) as MainCreateKliveProjectResponse;
        if (response.errorMessage) {
          // --- Display the error
          await messenger.sendMessage({
            type: "MainDisplayMessageBox",
            messageType: "error",
            title: "New Klive Project Error",
            message: response.errorMessage
          });

          // --- Keep the dialog open
          return true;
        }

        // --- Open the newly created project
        await messenger.sendMessage({
          type: "MainOpenFolder",
          folder: response.path
        });

        // --- Dialog can be closed
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <div>Machine type: *</div>
      <div className={styles.dropdownWrapper}>
        <Dropdown
          placeholder='Select...'
          options={machineIds}
          value={"sp48"}
          onSelectionChanged={option => setMachineId(option)}
        />
      </div>
      <div>Project folder:</div>
      <div className={styles.inputRow}>
        <TextInput
          value={projectFolder}
          isValid={folderIsValid}
          focusOnInit={true}
          buttonIcon='folder'
          buttonTitle='Select the root project folder'
          buttonClicked={async () => {
            const response = (await messenger.sendMessage({
              type: "MainShowOpenFolderDialog",
              settingsId: NEW_PROJECT_FOLDER_ID
            })) as MainShowOpenFolderDialogResponse;
            if (response.folder) {
              setProjectFolder(response.folder);
            }
            return response.folder;
          }}
          valueChanged={val => {
            setProjectFolder(val);
            return false;
          }}
        />
      </div>
      <div>Project name: *</div>
      <TextInput
        value={projectName}
        isValid={projectIsValid}
        focusOnInit={true}
        valueChanged={val => {
          setProjectName(val);
          return false;
        }}
      />
    </Modal>
  );
};
