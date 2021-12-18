import * as React from "react";
import { useRef, useState, CSSProperties } from "react";

import { getModalDialogService } from "@core/service-registry";
import { IModalDialogDescriptor } from "@abstractions/modal-dialog-service";
import {
  ErrorLabel,
  Field,
  FieldRow,
  HintLabel,
  Label,
} from "@components/FormElements";
import { FileExistsResponse } from "@core/messaging/message-types";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import { NewFileData } from "./NewFileData";

export const RENAME_FOLDER_DIALOG_ID = "RenameFolderDialog";

const SPECIFY_MSG = "(Specify!)";
const EXISTS_MSG = "(Folder already exists)";

class RenameFolderDialogDescriptor implements IModalDialogDescriptor {
  private _result: NewFileData;

  title = "Rename Folder";
  width = 480;
  height = "auto";

  button2Text = "Cancel";
  button2Clicked = () => true;

  button3Text = "Ok";
  button3Clicked = () => {
    const file = this._result as NewFileData;
    if (!file.error) {
      getModalDialogService().hide(this._result);
    }
  };

  primaryButtonIndex = 3;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: NewFileData): React.ReactNode {
    this._result = { ...args };
    return <RenameFolderDialog folderData={this._result} />;
  }
}

type Props = {
  folderData: NewFileData;
};

const RenameFolderDialog: React.VFC<Props> = ({ folderData }) => {
  const [filename, setFilename] = useState(folderData.name);
  const [nameError, setNameError] = useState(EXISTS_MSG);
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };
  const oldName = useRef(`${folderData.root}/${folderData.name}`);

  const onNameChanged = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    setFilename(ev.target.value);
    folderData.name = ev.target.value;
    folderData.error = false;
    if (!folderData.name) {
      setNameError(SPECIFY_MSG);
      folderData.error = true;
    } else {
      const response = await sendFromIdeToEmu<FileExistsResponse>({
        type: "FileExists",
        name: `${folderData.root}/${folderData.name}`,
      });
      folderData.error = response.exists;
      setNameError(response.exists ? EXISTS_MSG : "");
    }
  };

  return (
    <div style={containerStyle}>
      <FieldRow>
        <Label>Current name:</Label>
        <HintLabel>{oldName.current}</HintLabel>
      </FieldRow>
      <FieldRow>
        <Label>New folder name</Label>
        <ErrorLabel>{nameError}</ErrorLabel>
      </FieldRow>
      <Field>
        <input
          type="text"
          style={{ width: "100%" }}
          spellCheck={false}
          value={filename}
          onChange={async (ev) => await onNameChanged(ev)}
        />
      </Field>
    </div>
  );
};

/**
 * The singleton instance of the dialog
 */
export const renameFolderDialog = new RenameFolderDialogDescriptor();
