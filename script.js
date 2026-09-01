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
