import { useRef } from "react";

import type { EmuApiAlt } from "@messaging/EmuApiAlt";

import { createEmuAltApi } from "@messaging/EmuApiAlt";
import { useRendererContext } from "./RendererProvider";

export function useEmuApiAlt(): EmuApiAlt {
  const { messenger } = useRendererContext();
  const api = useRef<EmuApiAlt>(null);
  if (api.current) {
    return api.current;
  }
  api.current = createEmuAltApi(messenger);
  return api.current;
}
