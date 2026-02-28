import { createContext, useContext, MutableRefObject } from "react";
import type { RecordingManager } from "./RecordingManager";

/**
 * The context value is a stable ref whose `.current` points to the
 * RecordingManager instance once EmulatorPanel has initialised it.
 * Using a ref avoids unnecessary re-renders when the manager instance
 * doesn't change.
 */
export type RecordingContextValue = MutableRefObject<RecordingManager | null>;

export const RecordingContext = createContext<RecordingContextValue | null>(null);

/**
 * Returns the recording manager ref from context.
 * Returns null when called outside of a RecordingContext.Provider.
 */
export function useRecordingManager(): RecordingContextValue | null {
  return useContext(RecordingContext);
}
