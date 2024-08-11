import { useRef } from "react";

import type { MainApi } from "@messaging/MainApi";

import { createMainApi } from "@messaging/MainApi";
import { useRendererContext } from "./RendererProvider";

export function useMainApi(): MainApi {
  const api = useRef<MainApi>(null);
  if (api.current) {
    return api.current;
  }
  const { messenger } = useRendererContext();
  api.current = createMainApi(messenger);
  return api.current;
}
