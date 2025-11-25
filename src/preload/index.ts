import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

// --- Custom APIs for renderer
const api = {};

// --- Use `contextBridge` APIs to expose Electron APIs to renderer only if context isolation
// --- is enabled, otherwise just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}

// --- When the DOM is ready, remove the loading animation
function domReady(condition: DocumentReadyState[] = ["complete", "interactive"]) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener("readystatechange", () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

// --- Safe DOM manipulation
const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    return !Array.from(parent.children).find((e) => e === child) ? parent.appendChild(child) : null;
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    return Array.from(parent.children).find((e) => e === child) ? parent.removeChild(child) : null;
  }
};

/**
 * Loading animation with Klive logo
 */
function useLoading() {
  const styleContent = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}

@keyframes slideDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes colorBarGlow {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  z-index: 9;
  animation: fadeIn 0.3s ease-out;
}

.klive-logo-container {
  width: 200px;
  height: 200px;
  margin-bottom: 40px;
  animation: pulse 2s ease-in-out infinite;
}

.klive-logo-container svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 20px rgba(0, 180, 204, 0.5));
}

.color-bars-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  animation: slideDown 0.5s ease-out;
}

.color-bars-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  animation: slideUp 0.5s ease-out;
}

.color-bar {
  flex: 1;
  animation: colorBarGlow 2s ease-in-out infinite;
}

.color-bar:nth-child(1) { background: #0ff; animation-delay: 0s; }
.color-bar:nth-child(2) { background: #0f0; animation-delay: 0.1s; }
.color-bar:nth-child(3) { background: #ff0; animation-delay: 0.2s; }
.color-bar:nth-child(4) { background: #f00; animation-delay: 0.3s; }

.loading-text {
  color: #00B4CC;
  font-family: 'Courier New', monospace;
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 4px;
  animation: pulse 2s ease-in-out infinite;
  text-shadow: 0 0 10px rgba(0, 180, 204, 0.8);
}

.loading-dots {
  display: inline-block;
  width: 40px;
  text-align: left;
}
    `;
  const oStyle = document.createElement("style");
  const oDiv = document.createElement("div");

  oStyle.id = "app-loading-style";
  oStyle.innerHTML = styleContent;
  oDiv.className = "app-loading-wrap";
  oDiv.innerHTML = `
    <div class="color-bars-top">
      <div class="color-bar"></div>
      <div class="color-bar"></div>
      <div class="color-bar"></div>
      <div class="color-bar"></div>
    </div>
    
    <div class="klive-logo-container">
      <svg width="200" height="200" viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect width='100%' height='100%' fill='#000' />
        <path d='M 200 149 l 0 -20 l -70 70 l 20 0' fill='#0ff' />
        <path d='M 200 129 l 0 -20 l -90 90 l 20 0' fill='#0f0' />
        <path d='M 200 109 l 0 -20 l -110 110 l 20 0' fill='#ff0' />
        <path d='M 200 89 l 0 -20 l -130 130 l 20 0' fill='#f00' />
        <path d='M 0 0 l 200 0 l 0 8 l -200 0' fill='#00B4CC' />
        <path d='M 0 200 l 200 0 l 0 -8 l -200 0' fill='#00B4CC' />
        <path d='M 0 0 l 0 200 l 8 0 l 0 -200' fill='#00B4CC' />
        <path d='M 192 0 l 0 200 l 8 0 l 0 -200' fill='#00B4CC' />
        <path d='M 40 40 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 40 60 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 40 80 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 40 100 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 40 120 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 40 140 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 60 80 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 80 80 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 100 100 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 120 120 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 140 140 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 100 60 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
        <path d='M 120 40 l 20 0 l 0 20 l -20 0 l 0 -20' fill='#00B4CC' />
      </svg>
    </div>
    
    <div class="loading-text">
      LOADING<span class="loading-dots" id="loading-dots"></span>
    </div>
    
    <div class="color-bars-bottom">
      <div class="color-bar"></div>
      <div class="color-bar"></div>
      <div class="color-bar"></div>
      <div class="color-bar"></div>
    </div>
  `;

  // Animate loading dots
  let dotCount = 0;
  const dotsInterval = setInterval(() => {
    const dotsElement = document.getElementById('loading-dots');
    if (dotsElement) {
      dotCount = (dotCount + 1) % 4;
      dotsElement.textContent = '.'.repeat(dotCount);
    }
  }, 500);

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      clearInterval(dotsInterval);
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    }
  };
}

// --- Apply the loading animation
const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

let loadingRemoved = false;

window.onmessage = (ev: { data: { payload: string } }) => {
  if (ev.data.payload === "removeLoading" && !loadingRemoved) {
    loadingRemoved = true;
    removeLoading();
  }
};

// --- Remove the loading animation after 10 seconds maximum
setTimeout(() => {
  if (!loadingRemoved) {
    loadingRemoved = true;
    removeLoading();
  }
}, 10000);
