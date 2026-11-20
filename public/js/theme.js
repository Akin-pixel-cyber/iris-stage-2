// Loaded in <head> so the right theme is applied before the page paints (no flash).
(function () {
  var KEY = 'iris_theme', mq = window.matchMedia('(prefers-color-scheme: dark)');
  function mode() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
  function apply() { var m = mode(); document.documentElement.setAttribute('data-theme', m === 'system' ? (mq.matches ? 'dark' : 'light') : m); }
  window.IrisTheme = { get: mode, set: function (m) { try { localStorage.setItem(KEY, m); } catch (e) {} apply(); } };
  mq.addEventListener && mq.addEventListener('change', function () { if (mode() === 'system') apply(); });
  apply();
})();
