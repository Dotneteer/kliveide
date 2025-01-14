import { useRef } from "react";

import type { EmuApi } from "@common/messaging/EmuApi";

import { createEmuApi } from "@common/messaging/EmuApi";
import { useRendererContext } from "./RendererProvider";

export function useEmuApi(): EmuApi {
  const { messenger } = useRendererContext();
  const api = useRef<EmuApi>(null);
  if (api.current) {
    return api.current;
  }
  api.current = createEmuApi(messenger);
  return api.current;
}
