/**
 * Vitest setup: provide a working in-memory localStorage.
 *
 * jsdom only exposes Storage for a real (non-opaque) origin, and Node's own
 * global localStorage is inert unless started with --localstorage-file, so in
 * this environment bare `localStorage` is undefined. The storage lib and its
 * tests both use the bare global, so install a minimal Storage shim on both
 * globalThis and window, refreshed before each test for isolation.
 */
import { beforeEach } from "vitest";

class MemoryStorage {
  constructor() {
    this._data = new Map();
  }
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  }
  setItem(key, value) {
    this._data.set(String(key), String(value));
  }
  removeItem(key) {
    this._data.delete(String(key));
  }
  clear() {
    this._data.clear();
  }
  key(index) {
    return Array.from(this._data.keys())[index] ?? null;
  }
  get length() {
    return this._data.size;
  }
}

function install() {
  const store = new MemoryStorage();
  for (const target of [globalThis, window]) {
    Object.defineProperty(target, "localStorage", {
      value: store,
      writable: true,
      configurable: true,
    });
  }
}

install();
beforeEach(install);
