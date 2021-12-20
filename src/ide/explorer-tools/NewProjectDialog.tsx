import * as React from "react";
import { useState, CSSProperties } from "react";
import { CheckBoxComponent } from "@syncfusion/ej2-react-buttons";

import { getModalDialogService, getState } from "@core/service-registry";
import { IModalDialogDescriptor } from "@abstractions/modal-dialog-service";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import {
  GetFolderDialogResponse,
  NewProjectData,
} from "@core/messaging/message-types";
import {
  ErrorLabel,
  Field,
  FieldRow,
  HintLabel,
  Label,
} from "@components/FormElements";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { CommandIconButton } from "../context-menu/CommandIconButton";

export const NEW_PROJECT_DIALOG_ID = "NewProjectDialog";

class NewProjectDialogDescriptor implements IModalDialogDescriptor {
  private _result: NewProjectData;

  title = "Create a New Klive Project";
  width = 480;
  height = "auto";

  button2Text = "Cancel";
  button2Clicked = () => true;

  button3Text = "Ok";
  button3Clicked = () => {
    const project = this._result as NewProjectData;
    if (project.projectName) {
      getModalDialogService().hide(this._result);
    }
  };

  primaryButtonIndex = 3;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: NewProjectData): React.ReactNode {
    this._result = { ...args };
    return <NewProjectDialog newProjectData={this._result} />;
  }
}

type Props = {
  newProjectData: NewProjectData;
};

const NewProjectDialog: React.VFC<Props> = ({ newProjectData }) => {
  const machines = getState().machines;
  const [machineType, setMachineType] = useState(machines[0].id);
  const [projectName, setProjectName] = useState(newProjectData.projectName);
  const [projectFolder, setProjectFolder] = useState(
    newProjectData.projectPath
  );
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };

  newProjectData.machineType = machineType;

  return (
    <div style={containerStyle}>
      <Label>Machine type</Label>
      <Field>
        <DropDownListComponent
          dataSource={machines}
          fields={{ text: "label", value: "id" }}
          value={machineType}
          width={240}
          select={(arg) => {
            newProjectData.machineType = (arg.itemData as any).id;
            setMachineType(newProjectData.machineType);
          }}
        ></DropDownListComponent>
      </Field>
      <FieldRow>
        <Label>Root project folder</Label>
        <HintLabel>{projectFolder ? "" : "(Your home folder)"}</HintLabel>
      </FieldRow>
      <Field>
        <FieldRow>
          <input
            type="text"
            style={{ width: "100%", marginRight: 4 }}
            value={projectFolder}
            spellCheck={false}
            onChange={(ev) => {
              setProjectFolder(ev.target.value);
              newProjectData.projectPath = ev.target.value;
            }}
          />
          <CommandIconButton
            iconName="folder"
            clicked={async () => {
              const folder = (
                await sendFromIdeToEmu<GetFolderDialogResponse>({
                  type: "GetFolderDialog",
                })
              ).filename;
              if (folder) {
                setProjectFolder(folder);
                newProjectData.projectPath = folder;
              }
            }}
          />
        </FieldRow>
      </Field>
      <FieldRow>
        <Label>Project name</Label>
        <ErrorLabel>{projectName ? "" : "(Specify!)"}</ErrorLabel>
      </FieldRow>
      <Field>
        <input
          type="text"
          style={{ width: 240 }}
          value={projectName}
          spellCheck={false}
          onChange={(ev) => {
            setProjectName(ev.target.value);
            newProjectData.projectName = ev.target.value;
          }}
        />
      </Field>
      <Field>
        <CheckBoxComponent
          label="Open project"
          checked={newProjectData.open}
          change={(arg) => {
            const value = arg.checked ?? false;
            newProjectData.open = value;
          }}
        />
      </Field>
    </div>
  );
};

/**
 * The singleton instance of the dialog
 */
export const newProjectDialog = new NewProjectDialogDescriptor();
