use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

mod rom_symbols;

fn main() {
    if let Err(err) = run() {
        eprintln!("error: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    match args.next().as_deref() {
        Some("bundle-web") => {
            let snapshot = args
                .next()
                .ok_or_else(|| "usage: cargo bundle-web <snapshot.rtvcsnap>".to_string())?;
            if args.next().is_some() {
                return Err("usage: cargo bundle-web <snapshot.rtvcsnap>".to_string());
            }
            bundle_web(Path::new(&snapshot))
        }
        Some("bundle-web-skeleton") => {
            let out_dir = args.next().map(PathBuf::from);
            if args.next().is_some() {
                return Err("usage: cargo xtask bundle-web-skeleton [out-dir]".to_string());
            }
            bundle_web_skeleton(out_dir.as_deref())
        }
        Some("bundle-web-full") => {
            let out_dir = args.next().map(PathBuf::from);
            if args.next().is_some() {
                return Err("usage: cargo xtask bundle-web-full [out-dir]".to_string());
            }
            bundle_web_full(out_dir.as_deref())
        }
        Some("rom-symbols") => {
            let check = match args.next().as_deref() {
                None => false,
                Some("--check") => true,
                Some(flag) => {
                    return Err(format!(
                        "usage: cargo xtask rom-symbols [--check] (unknown flag `{flag}`)"
                    ));
                }
            };
            if args.next().is_some() {
                return Err("usage: cargo xtask rom-symbols [--check]".to_string());
            }
            rom_symbols::rom_symbols(check)
        }
        _ => Err(
            "usage: cargo bundle-web <snapshot.rtvcsnap>\n       cargo xtask bundle-web-skeleton [out-dir]\n       cargo xtask bundle-web-full [out-dir]\n       cargo xtask rom-symbols [--check]"
                .to_string(),
        ),
    }
}

fn bundle_web(snapshot: &Path) -> Result<(), String> {
    if !snapshot.is_file() {
        return Err(format!("snapshot file not found: {}", snapshot.display()));
    }
    let bundled_snapshot = read_snapshot(snapshot)?;

    let workspace = workspace_dir()?;
    let snapshot = absolutize(snapshot)?;
    let stem = snapshot_stem(&snapshot);
    let bundle_dir = workspace.join("dist").join(format!("{stem}-web"));

    write_web_bundle(&workspace, &bundle_dir)?;

    fs::write(bundle_dir.join(&bundled_snapshot.file_name), &bundled_snapshot.data)
        .map_err(|err| format!("failed to write snapshot: {err}"))?;

    println!("bundle written to {}", bundle_dir.display());
    Ok(())
}

fn bundle_web_skeleton(out_dir: Option<&Path>) -> Result<(), String> {
    let workspace = workspace_dir()?;
    let bundle_dir = match out_dir {
        Some(path) if path.is_absolute() => path.to_path_buf(),
        Some(path) => env::current_dir()
            .map_err(|err| format!("failed to read current directory: {err}"))?
            .join(path),
        None => workspace.join("dist").join("rtvc-web-skeleton"),
    };

    write_web_bundle(&workspace, &bundle_dir)?;
    fs::write(bundle_dir.join("README.txt"), WEB_SKELETON_README)
        .map_err(|err| format!("failed to write README.txt: {err}"))?;

    println!("web skeleton written to {}", bundle_dir.display());
    Ok(())
}

fn bundle_web_full(out_dir: Option<&Path>) -> Result<(), String> {
    let workspace = workspace_dir()?;
    let bundle_dir = match out_dir {
        Some(path) if path.is_absolute() => path.to_path_buf(),
        Some(path) => env::current_dir()
            .map_err(|err| format!("failed to read current directory: {err}"))?
            .join(path),
        None => workspace.join("dist").join("rtvc-web-full"),
    };

    fs::create_dir_all(&bundle_dir)
        .map_err(|err| format!("failed to create {}: {err}", bundle_dir.display()))?;

    run_command(
        Command::new("cargo")
            .current_dir(&workspace)
            .arg("build")
            .arg("--release")
            .arg("--lib")
            .arg("--no-default-features")
            .arg("--features")
            .arg("wasm-full")
            .arg("--target")
            .arg("wasm32-unknown-unknown"),
        "cargo build",
    )?;

    let wasm_in = workspace
        .join("target")
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("rtvc_core.wasm");
    if !wasm_in.is_file() {
        return Err(format!("WASM output not found: {}", wasm_in.display()));
    }

    run_command(
        Command::new(wasm_bindgen_bin())
            .current_dir(&workspace)
            .arg("--target")
            .arg("web")
            .arg("--out-dir")
            .arg(&bundle_dir)
            .arg("--out-name")
            .arg("rtvc")
            .arg(&wasm_in),
        "wasm-bindgen",
    )
    .map_err(|err| format!("{err}\ninstall wasm-bindgen-cli with: cargo install wasm-bindgen-cli"))?;

    fs::write(bundle_dir.join("index.html"), WEB_FULL_INDEX_HTML)
        .map_err(|err| format!("failed to write index.html: {err}"))?;
    fs::write(bundle_dir.join("favicon.ico"), FAVICON_ICO)
        .map_err(|err| format!("failed to write favicon.ico: {err}"))?;
    fs::write(bundle_dir.join("app.js"), WEB_FULL_APP_JS)
        .map_err(|err| format!("failed to write app.js: {err}"))?;
    fs::write(bundle_dir.join("audio-worklet.js"), AUDIO_WORKLET_JS)
        .map_err(|err| format!("failed to write audio-worklet.js: {err}"))?;

    println!("web full bundle written to {}", bundle_dir.display());
    Ok(())
}

fn write_web_bundle(workspace: &Path, bundle_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(bundle_dir)
        .map_err(|err| format!("failed to create {}: {err}", bundle_dir.display()))?;

    run_command(
        Command::new("cargo")
            .current_dir(workspace)
            .arg("build")
            .arg("--release")
            .arg("--lib")
            .arg("--no-default-features")
            .arg("--features")
            .arg("wasm,web-vid-simple")
            .arg("--target")
            .arg("wasm32-unknown-unknown"),
        "cargo build",
    )?;

    let wasm_in = workspace
        .join("target")
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("rtvc_core.wasm");
    if !wasm_in.is_file() {
        return Err(format!("WASM output not found: {}", wasm_in.display()));
    }

    run_command(
        Command::new(wasm_bindgen_bin())
            .current_dir(workspace)
            .arg("--target")
            .arg("web")
            .arg("--out-dir")
            .arg(bundle_dir)
            .arg("--out-name")
            .arg("rtvc")
            .arg(&wasm_in),
        "wasm-bindgen",
    )
    .map_err(|err| format!("{err}\ninstall wasm-bindgen-cli with: cargo install wasm-bindgen-cli"))?;

    fs::write(bundle_dir.join("index.html"), INDEX_HTML)
        .map_err(|err| format!("failed to write index.html: {err}"))?;
    fs::write(bundle_dir.join("favicon.ico"), FAVICON_ICO)
        .map_err(|err| format!("failed to write favicon.ico: {err}"))?;
    fs::write(bundle_dir.join("app.js"), APP_JS)
        .map_err(|err| format!("failed to write app.js: {err}"))?;
    fs::write(bundle_dir.join("audio-worklet.js"), AUDIO_WORKLET_JS)
        .map_err(|err| format!("failed to write audio-worklet.js: {err}"))?;

    Ok(())
}

struct BundledSnapshot {
    file_name: String,
    data: Vec<u8>,
}

fn read_snapshot(snapshot: &Path) -> Result<BundledSnapshot, String> {
    let data = fs::read(snapshot)
        .map_err(|err| format!("failed to read {}: {err}", snapshot.display()))?;
    let is_zip = data.starts_with(b"PK\x03\x04");
    let raw = if is_zip {
        unzip_snapshot(&data)?
    } else {
        data.clone()
    };
    if raw.len() < 10 || &raw[..8] != b"RTVCSNAP" {
        return Err(format!(
            "{} is not an rtvc snapshot file",
            snapshot.display()
        ));
    }
    Ok(BundledSnapshot {
        file_name: if is_zip {
            "snapshot.rtvcsnap.zip".to_string()
        } else {
            "snapshot.rtvcsnap".to_string()
        },
        data,
    })
}

fn unzip_snapshot(data: &[u8]) -> Result<Vec<u8>, String> {
    let reader = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|err| format!("failed to read snapshot zip: {err}"))?;

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|err| format!("failed to read snapshot zip entry: {err}"))?;
        if file.name().to_ascii_lowercase().ends_with(".rtvcsnap") {
            let mut snapshot = Vec::new();
            file.read_to_end(&mut snapshot)
                .map_err(|err| format!("failed to extract snapshot zip entry: {err}"))?;
            return Ok(snapshot);
        }
    }

    Err("snapshot zip does not contain a .rtvcsnap file".to_string())
}

