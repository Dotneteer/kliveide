# Klive IDE

## Source code structure

This figure shows the source code structure of the project (essential files and folders only):

```
|-- _docs: temporary files for documentation
|-- .vscode: VS Code setting
|-- dist: distribution files for the Electron renderer process (not committed to repo)
|-- node_modules: node files (not commited to repo)
|-- dist-electron: distribution files for the Electron renderer process (not committed to repo)
|-- public: public resources used by the main and renderer processes
|-- release: released build files (not committed to repo)
|-- src: the root folder of all source code files
    |-- common: common code available in the main and renderer processes
    |-- 
|-- test: the root folder for all test files
|-- index.htlm: the start file for both renderer (EMU and IDE) processes
|-- package.json: the package file of the project
|-- tsconfig.json: the renderer processes' TypeScript configuration
|-- tsconfig.node.json: the main process's TypeScript configuration
|-- vite.config.js
```