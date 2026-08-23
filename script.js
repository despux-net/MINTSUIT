/* The gold portal: tracks with a video open it here instead of leaving the page.
   Nothing is requested from YouTube until a track is actually clicked. */

(function () {

  var overlay  = document.getElementById('portal');
  var frame    = document.getElementById('portal-frame');
  var title    = document.getElementById('portal-title');
  var bandcamp = document.getElementById('portal-bc');
  var closeBtn = document.getElementById('portal-close');

  if (!overlay || !frame) return;   /* markup missing: links fall back to YouTube */

  var opener = null;

  function open(link) {
    opener = link;
    title.textContent = link.textContent;
    bandcamp.href = link.getAttribute('data-bandcamp');
    /* controls=0 is what keeps the player clean: the title, the channel
       watermark and the share buttons are all part of that chrome.
       Clicking the picture still toggles play/pause. */
    frame.src = 'https://www.youtube-nocookie.com/embed/'
              + link.getAttribute('data-video')
              + '?autoplay=1&controls=0&rel=0&modestbranding=1'
              + '&iv_load_policy=3&playsinline=1';
    overlay.className = 'portal-overlay open';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.className = 'locked';
    closeBtn.focus();
  }

  function close() {
    overlay.className = 'portal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    frame.src = '';                 /* clearing the src is what stops the audio */
    document.body.className = '';
    if (opener) { opener.focus(); opener = null; }
  }

  var links = document.getElementsByClassName('portal');
  for (var i = 0; i < links.length; i++) {
    links[i].onclick = function (e) {
      e.preventDefault();
      open(this);
    };
  }

  closeBtn.onclick = close;

  overlay.onclick = function (e) {
    if (e.target === overlay) close();   /* click outside the frame */
  };

  document.onkeydown = function (e) {
    if ((e.key === 'Escape' || e.keyCode === 27) && overlay.className.indexOf('open') > -1) {
      close();
    }
  };

})();
