import styles from "./NewProjectDialog.module.scss";
import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { useEffect, useState } from "react";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { getAllMachineModels } from "@common/machines/machine-registry";
import { split } from "lodash";
import { useMainApi } from "@renderer/core/MainApi";
import Dropdown from "@renderer/controls/Dropdown";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { ensureProjectLoaded, ensureWorkspaceLoaded } from "../IdeEventsHandler";
import { DialogForm } from "@renderer/controls/DialogForm";
import { optionalPath, requiredFilename } from "./dialogValidators";

const NEW_PROJECT_FOLDER_ID = "newProjectFolder";
const INITIAL_MACHINE_IDE = "sp48";
const INITIAL_MODEL_ID = "pal";
const INITIAL_TEMPLATE_ID = "default";

const machineIds = getAllMachineModels().map((m) => ({
  value: `${m.machineId}${m.modelId ? ":" + m.modelId : ""}`,
  label: m.displayName
}));

type Props = {
  onClose: () => void;
  onCreate?: (result: NewProjectDialogResult) => Promise<void> | void;
};

export type NewProjectDialogResult = {
  machineId: string;
  modelId?: string;
  templateId: string;
  projectName: string;
  projectFolder: string;
};

export const NewProjectDialog = ({ onClose, onCreate }: Props) => {
  const mainApi = useMainApi();
  const { validationService, projectService, ideCommandsService } = useAppServices();
  const { store } = useRendererContext();
  const [machineId, setMachineId] = useState<string>(INITIAL_MACHINE_IDE);
  const [modelId, setmodelId] = useState<string>(undefined);
  const [projectFolder, setProjectFolder] = useState("");
  const [projectName, setProjectName] = useState("");
  const [templateDirs, setTemplateDirs] = useState<{ value: string; label: string }[]>([]);
  const [templateId, setTemplateId] = useState<string>(INITIAL_TEMPLATE_ID);

  // --- Read the template names for a particular machine ID
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!machineId) return;

      const dirs = await mainApi.getTemplateDirectories(machineId);
      if (cancelled) return;

      setTemplateDirs(dirs.map((d) => ({ value: d, label: d })));
      setTemplateId((current) => {
        if (dirs.includes(current)) return current;
        if (dirs.includes(INITIAL_TEMPLATE_ID)) return INITIAL_TEMPLATE_ID;
        return dirs[0] ?? INITIAL_TEMPLATE_ID;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [machineId]);

  const projectFolderPath = projectFolder.trim();
  const folderError = optionalPath(validationService, projectFolderPath);
  const projectError = requiredFilename(validationService, projectName);

  const createProject = async (): Promise<boolean> => {
    // --- Create the project
    try {
      const responsePath = await mainApi.createKliveProject(
        machineId,
        projectName,
        projectFolderPath,
        modelId,
        templateId
      );
      // --- Open the newly created project
      await mainApi.openFolder(responsePath);
      await ensureProjectLoaded(projectService);
      await ensureWorkspaceLoaded(store);

      // --- Navigate to the project root
      const buildRoots = store.getState().project?.buildRoots;
      if (buildRoots.length > 0) {
        ideCommandsService.executeCommand(`nav "${buildRoots[0]}"`);
      }
      await onCreate?.({
        machineId,
        modelId,
        templateId,
        projectName,
        projectFolder: projectFolderPath
      });
    } catch (error) {
      await mainApi.displayMessageBox("error", "New Klive Project Error", error.toString());
      return true;
    }

    // --- Dialog can be closed
    return false;
  };

  return (
    <Modal
      title="Create a new Klive project"
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
        submitLabel="Create"
        submitDisabled={Boolean(folderError || projectError)}
        onSubmit={async () => {
          if (!(await createProject())) onClose();
        }}
        onCancel={onClose}
      >
      <DialogRow label="Machine type: *">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={machineIds}
            initialValue={`${INITIAL_MACHINE_IDE}:${INITIAL_MODEL_ID}`}
            width={468}
            onChanged={async (option) => {
              const [machineId, modelId] = split(option, ":");
              setMachineId(machineId);
              setmodelId(modelId);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Project Template: *">
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder="Select..."
            options={templateDirs}
            initialValue={templateId}
            width={468}
            onChanged={(option) => {
              setTemplateId(option);
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Project folder:">
        <TextInput
          value={projectFolder}
          error={folderError}
          autoFocus={true}
          buttonIcon="folder"
          buttonTitle="Select the root project folder"
          browse={() => mainApi.showOpenFolderDialog(NEW_PROJECT_FOLDER_ID)}
          onChange={setProjectFolder}
        />
      </DialogRow>
      <DialogRow label="Project name:">
        <TextInput
          value={projectName}
          error={projectError}
          onChange={setProjectName}
        />
      </DialogRow>
      </DialogForm>
    </Modal>
  );
};
