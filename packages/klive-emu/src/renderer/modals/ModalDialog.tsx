import * as React from "react";
import {
  ButtonPropsModel,
  DialogComponent,
} from "@syncfusion/ej2-react-popups";
import styles from "styled-components";
import { useState } from "react";
import { IModalDialogDescriptor, modalDialogService } from "./modal-service";
import { useEffect } from "react";

type Props = {
  targetId: string;
};

export default function ModalDialog({ targetId }: Props) {
  const [show, setShow] = useState(false);
  const [modalDialog, setModalDialog] = useState<IModalDialogDescriptor | null>(
    null
  );
  const [buttons, setButtons] = useState<ButtonPropsModel[]>([]);

  const handleClick = (click?: () => void | boolean) => {
    if (click?.()) {
      modalDialogService.hide();
    }
  };

  // --- Set up the buttons according to the dialog definition
  const handleModalChanged = (modal: IModalDialogDescriptor) => {
    setModalDialog(modal);
    if (!modal) {
        return;
    }
    const buttons: ButtonPropsModel[] = [];
    if (modal.button1Text) {
      buttons.push({
        buttonModel: {
          content: modal.button1Text,
          cssClass: "e-flat",
          isPrimary: modal.primaryButtonIndex === 1,
        },
        click: () => handleClick(modal.button1Clicked),
      });
    }
    if (modal.button2Text) {
      buttons.push({
        buttonModel: {
          content: modal.button2Text,
          cssClass: "e-flat",
          isPrimary: modal.primaryButtonIndex === 2,
        },
        click: () => handleClick(modal.button2Clicked),
      });
    }
    if (modal.button3Text) {
      buttons.push({
        buttonModel: {
          content: modal.button3Text,
          cssClass: "e-flat",
          isPrimary: modal.primaryButtonIndex === 3,
        },
        click: () => handleClick(modal.button3Clicked),
      });
    }
    setButtons(buttons);
  };

  // --- Show od hide the dialog
  const handleVisibilityChanged = (display: boolean) => setShow(display);

  // --- Close the dialog if the users decides so
  const onOverlayClick = () => modalDialogService.hide();
  const onDialogClose = () => {
    modalDialogService.hide();
    modalDialogService.disposeModalDialog();
  };

  useEffect(() => {
    // --- Mount
    modalDialogService.modalChanged.on(handleModalChanged);
    modalDialogService.visibilityChanged.on(handleVisibilityChanged);

    return () => {
      // --- Dismount
      modalDialogService.visibilityChanged.off(handleVisibilityChanged);
      modalDialogService.modalChanged.off(handleModalChanged);
    };
  });

  return (
    modalDialog &&
    buttons.length > 0 && (
      <DialogComponent
        width={modalDialog.width}
        height={modalDialog.height}
        target={targetId}
        isModal={true}
        showCloseIcon={true}
        header={modalDialog.title}
        closeOnEscape={false}
        allowDragging={true}
        visible={show}
        overlayClick={onOverlayClick}
        close={onDialogClose}
        buttons={buttons}
        animationSettings={{ effect: "None", delay: 0, duration: 0 }}
      >
        <Placeholder>{modalDialog?.createContentElement(modalDialogService.args)}</Placeholder>
      </DialogComponent>
    )
  );
}

const Placeholder = styles.div`
  padding: 15px;
  color: white;
  font-size: 1em;
`;
