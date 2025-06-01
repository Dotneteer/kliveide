# Klive IDE

An Electron application built with electron-vite, React, and TypeScript.

## Getting Started

### Development

```bash
npm install
npm run dev
```

### Building

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

## Project Structure

```
src/
├── main/           # Electron main process
├── preload/        # Electron preload scripts
└── renderer/       # React renderer process
    ├── assets/     # Static assets
    ├── App.tsx     # Main React component
    ├── main.tsx    # React entry point
    └── index.html  # HTML template
```

## Technology Stack

- **Electron**: Cross-platform desktop app framework
- **electron-vite**: Build tool for Electron apps with Vite
- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
