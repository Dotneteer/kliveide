import { startScreenDisplayedAction } from "@common/state/actions";
import styles from "./FirstStartDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { DialogRow } from "@renderer/controls/DialogRow";
import {
  useDispatch,
  useRendererContext
} from "@renderer/core/RendererProvider";
import { useRef } from "react";

type Props = {
  onClose: () => void;
};

export const FirstStartDialog = ({ onClose }: Props) => {
  const modalApi = useRef<ModalApi>(null);
  const dispatch = useDispatch();
  const { messenger } = useRendererContext();

  return (
    <Modal
      title='Welcome to Klive!'
      isOpen={true}
      fullScreen={false}
      width={500}
      onApiLoaded={api => (modalApi.current = api)}
      primaryLabel='Ok'
      secondaryEnabled={true}
      secondaryVisible={true}
      secondaryLabel='Visit the Klive website'
      cancelVisible={false}
      onSecondaryClicked={async () => {
        dispatch(startScreenDisplayedAction());
        await messenger.sendMessage({
          type: "MainShowWebsite"
        });
        return false;
      }}
      onClose={() => {
        dispatch(startScreenDisplayedAction());
        onClose?.();
      }}
    >
      <DialogRow>
        <div>Welcome</div>
      </DialogRow>
    </Modal>
  );
};
