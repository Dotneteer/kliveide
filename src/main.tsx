import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StoreProvider from './emu/StoreProvider'
import 'styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
);

postMessage({ payload: 'removeLoading' }, '*')
