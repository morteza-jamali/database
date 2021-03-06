/* eslint global-require: off, no-console: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import routes from './constants/routes.json';
import Github from './github/Github';
import './modules/Server';
import { LocalStorage } from './modules/StoreData';
import appConfig from './constants/app.config.json';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let github_storage: any = null;
let github = new Github();

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true'
) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(__dirname, '../resources');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    center: true,
    backgroundColor: '#323130',
    resizable: true,
    frame: false,
    show: false,
    width: 400,
    height: 400,
    minHeight: 400,
    minWidth: 400,
    maxHeight: 400,
    maxWidth: 400,
    icon: getAssetPath('icon.png'),
    webPreferences:
      (process.env.NODE_ENV === 'development' ||
        process.env.E2E_BUILD === 'true') &&
      process.env.ERB_SECURE !== 'true'
        ? {
            nodeIntegration: true,
          }
        : {
            preload: path.join(__dirname, 'dist/renderer.prod.js'),
          },
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  let logo_window_showed: boolean = false;
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }

    github_storage = new LocalStorage(
      mainWindow,
      appConfig.STORAGE.SCOPE.GITHUB
    );

    if (!logo_window_showed) {
      setTimeout(async () => {
        logo_window_showed = !logo_window_showed;
        let access_token = await github_storage.getItem(
          appConfig.STORAGE.KEY.ACCESS_TOKEN
        );
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow?.setMaximumSize(width, height);
        mainWindow?.setSize(1024, 728);
        mainWindow?.center();
        mainWindow?.webContents.send('changeRoute', routes.WELCOME);
      }, 6000);
    }
  });

  mainWindow.webContents.on('will-navigate', async (event: any, url: any) => {
    if (url.includes('localhost') && url.includes('app=github')) {
      let access_token: any = await github.getAccessToken(url);
      if (!access_token) {
        console.log('Github authentication failed !');
      } else {
        await github_storage.setItem(appConfig.STORAGE.KEY.ACCESS_TOKEN, {
          access_token,
          login: true,
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Managing connection between Main and Render process
 */
ipcMain.on('githubAuthenticate', (event: any, arg: any) => {
  mainWindow?.loadURL(github.getAuthURL());
});

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

if (process.env.E2E_BUILD === 'true') {
  // eslint-disable-next-line promise/catch-or-return
  app.whenReady().then(createWindow);
} else {
  app.on('ready', createWindow);
}

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});
