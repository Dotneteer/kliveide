import { useRef } from "react";

import type { EmuApi } from "@messaging/EmuApi";

import { createEmulatorApi } from "@messaging/EmuApi";
import { useRendererContext } from "./RendererProvider";

export function useEmuApi(): EmuApi {
  const { messenger } = useRendererContext();
  const api = useRef<EmuApi>(null);
  if (api.current) {
    return api.current;
  }
  api.current = createEmulatorApi(messenger);
  return api.current;
}
