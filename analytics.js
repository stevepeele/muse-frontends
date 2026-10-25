/* Muse Frontends — PostHog analytics. Requires config.js loaded before this file.
   No-ops until window.MUSEFRONTENDS_CONFIG.posthogKey is set. */
"use strict";

var POSTHOG_KEY =
  (window.MUSEFRONTENDS_CONFIG && window.MUSEFRONTENDS_CONFIG.posthogKey) || null;
var POSTHOG_HOST = "https://us.i.posthog.com";
var APP_ID = "muse-frontends";

var _phReady = false;
function _initPostHog() {
  if (_phReady || !POSTHOG_KEY || typeof window === "undefined") return;
  _phReady = true;
  (function (t, e) {
    var o, n, p, r;
    e.__SV || ((window.posthog = e), (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split(".");
          2 == o.length && ((t = t[o[0]]), (e = o[1]));
          t[h] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
        }
        (p = t.createElement("script")).type = "text/javascript";
        p.async = !0; p.src = s.api_host + "/static/array.js";
        (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
        var u = e; void 0 !== a ? (u = e[a] = []) : (a = "posthog");
        u.people = u.people || [];
        u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " stack"), e; };
        u._i.push([i, s, a]);
      }),
      e.__SV = 1)
  })(document, (window.posthog = window.posthog || []));
  window.posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    /* Belt: array.js loads async — also fire the pageview when it's ready.
       Do NOT depend on this callback (it proved unreliable with the snippet
       pattern); the polling flusher below is the real mechanism. */
    loaded: function () { _flushPageview(); },
  });
}

function track(event, props) {
  try {
    if (!POSTHOG_KEY) return;
    _initPostHog();
    if (window.posthog && window.posthog.capture) {
      window.posthog.capture(event, Object.assign({ app: APP_ID }, props || {}));
    }
  } catch (e) { /* analytics must never break the app */ }
}

function identify(userId, traits) {
  try {
    if (!POSTHOG_KEY) return;
    _initPostHog();
    if (window.posthog && window.posthog.identify) {
      window.posthog.identify(userId, traits || {});
    }
  } catch (e) {}
}

/* $pageview on load — via the polling flusher, NOT at script eval.
   Firing capture() on the array stub at eval time silently drops the event
   (array.js loads async). _flushPageview polls until capture is real. */
var _pageviewWanted = false;
var _pageviewFired = false;
var _pageviewTries = 0;
function _flushPageview() {
  if (!_pageviewWanted || _pageviewFired) return;
  try {
    if (window.posthog && typeof window.posthog.capture === "function") {
      window.posthog.capture("$pageview",
        Object.assign({ app: APP_ID }, { path: location.pathname }));
      _pageviewFired = true;
      return;
    }
  } catch (e) { /* analytics must never break the app */ }
  if (++_pageviewTries < 60) setTimeout(_flushPageview, 500);
}

_initPostHog();
_pageviewWanted = true;
_flushPageview();
