import { DialogRow } from "@renderer/controls/DialogRow";
import { Modal } from "@renderer/controls/Modal";

type Props = {
  slot: number;
  onClose: () => void;
  onExport?: (result: Z88ExportCardDialogResult) => void;
};

export type Z88ExportCardDialogResult = {
  slot: number;
};

/**
 * A placeholder for exporting a Z88 card's contents.
 *
 * Two things had shipped here, and they compound:
 *
 * **The title swallowed the icon.** A misplaced closing backtick put `iconName="repo-push"` *inside*
 * the title template literal, so the header rendered that text as part of its own title and — since
 * no `iconName` prop ever reached `Modal` — never drew its accent chip. Both halves of one typo.
 *
 * **The footer offered to do something the dialog cannot do.** The body says the feature is not
 * implemented while an enabled "Ok" fired `onExport` into a live result path in `emuDialogRegistry`.
 * A dialog that states it does nothing must not also offer a commit button; `primaryVisible={false}`
 * leaves Close, which is the only honest action here. `onExport` stays in the props because the
 * registry entry passes it and the feature it is reserved for is still intended.
 */
export const Z88ExportCardDialog = ({ slot, onClose }: Props) => {
  return (
    <Modal
      isOpen={true}
      title={`Export the Content of Z88 Card in Slot ${slot}`}
      iconName="repo-push"
      width={420}
      translateY={0}
      primaryVisible={false}
      cancelLabel="Close"
      initialFocus="cancel"
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow>
        <div>This function is not implemented yet.</div>
      </DialogRow>
    </Modal>
  );
};
