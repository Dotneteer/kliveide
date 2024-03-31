import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { AppServices } from "@renderer/abstractions/AppServices";

// --- Store the singleton instances we use for message processing (out of React)
let appServicesCached: AppServices;
let storeCached: Store<AppState>;
let messengerCached: MessengerBase;

export function setCachedAppServices (appServices: AppServices) {
  appServicesCached = appServices;
}

export function setCachedStore (store: Store<AppState>) {
  storeCached = store;
}

export function getCachedAppServices (): AppServices {
  return appServicesCached;
}

export function getCachedStore (): Store<AppState> {
  return storeCached;
}

export function setCachedMessenger (messenger: MessengerBase) {
  messengerCached = messenger;
}

export function getCachedMessenger (): MessengerBase {
  return messengerCached;
}
