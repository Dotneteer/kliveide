import styles from "./NewProjectDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@controls/Dropdown";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useAppServices } from "../services/AppServicesProvider";
import { getAllMachineModels } from "@common/machines/machine-registry";
import { split } from "lodash";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { useMainApi } from "@renderer/core/MainApi";

const NEW_PROJECT_FOLDER_ID = "newProjectFolder";
const INITIAL_MACHINE_IDE = "sp48";
const INITIAL_MODEL_ID = "pal";
const INITAIL_TEMPLATE_ID = "default";

const machineIds = getAllMachineModels().map((m) => ({
  value: `${m.machineId}${m.modelId ? ":" + m.modelId : ""}`,
  label: m.displayName
}));

type Props = {
  onClose: () => void;
  onCreate: (machineId: string, projectName: string, folder?: string) => Promise<void>;
};

export const NewProjectDialog = ({ onClose }: Props) => {
  const mainApi = useMainApi();
  const { validationService } = useAppServices();
  const modalApi = useRef<ModalApi>(null);
  const [machineId, setMachineId] = useState<string>(INITIAL_MACHINE_IDE);
  const [modelId, setmodelId] = useState<string>(undefined);
  const [projectFolder, setProjectFolder] = useState("");
  const [projectName, setProjectName] = useState("");
  const [folderIsValid, setFolderIsValid] = useState(true);
  const [projectIsValid, setProjectIsValid] = useState(true);
  const [templateDirs, setTemplateDirs] = useState<{ value: string; label: string }[]>([]);
  const [templateId, setTemplateId] = useState<string>(INITAIL_TEMPLATE_ID);

  // --- Refresh the template list according to the current machine id
  const refreshTemplateList = async () => {
    if (!machineId) return;
    const response = await mainApi.getTemplateDirectories(machineId);
    setTemplateDirs(response.dirs.map((d) => ({ value: d, label: d })));
  };
  useInitializeAsync(async () => {
    await refreshTemplateList();
  });

  // --- Read the template names for a particular machine ID
  useEffect(() => {
    (async () => {
      await refreshTemplateList();
    })();
  }, [machineId]);

  // --- Validate the folder and project name
  useEffect(() => {
    const fValid = validationService.isValidPath(projectFolder);
    setFolderIsValid(fValid);
    const nValid = validationService.isValidFilename(projectName);
    setProjectIsValid(nValid);
    modalApi.current.enablePrimaryButton(fValid && nValid);
    console.log("Validation", fValid, nValid)
  }, [projectFolder, projectName]);

  return (
    <Modal
      title="Create a new Klive project"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      onApiLoaded={(api) => (modalApi.current = api)}
      primaryLabel="Create"
      primaryEnabled={folderIsValid && projectIsValid}
      initialFocus="none"
      onPrimaryClicked={async (result) => {
        const machine = result ? result[0] : machineId;
        const template = result ? result[1] : templateId;
        const name = result ? result[2] : projectName;
        const folder = result ? result[3] : projectFolder;

        // --- Create the project
        console.log("project", machineId, modelId, templateId, name, folder);
        const response = await mainApi.createKliveProject(machine, name, folder, modelId, template);

        if (response.errorMessage) {
          // --- Display the error
          await mainApi.displayMessageBox(
            "error",
            "New Klive Project Error",
            response.errorMessage
          );

          // --- Keep the dialog open
          return true;
        }

        // --- Open the newly created project
        await mainApi.openFolder(response.path);

        // --- Dialog can be closed
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label="Machine type: *">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={machineIds}
            value={`${INITIAL_MACHINE_IDE}:${INITIAL_MODEL_ID}`}
            width={468}
            onSelectionChanged={async (option) => {
              const [machineId, modelId] = split(option, ":");
              setMachineId(machineId);
              setmodelId(modelId);
              console.log("machine", machineId, modelId);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Project Template: *">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={templateDirs}
            value={"default"}
            width={468}
            onSelectionChanged={(option) => {
              setTemplateId(option);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Project folder:">
        <TextInput
          value={projectFolder}
          isValid={folderIsValid}
          focusOnInit={true}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          buttonClicked={async () => {
            const response = await mainApi.showOpenFolderDialog(NEW_PROJECT_FOLDER_ID);
            if (response.folder) {
              setProjectFolder(response.folder);
            }
            return response.folder;
          }}
          valueChanged={(val) => {
            setProjectFolder(val);
            return false;
          }}
        />
      </DialogRow>
      <DialogRow label="Project name:">
        <TextInput
          value={projectName}
          isValid={projectIsValid}
          focusOnInit={true}
          keyPressed={(e) => {
            if (e.code === "Enter") {
              if (folderIsValid && projectIsValid) {
                e.preventDefault();
                e.stopPropagation();
                console.log("tp", templateId, projectName, projectFolder);
                modalApi.current.triggerPrimary([
                  machineId,
                  templateId,
                  projectName,
                  projectFolder
                ]);
              }
            }
          }}
          valueChanged={(val) => {
            setProjectName(val);
            return false;
          }}
        />
      </DialogRow>
    </Modal>
  );
};
