import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';

const { ResourceLoader } = jsdomPkg;

const DEFAULT_MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.png': 'image/png'
};

/**
 * jsdom ResourceLoader that serves this repo over http://app.local/.
 * Replaces the old requestInterceptor API, which jsdom 26 does not export.
 */
export function createAppLocalResourceLoader(root, mime = DEFAULT_MIME) {
  return class AppLocalResourceLoader extends ResourceLoader {
    fetch(urlString, options) {
      let parsed;
      try {
        parsed = new URL(urlString);
      } catch {
        return super.fetch(urlString, options);
      }
      if (parsed.hostname === 'telegram.org' || parsed.hostname.endsWith('.telegram.org')) {
        const empty = Promise.resolve(Buffer.from(''));
        empty.abort = () => {};
        return empty;
      }
      if (parsed.hostname !== 'app.local') {
        return super.fetch(urlString, options);
      }
      const file = path.join(root, decodeURIComponent(parsed.pathname.replace(/^\//, '')));
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return this._readFile(file);
      }
      return Promise.reject(new Error(`Resource was not loaded. Status: 404 ${urlString}`));
    }
  };
}

export { DEFAULT_MIME as APP_LOCAL_MIME };
