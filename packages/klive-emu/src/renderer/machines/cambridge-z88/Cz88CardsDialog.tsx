import * as React from "react";
import {
  DropDownListComponent,
  SelectEventArgs,
} from "@syncfusion/ej2-react-dropdowns";
import { Cell, CenteredRow, Grid } from "../../common-ui/grid-styles";
import { emuToMainMessenger } from "../../emulator/EmuToMainMessenger";
import {
  SlotContent,
  SlotState,
  Z88CardsState,
} from "@shared/machines/cz88-specific";
import { useState } from "react";
import { Icon } from "../../common-ui/Icon";
import { EmuOpenFileDialogResponse } from "@core/messaging/message-types";
import { Store } from "redux";
import { IModalDialogDescriptor } from "@abstractions/modal-dialog-service";
import { getModalDialogService, getStore } from "@core/service-registry";

/**
 * Descriptor for the Z88 Insert/remove cards dialog
 */
class Cz88CardsDialogDescriptor implements IModalDialogDescriptor {
  private _result: Z88CardsState;

  title = "Insert or Remove Z88 Cards";
  width = 550;
  height = "auto";

  button2Text = "Cancel";
  button2Clicked = () => true;

  button3Text = "Ok";
  button3Clicked = () => {
    getModalDialogService().hide(getStore() as Store, this._result);
  };

  primaryButtonIndex = 3;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(args?: Z88CardsState): React.ReactNode {
    this._result = { ...args };
    return <Cz88CardsDialog cardsState={this._result} />;
  }

  // --------------------------------------------------------------------------
}

type Props = {
  cardsState: Z88CardsState;
};

/**
 * The dialog component to manage the carda state
 * @returns
 */
function Cz88CardsDialog({ cardsState }: Props) {
  return (
    <Grid rows={3} columns={3} rowGap={8} columnGap={16} style={{ height: 84 }}>
      <CardColumn
        slot={1}
        initialState={cardsState.slot1}
        changed={(s) => (cardsState.slot1 = s)}
      />
      <CardColumn
        slot={2}
        initialState={cardsState.slot2}
        changed={(s) => (cardsState.slot2 = s)}
      />
      <CardColumn
        slot={3}
        initialState={cardsState.slot3}
        changed={(s) => (cardsState.slot3 = s)}
      />
    </Grid>
  );
}

type CardColumnProps = {
  slot: number;
  initialState: SlotState;
  changed: (newState: SlotState) => void;
};

/**
 * Represents a column
 * @param param0
 */
function CardColumn({ slot, initialState, changed }: CardColumnProps) {
  const [state, setState] = useState<SlotState>({ ...initialState });

  const cardData: { id: SlotContent; text: string }[] = [
    { id: "empty", text: "<no card>" },
    { id: "32K", text: "32K RAM" },
    { id: "128K", text: "128K RAM" },
    { id: "512K", text: "512K RAM" },
    { id: "1M", text: "1M RAM" },
    { id: "eprom", text: "EPROM" },
  ];

  const selectSlotType = async (arg: SelectEventArgs) => {
    const slotType = (arg.itemData as any).id;
    let content = state.content;
    let epromFile = state.epromFile;
    if (slotType === "eprom") {
      epromFile = await selectEpromFile();
      if (epromFile) {
        content = slotType;
      }
    } else {
      content = slotType;
      epromFile = undefined;
    }
    const newState = {
      content,
      epromFile,
    };
    setState(newState);
    changed(newState);
  };

  return (
    <>
      <Cell pos={`1/${slot}`}>
        <CenteredRow>
          <span style={{ marginRight: 4 }}>Slot {slot}</span>
          {(state.content !== initialState.content ||
            state.epromFile !== initialState.epromFile) && (
            <Icon iconName="circle-filled" width={16} height={16} />
          )}
        </CenteredRow>
      </Cell>
      <Cell pos={`2/${slot}`}>
        <DropDownListComponent
          dataSource={cardData}
          fields={{ text: "text", value: "id" }}
          value={state.content}
          width={160}
          select={async (arg) => await selectSlotType(arg)}
        ></DropDownListComponent>
      </Cell>
      <Cell pos={`3/${slot}`}>
        <Filename
          file={state.epromFile}
          changed={(name: string) => {
            const newState = {
              content: name ? "eprom" : initialState.content,
              epromFile: name,
            };
            setState(newState);
            changed(newState);
          }}
        />
      </Cell>
    </>
  );
}

type FileNameProps = {
  file?: string;
  changed: (name: string) => void;
};

/**
 * Represents a file name within a card column
 */
function Filename({ file, changed }: FileNameProps) {
  return file ? (
    <CenteredRow
      style={{ cursor: file ? "pointer" : undefined }}
      onClick={async () => {
        const newFile = await selectEpromFile();
        if (newFile && newFile !== file) {
          changed(newFile);
        }
      }}
    >
      <Icon iconName="file-code" width={20} height={20} />
      <span
        title={file}
        style={{
          cursor: file ? "pointer" : undefined,
          paddingTop: 2,
          paddingLeft: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          width: 140,
          direction: "rtl",
          textAlign: "left",
        }}
      >
        {file ?? ""}
      </span>
    </CenteredRow>
  ) : null;
}

async function selectEpromFile(): Promise<string | undefined> {
  const resp = (await emuToMainMessenger.sendMessage({
    type: "EmuOpenFileDialog",
    title: "Open Eprom file",
    filters: [
      { name: "EPR files", extensions: ["epr"] },
      { name: "All Files", extensions: ["*"] },
    ],
  })) as EmuOpenFileDialogResponse;
  return resp.filename;
}

/**
 * The singleton instance of the dialog
 */
export const cz88CardsDialog = new Cz88CardsDialogDescriptor();
