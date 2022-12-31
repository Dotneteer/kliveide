import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StoreProvider from "./emu/StoreProvider"
import "@styles/index.css"
import ThemeProvider from './theming/ThemeProvider'
import { IdeProvider } from './ide/IdeServicesProvider'

console.log(window.location.search);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <ThemeProvider>
        <IdeProvider>
          <App />
        </IdeProvider>
      </ThemeProvider>
    </StoreProvider>
  </React.StrictMode>
);

postMessage({ payload: 'removeLoading' }, '*')
