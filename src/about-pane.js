let version = null;

function getVersion() {
  if (version != null) {
    return version;
  } else {
    let packageJson = require('../package.json');
    version = packageJson['version'];
    return version;
  }
}

/**
 * Simple module for displaying about information.
 */
function AboutPane(pane) {
  pane.title = 'About';
  pane.contents.className += ' about';
  pane.contents.innerHTML = '<h1>Hexed ' + getVersion() + '</h1><p>Hexed file viewer.</p><p>Built using Electron ' + process.versions['electron'] + '.</p>';
}

module.exports = AboutPane;
