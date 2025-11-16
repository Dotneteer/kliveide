import { createComponentRenderer, createMetadata } from "xmlui";
import { MachineInfoNative } from "./MachineInfoNative";

const COMP = "MachineInfo";

export const MachineInfoMd = createMetadata({
  status: "stable",
  description:
    "`MachineInfo` is an invisible component that provides reactive access to the current " +
    "emulated machine's information. It monitors the `AppState.emulatorState.machineId` and " +
    "exposes detailed machine metadata through a `machine` state property.\n\n" +
    "The component automatically updates when the machine type changes and provides information " +
    "such as machine display name, character set, features, configuration, models, and media IDs.\n\n" +
    "**Usage Example:**\n" +
    "```xmlui\n" +
    "<EmuAppContext>\n" +
    "  <MachineInfo id=\"machineInfo\" />\n" +
    "  <Text text={machineInfo.machine?.machine?.displayName ?? 'No machine'} />\n" +
    "</EmuAppContext>\n" +
    "```\n\n" +
    "**Important:** This component must be used within an `EmuAppContext` to access the machine service.",
  nonVisual: true,
  props: {},
  events: {},
  apis: {
    getMachine: {
      description:
        "Gets the current machine information object containing machine metadata and model details. " +
        "Returns an object with `machine` (MachineInfo) and `model` (MachineModel) properties, " +
        "or `null` if no machine is currently set.\n\n" +
        "The `machine` property includes:\n" +
        "- `machineId`: Machine type identifier\n" +
        "- `displayName`: Human-readable machine name\n" +
        "- `charSet`: Character set definitions\n" +
        "- `features`: Machine feature flags\n" +
        "- `config`: Machine configuration\n" +
        "- `models`: Available machine models\n" +
        "- `mediaIds`: Attached media device IDs\n\n" +
        "The `model` property includes:\n" +
        "- `modelId`: Model identifier\n" +
        "- `displayName`: Human-readable model name\n" +
        "- `config`: Model-specific configuration",
      args: [],
      returns: "{ machine: MachineInfo; model: MachineModel } | null",
    },
    getMachineId: {
      description:
        "Gets the current machine type ID from AppState.emulatorState.machineId. " +
        "Returns `null` if no machine is set.",
      args: [],
      returns: "string | null",
    },
  },
});

export const machineInfoComponentRenderer = createComponentRenderer(
  COMP,
  MachineInfoMd,
  ({ registerComponentApi, updateState }) => {
    return (
      <MachineInfoNative
        registerComponentApi={registerComponentApi}
        updateState={updateState}
      />
    );
  },
);
