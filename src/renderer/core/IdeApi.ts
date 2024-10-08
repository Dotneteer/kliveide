import { useRef } from "react";

import type { IdeApi } from "@messaging/IdeApi";

import { createIdeApi } from "@messaging/IdeApi";
import { useRendererContext } from "./RendererProvider";

export function useIdeApi(): IdeApi {
  const api = useRef<IdeApi>(null);
  const { messenger } = useRendererContext();
  if (api.current) {
    return api.current;
  }
  api.current = createIdeApi(messenger);
  return api.current;
}
