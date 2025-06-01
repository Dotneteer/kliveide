import React from 'react'
import ReactDOM from 'react-dom/client'
import EmulatorApp from './EmulatorApp.tsx'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EmulatorApp />
  </React.StrictMode>,
)
