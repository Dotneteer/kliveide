import * as React from "react";
import { CheckBoxComponent } from "@syncfusion/ej2-react-buttons";
import {
  IModalDialogDescriptor,
  modalDialogService,
} from "../../common-ui/modal-service";
import { useState } from "react";
import { CSSProperties } from "styled-components";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { ideStore } from "../ideStore";
import CommandIconButton from "../context-menu/CommandIconButton";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import { GetFolderDialogResponse } from "../../../shared/messaging/message-types";
import { NewProjectData } from "../../../shared/messaging/dto";
import { Store } from "redux";

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
    if (!hasErrors(project)) {
      modalDialogService.hide(ideStore as Store, this._result);
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

const NewProjectDialog: React.FC<Props> = ({ newProjectData }: Props) => {
  const [errorText, setErrorText] = useState(hasErrors(newProjectData));
  const [projectName, setProjectName] = useState(newProjectData.projectName);
  const [projectFolder, setProjectFolder] = useState(
    newProjectData.projectPath
  );
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };

  const machines = ideStore.getState().machines;
  newProjectData.machineType = machines[0].id;
  return (
    <div style={containerStyle}>
      <Label>Machine type</Label>
      <Field>
        <DropDownListComponent
          dataSource={machines}
          fields={{ text: "label", value: "id" }}
          value={newProjectData.machineType}
          width={240}
          select={(arg) => {
            newProjectData.machineType = (arg.itemData as any).id;
          }}
        ></DropDownListComponent>
      </Field>
      <Label>Root project folder</Label>
      <Field>
        <FieldRow>
          <input
            type="text"
            style={{ width: "100%", marginRight: 4 }}
            value={projectFolder}
            onChange={(ev) => {
              setProjectFolder(ev.target.value);
              newProjectData.projectPath = ev.target.value;
            }}
          />
          <CommandIconButton
            iconName="folder"
            clicked={async () => {
              const folder = (
                await ideToEmuMessenger.sendMessage<GetFolderDialogResponse>({
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
        <ErrorLabel>{hasErrors(newProjectData) ? "(specify!)" : ""}</ErrorLabel>
      </FieldRow>
      <Field>
        <input
          type="text"
          style={{ width: 240 }}
          value={projectName}
          onChange={(ev) => {
            setProjectName(ev.target.value);
            newProjectData.projectName = ev.target.value;
            setErrorText(hasErrors(newProjectData));
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

const Label: React.FC = (props) => {
  return <label className="dialog-label">{props.children}</label>;
};

const ErrorLabel: React.FC = (props) => {
  return <label className="dialog-label dialog-error">{props.children}</label>;
};

const Field: React.FC = (props) => {
  return <div className="dialog-field">{props.children}</div>;
};

const FieldRow: React.FC = (props) => {
  return <div className="dialog-field-row">{props.children}</div>;
};

function hasErrors(project: NewProjectData): string | null {
  return project.projectName ? null : "Specify the name of the project";
}

/**
 * The singleton instance of the dialog
 */
export const newProjectDialog = new NewProjectDialogDescriptor();
