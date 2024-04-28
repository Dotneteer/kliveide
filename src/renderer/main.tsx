import React from "react";
import ReactDOM from "react-dom/client";

// --- Create the application messenger and the store according to the discriminator parameter
const isEmu = location.search.startsWith("?emu");
const hasIpc = window.electron.ipcRenderer;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <p>
      {isEmu ? "(EMU)" : "(IDE)"} {hasIpc ? "[IPC]" : "[NoIPC]"}Please try pressing <code>F12</code>{" "}
      to open the devTool
    </p>
  </React.StrictMode>
);
