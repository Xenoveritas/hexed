let version = null;

function getVersion() {
  if (version != null) {
    return version;
  } else {
    let packageJson = require('../../package.json');
    version = packageJson['version'];
    return version;
  }
}

import {Pane} from '../workspace.js';

export class AboutPane extends Pane {
  constructor() {
    super();
    this.title = 'About';
    this.contents.className += ' about';
    this.contents.innerHTML = '<h1>Hexed ' + getVersion() + '</h1><p>Hexed file viewer.</p><p>Built using Electron ' + process.versions['electron'] + '.</p>';
  }
}

module.exports = AboutPane;
