/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7b16fee0'], (function (workbox) { 'use strict';

  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "tailwind.min.js",
    "revision": "7a614b9a197e532c00d09a23b0996b5f"
  }, {
    "url": "pwa-screenshot-wide.png",
    "revision": "85910d5e687356f5f110ea4444078db9"
  }, {
    "url": "pwa-screenshot-mobile.png",
    "revision": "dbeff45bb41639de9753f393d1cde1c1"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2f280c307f7e36c2178437015de2d1c0"
  }, {
    "url": "pwa-512x512.png",
    "revision": "222212bb4a3d26596826190a9ba1ef6e"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9aaac76f55ae338c38e67d7c6ce26614"
  }, {
    "url": "index.html",
    "revision": "3630c98b5aaddf1560828f82d35a4269"
  }, {
    "url": "icon.svg",
    "revision": "158d1f552ec9d1bd604daf39f971759d"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "23812cc7051fc2e12c01280c59475b61"
  }, {
    "url": "assets/xlsx-vendor-BBWTpfDg.js",
    "revision": null
  }, {
    "url": "assets/recharts-vendor-DvQCXVsj.js",
    "revision": null
  }, {
    "url": "assets/react-vendor-D8WEC4K0.js",
    "revision": null
  }, {
    "url": "assets/index-DJAqZOd2.js",
    "revision": null
  }, {
    "url": "assets/index-CehtOLVh.css",
    "revision": null
  }, {
    "url": "assets/icons-DUktxp8s.js",
    "revision": null
  }, {
    "url": "assets/firebase-vendor-BWi4Xila.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "23812cc7051fc2e12c01280c59475b61"
  }, {
    "url": "icon.svg",
    "revision": "158d1f552ec9d1bd604daf39f971759d"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9aaac76f55ae338c38e67d7c6ce26614"
  }, {
    "url": "pwa-512x512.png",
    "revision": "222212bb4a3d26596826190a9ba1ef6e"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2f280c307f7e36c2178437015de2d1c0"
  }, {
    "url": "manifest.webmanifest",
    "revision": "e742f3eaa3eb5b9a3c221e17945275c0"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
