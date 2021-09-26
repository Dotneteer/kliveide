import * as React from "react";
import {
  IModalDialogDescriptor,
  modalDialogService,
} from "../../common-ui/modal-service";
import { useState } from "react";
import { CSSProperties } from "styled-components";
import { NewFileData } from "../../../shared/messaging/dto";
import { Store } from "redux";
import {
  ErrorLabel,
  Field,
  FieldRow,
  HintLabel,
  Label,
} from "../../common-ui/FormElements";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import { FileExistsResponse } from "../../../shared/messaging/message-types";
import { getStore } from "../../../shared/services/store-helpers";

export const NEW_FILE_DIALOG_ID = "NewFileDialog";

const SPECIFY_MSG = "(Specify!)";
const EXISTS_MSG = "(File already exists)";

class NewFileDialogDescriptor implements IModalDialogDescriptor {
  private _result: NewFileData;

  title = "Add New File";
  width = 480;
  height = "auto";

  button2Text = "Cancel";
  button2Clicked = () => true;

  button3Text = "Ok";
  button3Clicked = () => {
    const file = this._result as NewFileData;
    if (!file.error) {
      modalDialogService.hide(getStore() as Store, this._result);
    }
  };

  primaryButtonIndex = 3;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: NewFileData): React.ReactNode {
    this._result = { ...args };
    return <NewFileDialog newFolderData={this._result} />;
  }
}

type Props = {
  newFolderData: NewFileData;
};

const NewFileDialog: React.FC<Props> = ({ newFolderData: newFileData }: Props) => {
  const [filename, setFilename] = useState(newFileData.name);
  const [nameError, setNameError] = useState(SPECIFY_MSG);
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };

  const onNameChanged = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    setFilename(ev.target.value);
    newFileData.name = ev.target.value;
    newFileData.error = false;
    if (!newFileData.name) {
      setNameError(SPECIFY_MSG);
      newFileData.error = true;
    } else {
      const response =
        await ideToEmuMessenger.sendMessage<FileExistsResponse>({
          type: "FileExists",
          name: `${newFileData.root}/${newFileData.name}`,
        });
      newFileData.error = response.exists;
      setNameError(response.exists ? EXISTS_MSG : "");
    }
  }

  return (
    <div style={containerStyle}>
      <FieldRow>
        <Label>Root folder:</Label>
        <HintLabel>{newFileData.root}</HintLabel>
      </FieldRow>
      <FieldRow>
        <Label>New file name</Label>
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
export const newFileDialog = new NewFileDialogDescriptor();
