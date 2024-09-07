import { useRef } from "react";

import type { MainApi } from "@messaging/MainApi";

import { createMainApi } from "@messaging/MainApi";
import { useRendererContext } from "./RendererProvider";

export function useMainApi(): MainApi {
  const api = useRef<MainApi>(null);
  const { messenger } = useRendererContext();
  if (api.current) {
    return api.current;
  }
  api.current = createMainApi(messenger);
  return api.current;
}
