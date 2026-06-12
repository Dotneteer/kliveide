import { useEffect, useMemo } from "react";
import type { EmuMachineCommand, EmuRecordingCommand } from "../../../common/messaging/EmuApi";
import { issueMachineCommandAction, setTapeMediaAction } from "../../../common/state/actions";
import { useDispatch, useSharedState } from "../../shared-store";
import { issueRecordingCommandToActiveManager } from "../recording/recording-session";

type EmuMachineCommandsApi = {
  issueMachineCommand: (command: EmuMachineCommand) => void;
  issueRecordingCommand: (command: EmuRecordingCommand) => void;
};

type Props = {
  registerComponentApi?: (api: EmuMachineCommandsApi) => void;
};

export function EmuMachineCommandsReact({ registerComponentApi }: Props) {
  const dispatch = useDispatch();
  const sharedState = useSharedState();

  const api = useMemo<EmuMachineCommandsApi>(
    () => ({
      issueMachineCommand(command) {
        dispatch(issueMachineCommandAction(command));
        if (command === "rewind" && sharedState.media?.tape?.displayName) {
          dispatch(
            setTapeMediaAction({
              ...sharedState.media.tape,
              currentBlockIndex: 0,
              status: "rewound"
            })
          );
        }
      },
      issueRecordingCommand(command) {
        void issueRecordingCommandToActiveManager(command);
      }
    }),
    [dispatch, sharedState.media?.tape]
  );

  useEffect(() => {
    registerComponentApi?.(api);
  }, [api, registerComponentApi]);

  return null;
}
