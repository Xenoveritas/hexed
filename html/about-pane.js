/**
 * Simple module for displaying about information.
 */
function AboutPane(pane) {
  pane.title = 'About';
  pane.contents.innerHTML = '<h1>Hexed</h1><p>Hexed hexidecimal file viewer.</p><p>Running on io.js ' + process.version + ' and Electron ' + process.versions['electron'] + '.</p>';
}

module.exports = AboutPane;
