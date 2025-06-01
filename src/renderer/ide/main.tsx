import React from 'react'
import ReactDOM from 'react-dom/client'
import IdeApp from './IdeApp.tsx'
import './ide.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IdeApp />
  </React.StrictMode>,
)
