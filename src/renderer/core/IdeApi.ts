import { useRef } from "react";

import type { IdeApi } from "@common/messaging/IdeApi";

import { createIdeApi } from "@common/messaging/IdeApi";
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
