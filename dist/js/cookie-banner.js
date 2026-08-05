/*
  Cookie notice.

  The site sets exactly one cookie — the session cookie of the members' area
  (chogar_sid), which is strictly necessary and therefore does not require
  consent (§ 25 (2) no. 2 TDDDG). This banner is purely informational: it tells
  visitors about that cookie and links to the privacy policy.

  If tracking, analytics or embedded third-party content (Maps, YouTube, ...)
  are ever added, this has to become a real consent banner — with an equally
  prominent "Decline" button, no loading of those services before consent, and
  a way to withdraw consent later.
*/

(function () {
  var STORAGE_KEY = 'chogar-cookie-notice';
  var VALUE = 'acknowledged';

  /* Private mode can make localStorage throw — never break the page over it. */
  function readAck() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeAck() {
    try {
      window.localStorage.setItem(STORAGE_KEY, VALUE);
    } catch (e) {
      /* Nothing to do — the notice simply shows again on the next visit. */
    }
  }

  function build() {
    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie notice');

    banner.innerHTML =
      '<div class="cookie-banner-inner">' +
      '<p class="cookie-banner-text">' +
      'This website uses only technically necessary cookies — a single session cookie that keeps you signed in to the members’ area. ' +
      'We use no tracking, no analytics and no advertising cookies. ' +
      '<a href="privacy.html">Learn more in our Privacy Policy</a>.' +
      '</p>' +
      '<button type="button" class="btn btn-primary cookie-banner-btn">Got it</button>' +
      '</div>';

    banner.querySelector('.cookie-banner-btn').addEventListener('click', function () {
      writeAck();
      banner.classList.remove('is-visible');
      window.setTimeout(function () {
        banner.remove();
      }, 400);
    });

    document.body.appendChild(banner);

    /*
      Force a layout pass before flipping the class, so the browser has a start
      value to animate from. A rAF callback would do the same, but is deferred
      while the tab is in the background — the banner would then be stuck
      off-screen until the tab is looked at.
    */
    void banner.offsetWidth;
    banner.classList.add('is-visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (readAck() === VALUE) {
      return;
    }
    build();
  });
})();
