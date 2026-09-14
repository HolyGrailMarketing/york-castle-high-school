/**
 * Shared plumbing for the signed-in student pages (application-status.html,
 * my-books.html).
 *
 * These pages get their token from the unified sign-in page as a ?token=
 * parameter, keep it in sessionStorage under `sf_token`, and send it as a
 * bearer header themselves. That is deliberately NOT the same store the site
 * chrome and the admin dashboard use (localStorage `auth_token`): a portal
 * session ends when the tab closes, which is the right default on the shared
 * computers in the library and the labs.
 *
 * Exposed as window.portalAuth rather than a module so the pages can keep using
 * a plain <script> tag, like the rest of the site.
 */
(function () {
  'use strict';

  var TOKEN_KEY = 'sf_token';
  var API = '/api';

  /**
   * Take a token out of the URL and put it somewhere it will survive a reload,
   * then scrub the URL so it is not left in the address bar, the history, or a
   * copied link.
   */
  function captureToken() {
    var params = new URLSearchParams(window.location.search);

    var error = params.get('error');
    if (error) {
      window.location.replace('signin.html?error=' + encodeURIComponent(error));
      return null;
    }

    var fromUrl = params.get('token');
    if (fromUrl) {
      try {
        sessionStorage.setItem(TOKEN_KEY, fromUrl);
      } catch (e) {
        // Private mode. The token still works for this page load; the visitor
        // will simply be asked to sign in again on the next one.
      }
      history.replaceState({}, document.title, window.location.pathname);
      return fromUrl;
    }

    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* nothing to do */ }
  }

  function goSignIn() {
    window.location.replace('signin.html');
  }

  /**
   * GET a portal endpoint with the bearer token attached.
   *
   * A 401 means the session is over, so it clears the token and sends the
   * visitor to sign in rather than leaving them looking at an error they can do
   * nothing about.
   */
  function apiGet(path, token) {
    return fetch(API + path, {
      headers: { Authorization: 'Bearer ' + token },
    }).then(function (response) {
      if (response.status === 401) {
        clearToken();
        goSignIn();
        throw new Error('Session expired');
      }
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.message || body.error || 'Could not load your details');
        });
      }
      return response.json();
    });
  }

  /** Escape before putting anything from the database into innerHTML. */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-JM', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Show exactly one of a set of views. */
  function viewSwitcher(ids) {
    return function show(id) {
      ids.forEach(function (candidate) {
        var el = document.getElementById(candidate);
        if (el) el.classList.toggle('hidden', candidate !== id);
      });
    };
  }

  window.portalAuth = {
    API: API,
    captureToken: captureToken,
    clearToken: clearToken,
    goSignIn: goSignIn,
    apiGet: apiGet,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    viewSwitcher: viewSwitcher,
  };
})();
