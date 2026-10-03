import init, { WebHandle } from "./rtvc.js";

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
