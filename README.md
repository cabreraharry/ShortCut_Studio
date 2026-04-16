[![Electron Logo](https://electronjs.org/images/electron-logo.svg)](https://electronjs.org)

## Installation

To install prebuilt Electron binaries, use [`npm`](https://docs.npmjs.com/).
The preferred method is to install Electron as a development dependency in your
app:

```sh
npm install electron --save-dev
```

## Run Project

```sh
npm install
npm start
```

## Build(Windows)

```sh
npm run package-win
```


## Development Tools

You can add this code to index.js for debugging.

```sh
mainWindow.webContents.openDevTools();
```

