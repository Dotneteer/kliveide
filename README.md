# Klive IDE

An Electron application built with electron-vite, React, and TypeScript.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# For windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

## Project Structure

```
kliveide/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts
│   └── renderer/       # React renderer process
├── resources/          # App icons and resources
├── build/             # Build resources
└── out/               # Built files
```

## Technologies

- **Electron**: Cross-platform desktop framework
- **Vite**: Fast build tool and dev server
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **electron-vite**: Electron build tooling
