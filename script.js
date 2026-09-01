/* The holding notice is kept in data/notice.json so it can be rewritten from
   the CMS without anyone opening the markup.

   The sentence is already in index.html, and this only overwrites it when the
   file says something else. That ordering is the whole point: with no script,
   no fetch, or no network, the page still reads correctly — and there is no
   blank moment on load waiting for the text to arrive. */

(function () {

  var el = document.querySelector('.notice');
  if (!el || typeof fetch !== 'function') return;

  fetch('data/notice.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var text = typeof data.notice === 'string' ? data.notice.trim() : '';
      /* An empty field is treated as "leave it alone", not as "erase it" —
         otherwise a stray save from the CMS would blank the page. */
      if (text) el.textContent = text;
    })
    .catch(function () { /* the markup keeps whatever it shipped with */ });

})();
