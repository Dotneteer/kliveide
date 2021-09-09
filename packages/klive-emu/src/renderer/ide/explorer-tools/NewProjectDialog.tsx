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
import { ToolbarIconButton } from "../../common-ui/ToolbarIconButton";
import CommandIconButton from "../context-menu/CommandIconButton";

export const NEW_PROJECT_DIALOG_ID = "NewProjectDialog";

/**
 * Represents the contents of the new project data
 */
export type NewProjectData = {
  machineType: string;
  projectPath: string;
  projectName: string;
  open: boolean;
};

class NewProjectDialogDescriptor implements IModalDialogDescriptor {
  private _result: NewProjectData;

  title = "Create a New Klive Project";
  width = 480;
  height = "auto";

  button2Text = "Cancel";
  button2Clicked = () => true;

  button3Text = "Ok";
  button3Clicked = () => {
    modalDialogService.hide(this._result);
  };

  primaryButtonIndex = 3;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: NewProjectData): React.ReactNode {
    return <NewProjectDialog newProjectData={args} />;
  }
}

type Props = {
  newProjectData: NewProjectData;
};

const NewProjectDialog: React.FC<Props> = ({ newProjectData }: Props) => {
  const [projectName, setProjectName] = useState(newProjectData.projectName);
  const [projectFolder, setProjectFolder] = useState(
    newProjectData.projectPath
  );
  const [open, setOpen] = useState(newProjectData.open);

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };

  const machines = ideStore.getState().machines;
  return (
    <div style={containerStyle}>
      <Label>Machine type</Label>
      <Field>
        <DropDownListComponent
          dataSource={machines}
          fields={{ text: "label", value: "id" }}
          value={machines[0].id}
          width={240}
          select={(arg) => {}}
        ></DropDownListComponent>
      </Field>
      <Label>Root project folder</Label>
      <Field>
        <FieldRow>
          <input
            type="text"
            style={{ width: "100%", marginRight: 4 }}
            value={projectFolder}
            onChange={(ev) => setProjectFolder(ev.target.value)}
          />
          <CommandIconButton iconName="folder" />
        </FieldRow>
      </Field>
      <Label>Project name</Label>
      <Field>
        <input
          type="text"
          style={{ width: 240 }}
          value={projectName}
          onChange={(ev) => setProjectName(ev.target.value)}
        />
      </Field>
      <Field>
        <CheckBoxComponent
          label="Open project"
          checked={newProjectData.open}
          change={(arg) => {
            setOpen(arg.checked ?? false);
          }}
        />
      </Field>
    </div>
  );
};

const Label: React.FC = (props) => {
  return <label className="dialog-label">{props.children}</label>;
};

const Field: React.FC = (props) => {
  return <div className="dialog-field">{props.children}</div>;
};

const FieldRow: React.FC = (props) => {
  return <div className="dialog-field-row">{props.children}</div>;
};

/**
 * The singleton instance of the dialog
 */
export const newProjectDialog = new NewProjectDialogDescriptor();
