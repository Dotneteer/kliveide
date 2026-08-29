import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import { RecordingStateOverlay } from "./RecordingStateOverlay";

type Props = {
  overlay: string | null;
  showOverlay: boolean;
  onDismiss: () => void;
};

export const EmulatorOverlay = ({ overlay, showOverlay, onDismiss }: Props) => (
  <>
    {showOverlay && <ExecutionStateOverlay text={overlay} clicked={onDismiss} />}
    <RecordingStateOverlay />
  </>
);
