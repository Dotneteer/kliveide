import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StoreProvider from "./emu/StoreProvider"
import "@styles/index.css"
import ThemeProvider from './theming/ThemeProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StoreProvider>
  </React.StrictMode>
);

postMessage({ payload: 'removeLoading' }, '*')
