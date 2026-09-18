/* The player skin on the desktop page. It does not stream anything itself:
   the tracks live on Bandcamp, so choosing a row puts it on the display and
   the play button opens that track there. Without this script every row is
   an ordinary link to its Bandcamp page, which is the same destination. */

(function () {

  var player = document.querySelector('.player');
  if (!player) return;

  var rows = Array.prototype.slice.call(player.querySelectorAll('[data-track]'));
  if (!rows.length) return;

  var title = player.querySelector('[data-title]');
  var length = player.querySelector('[data-length]');
  var play = player.querySelector('[data-play]');
  var album = player.querySelector('[data-album]');
  var current = 0;

  function select(index) {
    current = (index + rows.length) % rows.length;
    var row = rows[current];

    rows.forEach(function (r) { r.removeAttribute('aria-current'); });
    row.setAttribute('aria-current', 'true');

    title.textContent = row.getAttribute('data-label');
    length.textContent = row.getAttribute('data-length');
    play.href = row.href;
    album.href = row.getAttribute('data-album-url');

    /* Restart the scrolling title so a new name starts from the edge. */
    title.style.animation = 'none';
    void title.offsetWidth;
    title.style.animation = '';

    /* Keep the chosen row in view inside the playlist, not the page. */
    var list = row.closest('.playlist');
    var top = row.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - list.clientHeight / 2;
    }
  }

  /* As in the players this imitates: a click picks the track, a double
     click plays it. */
  rows.forEach(function (row, i) {
    row.addEventListener('click', function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      select(i);
    });
    row.addEventListener('dblclick', function () {
      window.open(row.href, '_blank', 'noopener');
    });
  });

  player.querySelector('[data-prev]').addEventListener('click', function () { select(current - 1); });
  player.querySelector('[data-next]').addEventListener('click', function () { select(current + 1); });

})();
