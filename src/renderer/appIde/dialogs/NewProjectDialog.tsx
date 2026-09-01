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
import { ensureBuildRootsLoaded, ensureProjectLoaded, ensureWorkspaceLoaded } from "../IdeEventsHandler";
import { DialogForm } from "@renderer/controls/DialogForm";
import { optionalPath, requiredFilename } from "./dialogValidators";

const NEW_PROJECT_FOLDER_ID = "newProjectFolder";
const INITIAL_MACHINE_IDE = "sp48";
const INITIAL_MODEL_ID = "pal";
const INITIAL_TEMPLATE_ID = "default";
const PROJECT_CREATION_TIMEOUT_MS = 30_000;

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
  const [modelId, setmodelId] = useState<string>(INITIAL_MODEL_ID);
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
  }, [machineId, mainApi]);

  const projectFolderPath = projectFolder.trim();
  const folderError = optionalPath(validationService, projectFolderPath);
  const projectError = requiredFilename(validationService, projectName);

  const createProject = async (): Promise<boolean> => {
    // --- Create the project
    try {
      const responsePath = await withTimeout(
        mainApi.createKliveProject(
          machineId,
          projectName,
          projectFolderPath,
          modelId,
          templateId
        ),
        PROJECT_CREATION_TIMEOUT_MS,
        "Creating the Klive project"
      );
      // --- Open the newly created project
      const errorMessage = await withTimeout(
        mainApi.openFolder(responsePath),
        PROJECT_CREATION_TIMEOUT_MS,
        "Opening the new Klive project"
      );
      if (errorMessage) {
        throw new Error(`Error opening folder: ${errorMessage}`);
      }
      await withTimeout(
        ensureProjectLoaded(projectService),
        PROJECT_CREATION_TIMEOUT_MS,
        "Loading the new Klive project"
      );
      await withTimeout(
        ensureWorkspaceLoaded(store),
        PROJECT_CREATION_TIMEOUT_MS,
        "Loading the new Klive workspace"
      );

      // --- The build root is dispatched by the main process and forwarded to this window's
      // --- store asynchronously; give it a bounded chance to arrive before we read it, otherwise
      // --- the explorer never gets asked to reveal/mark the build root node (seen on Windows,
      // --- where the forwarded action can lag behind the "open folder" IPC response).
      await ensureBuildRootsLoaded(store);

      // --- Navigate to the project root
      const buildRoots = store.getState().project?.buildRoots ?? [];
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
      console.error("New Klive project creation failed", error);
      void mainApi
        .displayMessageBox("error", "New Klive Project Error", getErrorMessage(error))
        .catch((messageBoxError) =>
          console.error("Displaying the new project error failed", messageBoxError)
        );
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs / 1000} seconds.`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
