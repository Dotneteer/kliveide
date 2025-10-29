import { createComponentRenderer, createMetadata } from "xmlui";
import { SharedAppStateNative, defaultProps } from "./SharedAppStateNative";

const COMP = "SharedAppState";

export const SharedAppStateMd = createMetadata({
  status: "stable",
  description:
    "`SharedAppState` is an invisible component that provides reactive access to " +
    "Klive IDE's cross-process Redux store. It exposes the shared application state " +
    "and action creators, enabling XMLUI components to read and update state that " +
    "synchronizes across all processes (Main, Emu, IDE).",
  nonVisual: true,
  props: {
    throttleWaitInMs: {
      description:
        "This property sets a throttling time (in milliseconds) to apply when executing " +
        "the `didChange` event handler. All changes within that throttling time will " +
        "only fire the `didChange` event once.",
      valueType: "number",
      defaultValue: defaultProps.throttleWaitInMs,
    },
  },
  events: {
    didChange: {
      description:
        "This event is fired when the Redux store state changes. The event argument " +
        "is an object with `prevValue` and `newValue` properties containing the previous " +
        "and new AppState values.",
    },
  },
  apis: {
    emuLoaded: {
      description: "Signals that the emulator has loaded.",
      args: [],
      returns: "void",
    },
    emuSynched: {
      description: "Signals that the emulator state is synchronized.",
      args: [],
      returns: "void",
    },
    ideLoaded: {
      description: "Signals that the IDE has loaded.",
      args: [],
      returns: "void",
    },
    isWindows: {
      description: "Sets whether the application is running on Windows.",
      args: [
        {
          name: "flag",
          type: "boolean",
          description: "True if running on Windows, false otherwise.",
        },
      ],
      returns: "void",
    },
    emuFocused: {
      description: "Sets the emulator window focus state.",
      args: [
        {
          name: "flag",
          type: "boolean",
          description: "True if emulator is focused, false otherwise.",
        },
      ],
      returns: "void",
    },
    ideFocused: {
      description: "Sets the IDE window focus state.",
      args: [
        {
          name: "flag",
          type: "boolean",
          description: "True if IDE is focused, false otherwise.",
        },
      ],
      returns: "void",
    },
    setTheme: {
      description: "Sets the current application theme.",
      args: [
        {
          name: "id",
          type: "string",
          description: "The theme identifier.",
        },
      ],
      returns: "void",
    },
    setOs: {
      description: "Sets the operating system identifier.",
      args: [
        {
          name: "os",
          type: "string",
          description: "The operating system name (e.g., 'win32', 'darwin', 'linux').",
        },
      ],
      returns: "void",
    },
    setAppPath: {
      description: "Sets the Electron application path.",
      args: [
        {
          name: "appPath",
          type: "string",
          description: "The absolute path to the Electron application.",
        },
      ],
      returns: "void",
    },
  },
});

export const sharedAppStateComponentRenderer = createComponentRenderer(
  COMP,
  SharedAppStateMd,
  ({ node, lookupEventHandler, extractValue, registerComponentApi, updateState }) => {
    const props = node.props as any;
    
    return (
      <SharedAppStateNative
        throttleWaitInMs={extractValue(props?.throttleWaitInMs)}
        onChange={lookupEventHandler("didChange")}
        registerComponentApi={registerComponentApi}
        updateState={updateState}
      />
    );
  }
);
