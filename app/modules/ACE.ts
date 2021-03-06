import Ace from 'ace-builds/src-noconflict/ace';
import url from 'url';
import path from 'path';

export default class ACE {
  editor: any;
  selector: string;

  constructor(selector: string) {
    Ace.config.set('basePath', '../node_modules/ace-builds/src-noconflict');
    Ace.config.setModuleUrl(
      'ace/theme/vscodeDark',
      url.pathToFileURL(path.resolve(__dirname, '../app/themes/vscodeDark.js'))
    );
    this.selector = selector;
  }

  init(config: any) {
    let element: any = document.querySelector(this.selector);
    this.editor = element ? Ace.edit(element) : undefined;
    'theme' in config ? this.setTheme(config.theme) : undefined;
    'mode' in config ? this.setMode(config.mode) : undefined;
    'showPrintMargin' in config
      ? this.editor.setShowPrintMargin(config.showPrintMargin)
      : undefined;
  }

  setTheme(theme: string) {
    this.editor?.setTheme(`ace/theme/${theme}`);
  }

  setMode(mode: string) {
    this.editor?.session?.setMode(`ace/mode/${mode}`);
  }
}
