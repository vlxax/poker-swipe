// Shared jsdom ResourceLoader for legacy Polyana tests (local app.local files + stubbed CDN scripts).
import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';

const { ResourceLoader } = jsdomPkg;

export class LocalAppResourceLoader extends ResourceLoader {
  constructor(appRoot) {
    super();
    this.appRoot = appRoot;
  }

  fetch(url, options) {
    const parsed = new URL(String(url));
    if (parsed.hostname !== 'app.local') {
      const el = options && options.element;
      const asScript = el && (el.localName === 'script' || el.tagName === 'SCRIPT');
      if (asScript || /\.m?js(\?|$)/i.test(parsed.pathname)) {
        if (parsed.hostname === 'telegram.org') {
          return Promise.resolve(Buffer.from(
            'window.Telegram={WebApp:{ready(){},expand(){},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},initData:"",initDataUnsafe:{},version:"6.0",platform:"unknown"}}};'
          ));
        }
        return Promise.resolve(Buffer.from(''));
      }
      return Promise.resolve(null);
    }
    const file = path.join(this.appRoot, decodeURIComponent(parsed.pathname.replace(/^\//, '')));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return Promise.resolve(Buffer.from(fs.readFileSync(file)));
    }
    return Promise.resolve(Buffer.from(''));
  }
}

export function stubBrowserChrome(window) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; }
  });
}
