/**
 * @module hex-menu
 * Module for creating the menus.
 */

var app = require('app');
var BrowserWindow = require('browser-window');
var Menu = require('menu');

function createTemplate() {
  var command = process.platform == 'darwin' ? 'Command' : 'Ctrl';
  return [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: command + '+O',
          click: function() { BrowserWindow.getFocusedWindow().hexed.showOpenDialog(); }
        },
        {
          type: 'separator'
        },
        {
          label: 'Exit',
          click: function() {
            // TODO: Not this
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Jump to position',
          accelerator: command + '+J',
          click: function() { BrowserWindow.getFocusedWindow().hexed.showJumpDialog(); }
        },
        {
          label: 'Run JavaScript',
          accelerator: 'Alt+' + command + '+J',
          click: function() { BrowserWindow.getFocusedWindow().hexed.runJavaScript(); }
        },
        {
          type: 'separator'
        },
        {
          label: 'Reload',
          accelerator: command + '+R',
          click: function() { BrowserWindow.getFocusedWindow().reloadIgnoringCache(); }
        },
        {
          label: 'Toggle DevTools',
          accelerator: command + '+Shift+I',
          click: function() { BrowserWindow.getFocusedWindow().toggleDevTools(); }
        },
      ]
    }
  ]
};

function createMenu() {
  return Menu.buildFromTemplate(createTemplate());
}

exports.createTemplate = createTemplate;
exports.createMenu = createMenu;
