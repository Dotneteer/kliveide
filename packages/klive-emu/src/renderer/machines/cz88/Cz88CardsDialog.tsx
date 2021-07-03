import * as React from "react";
import {
  ButtonPropsModel,
  DialogComponent,
} from "@syncfusion/ej2-react-popups";
import { useState } from "react";

type Props = {
  targetId: string;
  display: boolean;
};

export default function Cz88CardsDialog({ targetId, display }: Props) {
  const [show, setShow] = useState(display);

  const onOverlayClick = () => setShow(false);
  const onDialogClose = () => setShow(false);

  const buttons: ButtonPropsModel[] = [
    {
      buttonModel: {
        content: "Cancel",
        cssClass: "e-flat",
        isPrimary: false,
      },
      click: () => {},
    },
    {
      buttonModel: {
        content: "OK",
        cssClass: "e-flat",
        isPrimary: true,
      },
      click: () => {},
    },
  ];

  return (
    <DialogComponent
      width="250px"
      target={targetId}
      isModal={true}
      showCloseIcon={true}
      header="Manage Cards"
      closeOnEscape={false}
      allowDragging={true}
      visible={show}
      overlayClick={onOverlayClick}
      close={onDialogClose}
      buttons={buttons}
    >
      This is a dialog to manage Z88 cards.
    </DialogComponent>
  );
}
