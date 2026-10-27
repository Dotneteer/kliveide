import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import { MI_ZXNEXT } from "@common/machines/constants";
import type { PiI2sSourceSpec, PiI2sStatus, PiI2sToneChannels } from "@common/zxnext/piI2s";
import { t } from "@common/i18n/i18n";
import { commandError, commandSuccessWith, IdeCommandBase, validationError, writeInfoMessage } from "../services/ide-commands";
import { resolveCommandFilePath } from "./commandFilePath";

export type PiAudioCommandArgs = {
  file?: string;
  "-tone"?: number;
  "-level"?: number;
  "-left"?: boolean;
  "-right"?: boolean;
  "-off"?: boolean;
};

/** The tone's level when `-level` is left out, in percent of full scale */
const DEFAULT_TONE_LEVEL = 50;

/**
 * Puts a sample source on the ZX Spectrum Next's Raspberry Pi I2S input, in place of the Pi
 * (`.plans/PI_I2S_AUDIO_PLAN.md` §4): a WAV file, a sine tone, or nothing. With no argument it shows
 * the stream's state. The stream starts at once and runs with the machine; what the Next makes of it
 * (the mix, NextRegs $2C-$2E, the EAR bit) is up to NextReg $A2, as on the hardware.
 */
export class PiAudioCommand extends IdeCommandBase<PiAudioCommandArgs> {
  readonly id = "pi-audio";
  get description() {
    return t("commands.piAudio.description");
  }
  readonly usage = [
    "pi-audio <wav-file>",
    "pi-audio -tone <hz> [-level <percent>] [-left | -right]",
    "pi-audio -off",
    "pi-audio"
  ];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "file", type: "string" }],
    namedOptions: [
      { name: "-tone", type: "number", minValue: 1, maxValue: 20000 },
      { name: "-level", type: "number", minValue: 0, maxValue: 100 }
    ],
    commandOptions: ["-left", "-right", "-off"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: PiAudioCommandArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (context.store.getState().emulatorState?.machineId !== MI_ZXNEXT) {
      messages.push(validationError(t("commands.piAudio.notNext")));
    }
    const tone = args["-tone"] !== undefined;
    if ([!!args.file?.trim(), tone, !!args["-off"]].filter(Boolean).length > 1) {
      messages.push(validationError(t("commands.piAudio.oneSource")));
    }
    if (!tone && (args["-level"] !== undefined || args["-left"] || args["-right"])) {
      messages.push(validationError(t("commands.piAudio.toneOnly")));
    }
    if (args["-left"] && args["-right"]) {
      messages.push(validationError(t("commands.piAudio.oneSide")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: PiAudioCommandArgs): Promise<IdeCommandResult> {
    let spec: PiI2sSourceSpec | undefined;
    if (args["-off"]) {
      spec = { kind: "off" };
    } else if (args["-tone"] !== undefined) {
      const channels: PiI2sToneChannels = args["-left"] ? "left" : args["-right"] ? "right" : "both";
      spec = { kind: "tone", frequency: args["-tone"], level: (args["-level"] ?? DEFAULT_TONE_LEVEL) / 100, channels };
    } else if (args.file?.trim()) {
      const resolved = resolveCommandFilePath(context, args.file);
      if ("error" in resolved) return commandError(resolved.error);
      let contents: Uint8Array;
      try {
        contents = await context.mainApi.readBinaryFile(resolved.path);
      } catch (err) {
        return commandError(t("commands.piAudio.readFailed", { file: resolved.path, error: messageOf(err) }));
      }
      spec = { kind: "wav", name: resolved.path.split(/[\\/]/).pop() ?? resolved.path, contents };
    }

    if (!spec) {
      const status = await context.emuApi.getPiI2sStatus();
      return commandSuccessWith(status ? describeStatus(status) : t("commands.piAudio.idle"));
    }

    let status: PiI2sStatus | undefined;
    try {
      status = await context.emuApi.setPiI2sSource(spec);
    } catch (err) {
      return commandError(t("commands.piAudio.failed", { error: messageOf(err) }));
    }
    if (!status) return commandSuccessWith(t("commands.piAudio.stopped"));
    writeInfoMessage(context.output, t("commands.piAudio.enableHint"));
    return commandSuccessWith(describeStatus(status));
  }
}

/** The stream's state in one line */
function describeStatus(status: PiI2sStatus): string {
  const name = status.name ?? t("commands.piAudio.unnamed");
  if (status.ended) return t("commands.piAudio.statusEnded", { name, rate: status.rate });
  if (status.length === undefined) {
    return t("commands.piAudio.statusEndless", { name, rate: status.rate });
  }
  return t("commands.piAudio.status", {
    name,
    rate: status.rate,
    position: Math.round((status.position / status.rate) * 10) / 10,
    length: Math.round((status.length / status.rate) * 10) / 10
  });
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
