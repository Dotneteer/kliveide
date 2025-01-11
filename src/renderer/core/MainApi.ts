import { createMainApi } from "@common/messaging/MainApi";
import { useRef } from "react";
import { useRendererContext } from "./RendererProvider";

export function useMainApi() {
  const api = useRef<ReturnType<typeof createMainApi>>(null);
  const { messenger } = useRendererContext();
  if (api.current) {
    return api.current;
  }
  api.current = createMainApi(messenger);
  return api.current;
}
