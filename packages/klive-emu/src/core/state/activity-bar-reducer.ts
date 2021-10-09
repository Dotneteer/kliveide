import { Activity } from "@core/abstractions/activity";
import { ActivityBarState } from "./AppState";
import { ActionCreator, KliveAction } from "./state-core";

// ============================================================================
// Actions

/**
 * Creates an action for setting the activity bar contents
 */
export const setActivitiesAction: ActionCreator = (activities: Activity[]) => ({
  type: "SET_ACTIVITIES",
  payload: {
    activities,
  },
});

/**
 * Creates an action to change the current activity
 */
export const changeActivityAction: ActionCreator = (itemIndex: number) => ({
  type: "CHANGE_ACTIVITY",
  payload: {
    itemIndex,
  },
});

/**
 * Creates an action to sign that an acitivty is pointed
 */
export const pointActivityAction: ActionCreator = (itemIndex: number) => ({
  type: "POINT_ACTIVITY",
  payload: {
    itemIndex,
  },
});

// ============================================================================
// Reducer

const initialState: ActivityBarState = null;

export default function (
  state = initialState,
  { type, payload }: KliveAction
): ActivityBarState {
  switch (type) {
    case "SET_ACTIVITIES":
      return {
        ...state,
        activities: payload.activities,
        activeIndex: -1,
        pointedIndex: -1,
      };
    case "CHANGE_ACTIVITY":
      return { ...state, activeIndex: payload.itemIndex };
    case "POINT_ACTIVITY":
      return { ...state, pointedIndex: payload.itemIndex };
    default:
      return state;
  }
}
