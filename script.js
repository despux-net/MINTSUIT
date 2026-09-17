/* The notice is kept in data/notice.txt — plain text, so there is no syntax to
   get wrong. Blank lines separate paragraphs; everything else is published as
   typed.

   The sentence already in index.html is the default, and this only replaces it
   when the file says something else. That ordering is the point: with no
   script, no network, or an empty file, the page still reads correctly and
   never blinks empty while it waits. */

(function () {

  var el = document.querySelector('.notice');
  if (!el || typeof fetch !== 'function') return;

  /* Past this, a line set in letter-spaced small caps stops being a label and
     starts being something you have to read; it gets ordinary type instead. */
  var SHORT = 90;

  fetch('data/notice.txt', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (raw) {

      var paragraphs = raw.split(/\n\s*\n|\n/)
                          .map(function (p) { return p.trim(); })
                          .filter(Boolean);

      /* An empty file means "leave it alone", not "erase it" — otherwise one
         stray save would blank the page. */
      if (!paragraphs.length) return;

      if (paragraphs.length === 1 && paragraphs[0].length <= SHORT) {
        el.textContent = paragraphs[0];
        return;
      }

      el.className = 'notice notice-long';
      el.textContent = '';
      paragraphs.forEach(function (text) {
        var p = document.createElement('p');
        p.textContent = text;
        el.appendChild(p);
      });
    })
    .catch(function () { /* the markup keeps whatever it shipped with */ });

})();


/* The background photo is picked in data/background.json, which the Pages CMS
   panel writes whenever a new image is uploaded, so the file name can be
   anything. The image is loaded before it is shown; if the file is missing,
   empty, or points at an image that will not load, the New York skyline
   takes its place, and a slow network gets it too rather than a black page. */

(function () {

  var el = document.querySelector('.backdrop');
  if (!el) return;

  var FALLBACK = 'assets/nyc.jpg';
  var shown = false;
  var timer;

  /* Names typed by hand can hold spaces; ones that are already escaped
     are left alone so they are not escaped twice. */
  function address(src) {
    return /%[0-9a-f]{2}/i.test(src) ? src : encodeURI(src);
  }

  function show(src) {
    if (shown) return;
    shown = true;
    clearTimeout(timer);
    el.style.backgroundImage = 'url("' + address(src).replace(/"/g, '%22') + '")';
    el.className += ' ready';
  }

  function load(src, onFail) {
    var img = new Image();
    img.onload = function () { show(src); };
    img.onerror = onFail;
    img.src = address(src);
  }

  function fallback() {
    load(FALLBACK, function () { show(FALLBACK); });
  }

  /* Past this, stop waiting for the chosen photo and show the default. */
  timer = setTimeout(fallback, 4000);

  if (typeof fetch !== 'function') return fallback();

  fetch('data/background.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (data) {
      var src = data && typeof data.image === 'string' ? data.image.trim() : '';
      if (!src) return fallback();
      if (!/^https?:\/\//.test(src)) src = src.replace(/^\/+/, '');
      load(src, fallback);
    })
    .catch(fallback);

})();
