const wasmUrl = new URL("wasm/bitmap-demo.wasm", window.location.href).href;

type BitmapDemoExports = {
  memory: WebAssembly.Memory;
  bitmap_width: () => number;
  bitmap_height: () => number;
  bitmap_ptr: () => number;
  render_frame: (frameNo: number) => void;
};

export type BitmapDemo = {
  width: number;
  height: number;
  renderFrame: (frameNo: number) => Uint8ClampedArray;
};

let bitmapDemoPromise: Promise<BitmapDemo> | undefined;

export function loadBitmapDemo(): Promise<BitmapDemo> {
  bitmapDemoPromise ??= createBitmapDemo();
  return bitmapDemoPromise;
}

async function createBitmapDemo(): Promise<BitmapDemo> {
  const response = await fetch(wasmUrl);
  const wasmBytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(wasmBytes, {});
  const exports = result.instance.exports as BitmapDemoExports;
  const width = exports.bitmap_width();
  const height = exports.bitmap_height();
  const byteLength = width * height * 4;

  return {
    width,
    height,
    renderFrame(frameNo: number) {
      exports.render_frame(frameNo);
      const bitmapPtr = exports.bitmap_ptr();
      return new Uint8ClampedArray(exports.memory.buffer, bitmapPtr, byteLength);
    }
  };
}
