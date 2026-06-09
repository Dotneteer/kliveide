import { useEffect, useMemo } from "react";
import type { EmuMachineCommand } from "../../../common/messaging/EmuApi";
import { issueMachineCommandAction } from "../../../common/state/actions";
import { useDispatch } from "../../shared-store";

type EmuMachineCommandsApi = {
  issueMachineCommand: (command: EmuMachineCommand) => void;
};

type Props = {
  registerComponentApi?: (api: EmuMachineCommandsApi) => void;
};

export function EmuMachineCommandsReact({ registerComponentApi }: Props) {
  const dispatch = useDispatch();

  const api = useMemo<EmuMachineCommandsApi>(
    () => ({
      issueMachineCommand(command) {
        dispatch(issueMachineCommandAction(command));
      }
    }),
    [dispatch]
  );

  useEffect(() => {
    registerComponentApi?.(api);
  }, [api, registerComponentApi]);

  return null;
}
