/**
 * storage.js
 *
 * A thin wrapper around localStorage so the rest of the app
 * doesn't have to worry about JSON parsing, try/catch, or the fact
 * that localStorage is blocked when opening HTML files directly (file://).
 *
 * How it works:
 *   - Always saves to an in-memory object (_mem) as a safety net.
 *   - If localStorage is available, saves there too so data survives refreshes.
 *   - If localStorage is unavailable, the in-memory copy keeps things running
 *     for the current session (data will be lost on page close — that's okay).
 */
class StorageService {

  // In-memory fallback — only lives as long as the current page session
  static _mem = {};

  // Quick check: can we actually use localStorage right now?
  static _canUseLS() {
    try {
      localStorage.setItem('__els_test__', '1');
      localStorage.removeItem('__els_test__');
      return true;
    } catch (e) {
      return false; // happens on file:// protocol or when storage is blocked
    }
  }

  // Reads and parses a stored value. Returns null if the key doesn't exist.
  static get(key) {
    try {
      if (this._canUseLS()) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      }
      return this._mem[key] ?? null;
    } catch (e) {
      // Parsing failed or something unexpected — fall back to memory
      return this._mem[key] ?? null;
    }
  }

  // Saves any value (auto-serialized to JSON). Updates both memory and localStorage.
  static set(key, value) {
    try {
      const json = JSON.stringify(value);
      this._mem[key] = value; // always keep memory in sync
      if (this._canUseLS()) {
        localStorage.setItem(key, json);
      }
      return true;
    } catch (e) {
      // localStorage might be full or blocked — memory save is enough to keep going
      this._mem[key] = value;
      return true;
    }
  }

  // Deletes a single key from both memory and localStorage
  static remove(key) {
    delete this._mem[key];
    try { localStorage.removeItem(key); } catch (e) {}
  }

  // Wipes everything — used on logout or full system reset
  static clear() {
    StorageService._mem = {};
    try { localStorage.clear(); } catch (e) {}
  }
}