fn snapshot_stem(snapshot: &Path) -> String {
    let file_name = snapshot
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("snapshot");
    file_name
        .strip_suffix(".rtvcsnap.zip")
        .or_else(|| file_name.strip_suffix(".rtvcsnap"))
        .or_else(|| file_name.strip_suffix(".zip"))
        .unwrap_or(file_name)
        .to_string()
}

fn workspace_dir() -> Result<PathBuf, String> {
    let xtask_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    xtask_dir
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "could not determine workspace directory".to_string())
}

fn absolutize(path: &Path) -> Result<PathBuf, String> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        env::current_dir()
            .map_err(|err| format!("failed to read current directory: {err}"))
            .map(|cwd| cwd.join(path))
    }
}

fn wasm_bindgen_bin() -> PathBuf {
    if let Ok(path) = env::var("WASM_BINDGEN") {
        return PathBuf::from(path);
    }
    if let Some(home) = env::var_os("HOME") {
        let cargo_bin = PathBuf::from(home).join(".cargo").join("bin").join("wasm-bindgen");
        if cargo_bin.is_file() {
            return cargo_bin;
        }
    }
    PathBuf::from("wasm-bindgen")
}

fn run_command(command: &mut Command, label: &str) -> Result<(), String> {
    let status = command
        .stdin(Stdio::null())
        .status()
        .map_err(|err| format!("failed to run {label}: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{label} exited with {status}"))
    }
}

