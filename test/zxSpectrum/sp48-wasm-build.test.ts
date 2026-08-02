import { buildSp48Wasm, output, source } from "../../scripts/build-sp48-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum 48K WASM build", () => {
  it("passes the C core and required ABI exports to a fake compiler", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    const result = buildSp48Wasm({
      compiler: "fake-c-compiler",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].compiler).toBe("fake-c-compiler");
    expect(calls[0].args).toContain(source);
    expect(calls[0].args).toContain(output);
    expect(calls[0].args).toContain("-Wl,--export=sp48_read_memory");
    expect(calls[0].args).toContain("-Wl,--export=sp48_write_port");
    expect(result.output).toBe(output);
  });
});
