import * as React from "react";
import { getModalDialogService } from "@abstractions/service-helpers";
import { IModalDialogDescriptor } from "@shared/services/IModalDialogService";
import { useRef, useState } from "react";
import { CSSProperties } from "styled-components";
import { Store } from "redux";
import {
  ErrorLabel,
  Field,
  FieldRow,
  HintLabel,
  Label,
} from "../../common-ui/FormElements";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import { FileExistsResponse } from "@shared/messaging/message-types";
import { NewFileData } from "@shared/messaging/dto";
import { getStore } from "@abstractions/service-helpers";

export const RENAME_FILE_DIALOG_ID = "RenameFileDialog";

const SPECIFY_MSG = "(Specify!)";
const EXISTS_MSG = "(File already exists)";

class RenameFileDialogDescriptor implements IModalDialogDescriptor {
  private _result: NewFileData;

  title = "Rename File";
  width = 480;
  height = "auto";

  button2Text = "Cancel";
  button2Clicked = () => true;

  button3Text = "Ok";
  button3Clicked = () => {
    const file = this._result as NewFileData;
    if (!file.error) {
      getModalDialogService().hide(getStore() as Store, this._result);
    }
  };

  primaryButtonIndex = 3;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: NewFileData): React.ReactNode {
    this._result = { ...args };
    return <RenameFileDialog fileData={this._result} />;
  }
}

type Props = {
  fileData: NewFileData;
};

const RenameFileDialog: React.FC<Props> = ({ fileData }: Props) => {
  const [filename, setFilename] = useState(fileData.name);
  const [nameError, setNameError] = useState(EXISTS_MSG);
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };
  const oldName = useRef(`${fileData.root}/${fileData.name}`);

  const onNameChanged = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    setFilename(ev.target.value);
    fileData.name = ev.target.value;
    fileData.error = false;
    if (!fileData.name) {
      setNameError(SPECIFY_MSG);
      fileData.error = true;
    } else {
      const response =
        await ideToEmuMessenger.sendMessage<FileExistsResponse>({
          type: "FileExists",
          name: `${fileData.root}/${fileData.name}`,
        });
      fileData.error = response.exists;
      setNameError(response.exists ? EXISTS_MSG : "");
    }
  }

  return (
    <div style={containerStyle}>
      <FieldRow>
        <Label>Current name:</Label>
        <HintLabel>{oldName.current}</HintLabel>
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
export const renameFileDialog = new RenameFileDialogDescriptor();
