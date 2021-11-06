import * as React from "react";
import { ReactReduxContext } from "react-redux";
import {
  ButtonPropsModel,
  DialogComponent,
} from "@syncfusion/ej2-react-popups";

import { getModalDialogService } from "@core/service-registry";

import { useContext, useState } from "react";
import { IModalDialogDescriptor } from "@abstractions/modal-dialog-service";
import { useEffect } from "react";

type Props = {
  targetId: string;
};

export default function ModalDialog({ targetId }: Props) {
  const { store } = useContext(ReactReduxContext);
  const [show, setShow] = useState(false);
  const [modalDialog, setModalDialog] = useState<IModalDialogDescriptor | null>(
    null
  );
  const [buttons, setButtons] = useState<ButtonPropsModel[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);

  const handleClick = (click?: () => void | boolean) => {
    if (click?.()) {
      getModalDialogService().hide(store);
    }
  };

  // --- Set up the buttons according to the dialog definition
  const handleModalChanged = (modal: IModalDialogDescriptor) => {
    setModalDialog(modal);
    if (!modal) {
      return;
    }
    setRefreshCount(refreshCount + 1);

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
  const modalDialogService = getModalDialogService();
  const onOverlayClick = () => modalDialogService.hide(store);
  const onDialogClose = () => {
    modalDialogService.hide(store);
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
        key={refreshCount}
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
        <div style={{ padding: "8px 15px", color: "white", fontSize: "1em" }}>
          {modalDialog?.createContentElement(modalDialogService.args)}
        </div>
      </DialogComponent>
    )
  );
}