const INDEX_HTML: &str = r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>rtvc snapshot</title>
  <link rel="icon" href="./favicon.ico" sizes="any">
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      background: #111;
      color: #eee;
      font: 14px system-ui, sans-serif;
    }
    body {
      display: grid;
      place-items: center;
    }
    #status {
      position: fixed;
      inset: auto 1rem 1rem 1rem;
      text-align: center;
      color: #ccc;
    }
    #status:empty {
      display: none;
    }
    canvas {
      width: min(100vw, calc(100vh * 4 / 3));
      height: min(100vh, calc(100vw * 3 / 4));
      image-rendering: pixelated;
      background: #000;
      outline: none;
    }
  </style>
</head>
<body>
  <canvas id="screen" tabindex="0"></canvas>
  <div id="status"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
"#;

const FAVICON_ICO: &[u8] = include_bytes!("../../assets/rtvc-app-icon.ico");

const WEB_SKELETON_README: &str = r#"rtvc web snapshot player

Copy a compressed snapshot named snapshot.rtvcsnap.zip into this directory, then
serve the directory with any static web server.

Example:

  python -m http.server 8000

Then open:

  http://localhost:8000/

Raw snapshots named snapshot.rtvcsnap are also supported.
"#;

const APP_JS: &str = r#"import init, { WasmTvc } from "./rtvc.js";

const canvas = document.getElementById("screen");
const status = document.getElementById("status");

