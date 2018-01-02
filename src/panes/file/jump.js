/**
 * Jump to popup.
 */
"use strict";

export default class JumpToPopup {
  constructor(filepane) {
    this.filepane = filepane;
    let template = document.getElementById('hex-file-jump-to-template');
    let clone = document.importNode(template.content, true);
    this._popup = clone.querySelector('hexed-popup');
    this._address = clone.querySelector('x-input');
    this._button = clone.querySelector('x-button');
    this._button.addEventListener('click', (event) => {
      this.jump();
    });
    this._address.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.jump();
      }
    });
    this._address.validate = () => {
      let address = this.value;
      if (address === null) {
        this._address.error = "Invalid jump address";
      } else if (address < 0 || address > filepane.file.size) {
        this._address.error = "Address out of range";
      } else {
        this._address.error = null;
      }
    };
    filepane.contents.append(this._popup);
  }
  get value() {
    // Parse the jump address
    let address = this._address.value;
    let m = /^(?:0x|[$#])([0-9A-Fa-f]{1,16})$/.exec(address);
    if (m) {
      return parseInt(m[1], 16);
    } else if (/^0[0-7]{1,21}$/.test(address)) {
      return parseInt(address, 8);
    } else if (/^[0-9]{1,20}$/.test(address)) {
      return parseInt(address, 10);
    } else {
      return null;
    }
  }
  jump() {
    // Parse the jump address
    let address = this._address.value;
    if (address.length === 0) {
      return;
    }
    let relative = false;
    if (address[0] === '-') {
      relative = -1;
      address = address.substring(1);
    } else if (address[0] === '+') {
      relative = 1;
      address = address.substring(1);
    }
    let m = /^(?:0x|[$#])([0-9A-Fa-f]{1,16})$/.exec(address);
    if (m) {
      address = parseInt(address, 16);
    } else if (/^0[0-7]{1,21}$/.test(address)) {
      address = parseInt(address, 8);
    } else if (/^[0-9]{1,20}$/.test(address)) {
      address = parseInt(address, 10);
    } else {
      this._address.error = "Bad format";
      return;
    }
    if (relative) {
      this.filepane.jumpToRelative(address * relative);
    } else if (!this.filepane.jumpTo(address)) {
      this._address.error = "Address out of range";
    }
    this.filepane.focus();
    this.hide();
  }
  hide() {
    this._popup.hide();
  }
  show(address) {
    this._address.value = '0x' + address.toString(16).padStart(address <= 0xFFFFFFFF ? 8 : 16, '0');
    this._popup.show();
    this._address.focus();
  }
}
