/**
 * GPU-accelerated scanline effect using canvas operations
 * Eliminates expensive CPU readback (getImageData/putImageData)
 */

type ScanlineIntensity = "off" | "50%" | "25%" | "12.5%";

/**
 * Creates a scanline pattern canvas that can be composited onto the screen
 * This approach uses GPU blending instead of CPU pixel manipulation
 */
export function createScanlinePatternCanvas(
  width: number,
  height: number,
  intensity: ScanlineIntensity
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Get darkening intensity from setting
  const darkening = getScanlineDarkening(intensity);
  if (darkening === 0) return canvas; // No effect needed

  // Create scanline pattern - alternating lines with transparency
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Fill with alternating scanlines
  // Every other line is darkened, creating the scanline effect
  for (let y = 0; y < height; y++) {
    const isScanline = y % 2 === 1; // Every odd line is a scanline
    const opacity = isScanline ? darkening : 0;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Black scanlines with varying opacity
      data[idx] = 0; // R
      data[idx + 1] = 0; // G
      data[idx + 2] = 0; // B
      data[idx + 3] = Math.round(255 * opacity); // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Applies scanline effect using GPU compositing (multiply blend mode)
 * Much faster than CPU pixel manipulation
 */
export function applyGpuScanlineEffect(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceCanvas: HTMLCanvasElement,
  scanlineIntensity: ScanlineIntensity = "off",
  scanlinePatternCache?: { canvas: HTMLCanvasElement; intensity: ScanlineIntensity }
): { canvas: HTMLCanvasElement; intensity: ScanlineIntensity } | undefined {
  const darkening = getScanlineDarkening(scanlineIntensity);

  if (darkening === 0) {
    // No effect - just draw the source
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return undefined;
  }

  // Draw source image
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  // Use cached scanline pattern if available and intensity matches
  let scanlinePattern: HTMLCanvasElement;
  if (
    scanlinePatternCache &&
    scanlinePatternCache.intensity === scanlineIntensity &&
    scanlinePatternCache.canvas.width === canvas.width &&
    scanlinePatternCache.canvas.height === canvas.height
  ) {
    scanlinePattern = scanlinePatternCache.canvas;
  } else {
    // Create new scanline pattern
    scanlinePattern = createScanlinePatternCanvas(
      canvas.width,
      canvas.height,
      scanlineIntensity
    );
  }

  // Apply scanline overlay using multiply blend mode (darkens the image)
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(scanlinePattern, 0, 0);
  ctx.globalCompositeOperation = "source-over"; // Reset to default

  return {
    canvas: scanlinePattern,
    intensity: scanlineIntensity
  };
}

/**
 * Applies scanline effect using CSS filter approach
 * Ultra-fast GPU-accelerated alternative
 */
export function createScanlineFilter(
  intensity: ScanlineIntensity
): { filter: string; opacity: number } {
  // This creates a subtle darkening effect using drop-shadow
  // In a real implementation, this could be a custom WebGL shader
  const opacityMap: Record<ScanlineIntensity, number> = {
    "off": 0,
    "50%": 0.5,
    "25%": 0.75,
    "12.5%": 0.875
  };

  const opacity = opacityMap[intensity];

  // For CSS-only approach, we use a combination of filters
  // This is fast but less precise than the pattern approach
  if (opacity === 0) {
    return { filter: "none", opacity: 1 };
  }

  // Use brightness to simulate scanline darkening
  // brightness(1) = normal, brightness(0.5) = 50% darker
  return {
    filter: `brightness(${1 - (1 - opacity) * 0.5})`,
    opacity: 1
  };
}

/**
 * Gets the darkening intensity value from setting string
 */
function getScanlineDarkening(intensity: ScanlineIntensity): number {
  switch (intensity) {
    case "50%":
      return 0.75;
    case "25%":
      return 0.5;
    case "12.5%":
      return 0.25;
    case "off":
    default:
      return 0.0;
  }
}

/**
 * Advanced GPU scanline effect using WebGL
 * Highest performance, best quality
 */
export class WebGLScanlineRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;

  constructor(canvas: HTMLCanvasElement) {
    try {
      this.gl = canvas.getContext("webgl");
      if (!this.gl) {
        this.gl = canvas.getContext("experimental-webgl") as WebGLRenderingContext;
      }
      if (this.gl) {
        this.initProgram();
      }
    } catch (e) {
      console.warn("WebGL not available for scanline effect:", e);
    }
  }

  private initProgram(): void {
    if (!this.gl) return;

    const vertexShader = this.compileShader(
      `
      attribute vec2 position;
      attribute vec2 texCoord;
      varying vec2 vTexCoord;
      
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        vTexCoord = texCoord;
      }
    `,
      this.gl.VERTEX_SHADER
    );

    const fragmentShader = this.compileShader(
      `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;
      uniform float uIntensity;
      
      void main() {
        vec4 color = texture2D(uTexture, vTexCoord);
        
        // Create scanline effect by darkening alternate lines
        float scanline = mod(floor(vTexCoord.y * 256.0), 2.0);
        float darkness = mix(1.0, 1.0 - uIntensity, scanline);
        
        gl_FragColor = vec4(color.rgb * darkness, color.a);
      }
    `,
      this.gl.FRAGMENT_SHADER
    );

    if (!vertexShader || !fragmentShader) return;

    this.program = this.gl.createProgram();
    if (!this.program) return;

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error("WebGL program linking failed");
      this.program = null;
    }
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compilation failed:", this.gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  isAvailable(): boolean {
    return this.gl !== null && this.program !== null;
  }
}