const wasm = await init();
const emu = new WasmTvc(true);
let snapshot;
try {
  snapshot = await loadSnapshot();
} catch (error) {
  status.textContent = `${error.message}. Copy snapshot.rtvcsnap.zip beside index.html and reload.`;
  throw error;
}
emu.loadSnapshot(snapshot);

const width = emu.screenWidth();
const height = emu.screenHeight();
canvas.width = width;
canvas.height = height;
canvas.focus();

const ctx = canvas.getContext("2d", { alpha: false });
const image = ctx.createImageData(width, height);
const audio = await createAudioSink(emu.audioSampleRate());

const resumeAudio = () => {
  audio.resume();
};
window.addEventListener("click", resumeAudio, { once: true });
window.addEventListener("touchstart", resumeAudio, { once: true });
window.addEventListener("keydown", resumeAudio, { once: true });

async function loadSnapshot() {
  let response = await fetch("./snapshot.rtvcsnap.zip");
  if (response.ok) {
    return unzipSnapshot(new Uint8Array(await response.arrayBuffer()));
  }

  response = await fetch("./snapshot.rtvcsnap");
  if (!response.ok) {
    throw new Error(`Failed to load snapshot: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function unzipSnapshot(zipBytes) {
  const entry = findFirstZipEntry(zipBytes);
  if (entry.method === 0) {
    return zipBytes.slice(entry.dataStart, entry.dataEnd);
  }
  if (entry.method !== 8) {
    throw new Error(`Unsupported zip compression method: ${entry.method}`);
  }
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("This browser cannot decompress zipped snapshots");
  }

  const stream = new Blob([zipBytes.slice(entry.dataStart, entry.dataEnd)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findFirstZipEntry(bytes) {
  let pos = 0;
  while (pos + 30 <= bytes.length) {
    if (u32(bytes, pos) !== 0x04034b50) {
      break;
    }
    const method = u16(bytes, pos + 8);
    const compressedSize = u32(bytes, pos + 18);
    const fileNameLen = u16(bytes, pos + 26);
    const extraLen = u16(bytes, pos + 28);
    const nameStart = pos + 30;
    const nameEnd = nameStart + fileNameLen;
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compressedSize;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameEnd)).toLowerCase();
    if (name.endsWith(".rtvcsnap")) {
      return { method, dataStart, dataEnd };
    }
    pos = dataEnd;
  }
  throw new Error("Snapshot zip does not contain a .rtvcsnap entry");
}

function u16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function draw() {
  const ptr = emu.framebufferPtr();
  const len = emu.framebufferLen();
  image.data.set(new Uint8ClampedArray(wasm.memory.buffer, ptr, len));
  ctx.putImageData(image, 0, 0);
}

async function createAudioSink(sampleRate) {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext || !("AudioWorkletNode" in globalThis)) {
    return { push() {}, resume() {} };
  }

  try {
    let context;
    try {
      context = new AudioContext({ sampleRate });
    } catch {
      context = new AudioContext();
    }
    if (!context.audioWorklet) {
      throw new Error("audioWorklet is undefined");
    }
    await context.audioWorklet.addModule("./audio-worklet.js");
    const node = new AudioWorkletNode(context, "rtvc-audio", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    node.connect(context.destination);
    const ratio = context.sampleRate / sampleRate;
    let resamplePhase = 0;
    return {
      push(samples) {
        if (samples.length > 0) {
          const output = ratio === 1 ? samples : resample(samples, ratio);
          node.port.postMessage(output, [output.buffer]);
        }
      },
      resume() {
        if (context.state !== "running") {
          context.resume();
        }
      },
    };
  } catch (error) {
    console.warn("Audio unavailable", error);
    return { push() {}, resume() {} };
  }

  function resample(samples, ratio) {
    const converted = [];
    for (const sample of samples) {
      resamplePhase += ratio;
      while (resamplePhase >= 1) {
        converted.push(sample);
        resamplePhase -= 1;
      }
    }
    return new Float32Array(converted);
  }
}

function keyCode(event) {
  if (event.key && event.key.length === 1) {
    return event.key.toUpperCase().charCodeAt(0);
  }
  return {
    Backspace: 8,
    Tab: 9,
    Enter: 13,
    Shift: 16,
    Control: 17,
    Alt: 18,
    Escape: 27,
    " ": 32,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Delete: 46,
  }[event.key] ?? 0;
}

const activeKeyCodes = new Map();

canvas.addEventListener("keydown", (event) => {
  const code = keyCode(event);
  if (event.repeat || activeKeyCodes.has(event.code)) {
    if (code !== 0) {
      event.preventDefault();
    }
    return;
  }
  if (code !== 0) {
    event.preventDefault();
    activeKeyCodes.set(event.code, code);
    audio.resume();
    emu.keyDown(code);
  }
});

canvas.addEventListener("pointerdown", () => {
  audio.resume();
  canvas.focus();
});

canvas.addEventListener("keyup", (event) => {
  const code = activeKeyCodes.get(event.code) ?? keyCode(event);
  activeKeyCodes.delete(event.code);
  if (code !== 0) {
    event.preventDefault();
    emu.keyUp(code);
  }
});

canvas.addEventListener("blur", () => {
  activeKeyCodes.clear();
});

canvas.addEventListener("input", (event) => {
  if (event.data) {
    emu.keyPressText(event.data);
  }
});

function frame() {
  emu.runFrame();
  audio.push(emu.takeAudioSamples());
  if (emu.takeFrameComplete()) {
    draw();
  }
  requestAnimationFrame(frame);
}

draw();
requestAnimationFrame(frame);
"#;

const AUDIO_WORKLET_JS: &str = r#"class RtvcAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.queueOffset = 0;
    this.buffered = 0;
    this.maxBuffered = sampleRate;
    this.port.onmessage = (event) => this.enqueue(event.data);
  }

  enqueue(samples) {
    if (!(samples instanceof Float32Array) || samples.length === 0) {
      return;
    }
    this.queue.push(samples);
    this.buffered += samples.length;
    while (this.buffered > this.maxBuffered && this.queue.length > 0) {
      const head = this.queue.shift();
      this.buffered -= head.length - this.queueOffset;
      this.queueOffset = 0;
    }
  }

  nextSample() {
    while (this.queue.length > 0) {
      const head = this.queue[0];
      if (this.queueOffset < head.length) {
        const sample = head[this.queueOffset++];
        this.buffered--;
        return sample;
      }
      this.queue.shift();
      this.queueOffset = 0;
    }
    return 0;
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      output[i] = this.nextSample();
    }
    return true;
  }
}

registerProcessor("rtvc-audio", RtvcAudioProcessor);
"#;

const WEB_FULL_INDEX_HTML: &str = r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>rtvc - Videoton TV Computer Emulator</title>
  <link rel="icon" href="./favicon.ico" sizes="any">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #1a1a1a;
      font: 14px system-ui, sans-serif;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      outline: none;
    }
  </style>
</head>
<body>
  <canvas id="tvc_canvas"></canvas>
  <script type="module" src="./app.js"></script>
</body>
</html>
"#;

const WEB_FULL_APP_JS: &str = r#"import init, { WebHandle } from "./rtvc.js";

const DB_NAME = "rtvc";
const DB_VERSION = 1;
const MEDIA_STORE = "recent-media";
const MAX_RECENT_PER_KIND = 5;
const keyboardEvents = [];
const activeKeyCodes = new Map();
let audioSink;
let audioSampleRate;
let audioInitPromise;

globalThis.rtvcStartupAudioError = null;
globalThis.rtvcStartupStorageError = null;
globalThis.rtvcStartupRecentMedia = [];
globalThis.rtvcGetStartupAudioError = () => globalThis.rtvcStartupAudioError;
globalThis.rtvcGetStartupStorageError = () => globalThis.rtvcStartupStorageError;
globalThis.rtvcGetStartupRecentMedia = () => globalThis.rtvcStartupRecentMedia;

globalThis.rtvcAudioInit = async (sampleRate) => {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext || !("AudioWorkletNode" in globalThis)) {
    return "This browser does not support AudioWorklet";
  }
  audioSampleRate = sampleRate;
  return null;
};

globalThis.rtvcAudioResume = () => {
  void ensureAudioSink().then((sink) => sink?.resume());
};

globalThis.rtvcAudioPush = (samples) => {
  audioSink?.push(samples);
};

function ensureAudioSink() {
  if (audioSink) {
    return Promise.resolve(audioSink);
  }
  if (!audioSampleRate) {
    return Promise.resolve(null);
  }
  if (!audioInitPromise) {
    audioInitPromise = createAudioSink(audioSampleRate)
      .then((sink) => {
        audioSink = sink;
        return sink;
      })
      .catch((error) => {
        console.warn("AudioWorklet initialization failed", error);
        return null;
      })
      .finally(() => {
        audioInitPromise = null;
      });
  }
  return audioInitPromise;
}

globalThis.rtvcTakeKeyboardEvents = () => keyboardEvents.splice(0);

globalThis.rtvcFetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.text();
};

globalThis.rtvcFetchBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

globalThis.rtvcLoadRecentMedia = async () => {
  const db = await openDatabase();
  const records = await requestResult(
    db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).getAll()
  );
  return records
    .sort((a, b) => b.usedAt - a.usedAt)
    .map((record) => ({
      kind: record.kind,
      name: record.name,
      bytes: new Uint8Array(record.bytes),
    }));
};

globalThis.rtvcStoreRecentMedia = async (kind, name, bytes) => {
  const db = await openDatabase();
  const transaction = db.transaction(MEDIA_STORE, "readwrite");
  const store = transaction.objectStore(MEDIA_STORE);
  store.put({
    id: `${kind}:${name}`,
    kind,
    name,
    bytes: Uint8Array.from(bytes).buffer,
    usedAt: Date.now(),
  });
  await transactionDone(transaction);

  const all = await requestResult(
    db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).getAll()
  );
  const stale = all
    .filter((record) => record.kind === kind)
    .sort((a, b) => b.usedAt - a.usedAt)
    .slice(MAX_RECENT_PER_KIND);
  if (stale.length > 0) {
    const cleanup = db.transaction(MEDIA_STORE, "readwrite");
    const cleanupStore = cleanup.objectStore(MEDIA_STORE);
    stale.forEach((record) => cleanupStore.delete(record.id));
    await transactionDone(cleanup);
  }
};

globalThis.rtvcClearRecentMedia = async (kind) => {
  const db = await openDatabase();
  const records = await requestResult(
    db.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).getAll()
  );
  const transaction = db.transaction(MEDIA_STORE, "readwrite");
  const store = transaction.objectStore(MEDIA_STORE);
  records
    .filter((record) => record.kind === kind)
    .forEach((record) => store.delete(record.id));
  await transactionDone(transaction);
};

async function createAudioSink(sampleRate) {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context;
  try {
    context = new AudioContext({ sampleRate });
  } catch {
    context = new AudioContext();
  }
  try {
    await context.audioWorklet.addModule("./audio-worklet.js");
  } catch (error) {
    void context.close();
    throw error;
  }
  const node = new AudioWorkletNode(context, "rtvc-audio", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  node.connect(context.destination);
  const ratio = context.sampleRate / sampleRate;
  let resamplePhase = 0;

  return {
    push(samples) {
      if (samples.length === 0) {
        return;
      }
      const input = Float32Array.from(samples);
      const output = ratio === 1 ? input : resample(input);
      node.port.postMessage(output, [output.buffer]);
    },
    resume() {
      if (context.state !== "running") {
        void context.resume();
      }
    },
  };

  function resample(samples) {
    const converted = [];
    for (const sample of samples) {
      resamplePhase += ratio;
      while (resamplePhase >= 1) {
        converted.push(sample);
        resamplePhase -= 1;
      }
    }
    return new Float32Array(converted);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted"));
  });
}

function installKeyboard(canvas) {
  canvas.tabIndex = 0;
  canvas.addEventListener("pointerdown", () => {
    canvas.focus();
    globalThis.rtvcAudioResume();
  });
  canvas.addEventListener("keydown", (event) => {
    const code = legacyKeyCode(event);
    const text =
      !event.ctrlKey && !event.metaKey && event.key.length === 1 ? event.key : "";
    if (event.repeat || activeKeyCodes.has(event.code)) {
      if (code !== 0 || text) {
        event.preventDefault();
      }
      return;
    }
    if (code !== 0) {
      if (code === 225) {
        keyboardEvents.push({ type: "up", code: 17 });
      }
      activeKeyCodes.set(event.code, code);
      keyboardEvents.push({ type: "down", code, text });
      globalThis.rtvcAudioResume();
      event.preventDefault();
    } else if (text) {
      keyboardEvents.push({ type: "text", text });
      event.preventDefault();
    }
  });
  canvas.addEventListener("keyup", (event) => {
    const code = activeKeyCodes.get(event.code) ?? legacyKeyCode(event);
    activeKeyCodes.delete(event.code);
    if (code !== 0) {
      keyboardEvents.push({ type: "up", code });
      event.preventDefault();
    }
  });
  canvas.addEventListener("blur", resetKeyboard);
  window.addEventListener("blur", resetKeyboard);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetKeyboard();
    }
  });
}

function resetKeyboard() {
  activeKeyCodes.clear();
  keyboardEvents.push({ type: "blur" });
}

function legacyKeyCode(event) {
  if (event.code === "AltRight" && event.getModifierState("AltGraph")) {
    return 225;
  }
  if (event.code.startsWith("Key") && event.code.length === 4) {
    return event.code.charCodeAt(3);
  }
  if (event.code.startsWith("Digit") && event.code.length === 6) {
    return event.code.charCodeAt(5);
  }
  return {
    Backspace: 8,
    Tab: 9,
    Enter: 13,
    NumpadEnter: 13,
    ShiftLeft: 16,
    ShiftRight: 16,
    ControlLeft: 17,
    ControlRight: 17,
    AltLeft: 18,
    AltRight: 18,
    CapsLock: 20,
    Escape: 27,
    Space: 32,
    PageUp: 33,
    PageDown: 34,
    End: 35,
    Home: 36,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Insert: 45,
    Delete: 46,
    Semicolon: 186,
    Equal: 187,
    Comma: 188,
    Minus: 189,
    Period: 190,
    Slash: 191,
    Backquote: 192,
    BracketLeft: 219,
    Backslash: 220,
    BracketRight: 221,
    Quote: 222,
  }[event.code] ?? 0;
}

async function run() {
  await init();
  const canvas = document.getElementById("tvc_canvas");
  globalThis.rtvcStartupAudioError = await globalThis.rtvcAudioInit(44100);
  try {
    globalThis.rtvcStartupRecentMedia = await globalThis.rtvcLoadRecentMedia();
    globalThis.rtvcStartupStorageError = null;
  } catch (error) {
    globalThis.rtvcStartupRecentMedia = [];
    globalThis.rtvcStartupStorageError =
      error instanceof Error ? error.message : String(error);
  }
  installKeyboard(canvas);
  const handle = new WebHandle();
  globalThis.rtvcHandle = handle;
  handle.start("tvc_canvas");
}

run().catch((err) => {
  console.error("Failed to start rtvc: ", err);
});
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_keyboard_filters_held_physical_key_repeats() {
        for app_js in [APP_JS, WEB_FULL_APP_JS] {
            assert!(app_js.contains("const activeKeyCodes = new Map();"));
            assert!(app_js.contains("event.repeat || activeKeyCodes.has(event.code)"));
            assert!(app_js.contains("activeKeyCodes.set(event.code, code);"));
            assert!(app_js.contains("activeKeyCodes.delete(event.code);"));
        }
    }
}
