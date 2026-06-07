import { useEffect, useRef, useState } from "react";
import styles from "./WasmBitmapDisplay.module.scss";
import { loadBitmapDemo } from "./wasmBitmapDemo";

export const WasmBitmapDisplayReact = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;

    async function run() {
      try {
        const demo = await loadBitmapDemo();
        if (disposed) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
          return;
        }

        canvas.width = demo.width;
        canvas.height = demo.height;
        context.imageSmoothingEnabled = false;

        const render = (time: number) => {
          if (disposed) {
            return;
          }

          const frameNo = Math.floor(time / 16);
          const pixels = demo.renderFrame(frameNo);
          context.putImageData(new ImageData(new Uint8ClampedArray(pixels), demo.width, demo.height), 0, 0);
          animationFrame = requestAnimationFrame(render);
        };

        animationFrame = requestAnimationFrame(render);
      } catch (ex) {
        if (!disposed) {
          setError(ex instanceof Error ? ex.message : String(ex));
        }
      }
    }

    run();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className={styles.host}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
};
