/* Bandcamp download codes. Each album's button opens the gold pop-up with that
   record's codes in a column, each with its own copy button.

   The list lives in data/codes.json. Bandcamp exports only unredeemed codes, so
   to take used ones off the page, export again from Bandcamp and rebuild that
   file (see README). */

(function () {

  var overlay = document.querySelector('.codes-overlay');
  var buttons = document.querySelectorAll('.show-codes');
  if (!overlay || !buttons.length) return;

  var title = overlay.querySelector('.codes-title');
  var list = overlay.querySelector('.codes-list');
  var closer = overlay.querySelector('.portal-close');
  var pending = null;
  var opener = null;

  function load() {
    if (!pending) {
      pending = fetch('data/codes.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      pending.catch(function () { pending = null; });
    }
    return pending;
  }

  /* The clipboard API needs a secure page; the textarea route covers the rest. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      if (ok) resolve(); else reject();
    });
  }

  function message(text) {
    list.textContent = '';
    var li = document.createElement('li');
    li.className = 'codes-empty';
    li.textContent = text;
    list.appendChild(li);
  }

  function row(code) {
    var li = document.createElement('li');
    var c = document.createElement('code');
    var b = document.createElement('button');

    c.textContent = code;
    b.type = 'button';
    b.className = 'codes-copy';
    b.textContent = 'Copy';
    b.setAttribute('aria-label', 'Copy code ' + code);

    b.addEventListener('click', function () {
      copyText(code).then(function () {
        li.className = 'copied';
        b.textContent = 'Copied';
        setTimeout(function () { b.textContent = 'Copy'; }, 1600);
      }, function () {
        /* Copying was refused: leave the code selected so it can be copied by hand. */
        var range = document.createRange();
        range.selectNodeContents(c);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
    });

    li.appendChild(c);
    li.appendChild(b);
    return li;
  }

  function open(button) {
    var album = button.getAttribute('data-album');
    opener = button;
    title.textContent = button.getAttribute('data-title');
    message('Loading codes…');

    overlay.classList.add('open');
    document.body.classList.add('locked');
    closer.focus();

    load().then(function (all) {
      var codes = all[album] || [];
      if (!codes.length) return message('There are no codes left for this record.');
      list.textContent = '';
      codes.forEach(function (code) { list.appendChild(row(code)); });
      list.scrollTop = 0;
    }, function () {
      message('The codes could not be loaded. Please try again.');
    });
  }

  function close() {
    overlay.classList.remove('open');
    document.body.classList.remove('locked');
    if (opener) opener.focus();
  }

  Array.prototype.forEach.call(buttons, function (button) {
    button.addEventListener('click', function () { open(button); });
  });

  closer.addEventListener('click', close);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && overlay.classList.contains('open')) close();
  });

})();
