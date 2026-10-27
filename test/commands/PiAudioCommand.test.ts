import { describe, expect, it, vi } from "vitest";

import { MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";
import type { PiI2sStatus } from "@common/zxnext/piI2s";
import { PiAudioCommand } from "@renderer/appIde/commands/PiAudioCommand";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/*
 * The `pi-audio` IDE command (`.plans/PI_I2S_AUDIO_PLAN.md` §4). The emulator is mocked here; the
 * machine side runs on the real core in `test/zxnext-hw/audio/pi-i2s.test.ts`.
 */

function contextFor(machineId: string = MI_ZXNEXT, status?: PiI2sStatus, folderPath = "/proj") {
  const lines: string[] = [];
  const readBinaryFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const setPiI2sSource = vi.fn().mockResolvedValue(status);
  const getPiI2sStatus = vi.fn().mockResolvedValue(status);
  const context: any = {
    store: { getState: () => ({ emulatorState: { machineId }, project: { folderPath } }) },
    output: {
      write: vi.fn(),
      writeLine: vi.fn((text: string) => lines.push(text)),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    emuApi: { setPiI2sSource, getPiI2sStatus },
    mainApi: { readBinaryFile }
  };
  return { context, lines, readBinaryFile, setPiI2sSource, getPiI2sStatus };
}

async function errors(args: Record<string, unknown>, machineId?: string): Promise<number> {
  const { context } = contextFor(machineId);
  const messages = await new PiAudioCommand().validateCommandArgs(context, args as any);
  return messages.filter((m) => m.type === ValidationMessageType.Error).length;
}

describe("pi-audio command", () => {
  it("accepts one source on a Next", async () => {
    expect(await errors({ file: "a.wav" })).toBe(0);
    expect(await errors({ "-tone": 440, "-level": 20, "-left": true })).toBe(0);
    expect(await errors({ "-off": true })).toBe(0);
    expect(await errors({})).toBe(0);
  });

  it("refuses other machines, two sources, tone options without a tone and both sides", async () => {
    expect(await errors({ file: "a.wav" }, MI_SPECTRUM_48)).toBe(1);
    expect(await errors({ file: "a.wav", "-off": true })).toBe(1);
    expect(await errors({ "-tone": 440, "-off": true })).toBe(1);
    expect(await errors({ file: "a.wav", "-level": 10 })).toBe(1);
    expect(await errors({ "-tone": 440, "-left": true, "-right": true })).toBe(1);
  });

  it("sends a WAV file's bytes, resolved under the project", async () => {
    const status: PiI2sStatus = { name: "a.wav", rate: 44100, position: 0, length: 88200, ended: false };
    const { context, readBinaryFile, setPiI2sSource } = contextFor(MI_ZXNEXT, status);
    const result = await new PiAudioCommand().execute(context, { file: "sounds/a.wav" });
    expect(result.success).toBe(true);
    expect(readBinaryFile).toHaveBeenCalledWith("/proj/sounds/a.wav");
    expect(setPiI2sSource).toHaveBeenCalledWith({ kind: "wav", name: "a.wav", contents: new Uint8Array([1, 2, 3]) });
  });

  it("sends a tone with its level and side", async () => {
    const { context, setPiI2sSource } = contextFor(MI_ZXNEXT, { name: "440 Hz", rate: 44100, position: 0, ended: false });
    await new PiAudioCommand().execute(context, { "-tone": 440, "-level": 25, "-right": true });
    expect(setPiI2sSource).toHaveBeenCalledWith({ kind: "tone", frequency: 440, level: 0.25, channels: "right" });
    await new PiAudioCommand().execute(context, { "-tone": 1000 });
    expect(setPiI2sSource).toHaveBeenLastCalledWith({ kind: "tone", frequency: 1000, level: 0.5, channels: "both" });
  });

  it("stops, reports the state, and passes the emulator's refusal on", async () => {
    const { context, setPiI2sSource, getPiI2sStatus } = contextFor(MI_ZXNEXT, undefined);
    expect((await new PiAudioCommand().execute(context, { "-off": true })).success).toBe(true);
    expect(setPiI2sSource).toHaveBeenCalledWith({ kind: "off" });
    expect((await new PiAudioCommand().execute(context, {})).success).toBe(true);
    expect(getPiI2sStatus).toHaveBeenCalled();
    setPiI2sSource.mockRejectedValueOnce(new Error("Error: The file is not a WAV file"));
    const refused = await new PiAudioCommand().execute(context, { file: "/x.wav" });
    expect(refused.success).toBe(false);
    expect(refused.finalMessage).toContain("The file is not a WAV file");
    expect(refused.finalMessage).not.toContain("Error:");
  });
});
