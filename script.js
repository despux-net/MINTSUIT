// MINT SUIT — site behavior
// Loads content from /data/*.json so the page can be updated without touching HTML.

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- mobile nav ----------
const toggle = document.querySelector(".nav-toggle");
const navLinks = document.getElementById("nav-links");
if (toggle) {
  toggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  navLinks.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => {
      navLinks.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

// ---------- scroll reveal ----------
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add("is-visible"));
}

const playIcon = `<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z"/></svg>`;

// ---------- tracks ----------
fetch("data/tracks.json")
  .then(r => r.json())
  .then(tracks => {
    const wrap = document.getElementById("track-list");
    if (!tracks.length) {
      wrap.innerHTML = `<div class="empty-state reveal"><p class="display">Nothing released yet</p><p>New tracks will show up here the moment they're out.</p></div>`;
      return;
    }
    wrap.innerHTML = tracks.map(t => `
      <a class="track reveal" href="${t.link}" target="_blank" rel="noopener">
        <span class="idx display">${t.index}</span>
        <img src="${t.cover}" alt="" loading="lazy">
        <span class="title">${t.title}</span>
        <span class="release">${t.release}</span>
        <span class="play">${playIcon}</span>
      </a>
    `).join("");
    wrap.querySelectorAll(".reveal").forEach(el => {
      if ("IntersectionObserver" in window) {
        const io2 = new IntersectionObserver(entries => {
          entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io2.unobserve(e.target); } });
        }, { threshold: 0.1 });
        io2.observe(el);
      } else {
        el.classList.add("is-visible");
      }
    });
  })
  .catch(() => {
    document.getElementById("track-list").innerHTML =
      `<div class="empty-state"><p class="display">Couldn't load tracks</p><p>Check that data/tracks.json is present.</p></div>`;
  });

// ---------- shows ----------
fetch("data/shows.json")
  .then(r => r.json())
  .then(shows => {
    const wrap = document.getElementById("show-list");
    if (!shows.length) {
      wrap.innerHTML = `<div class="empty-state reveal"><p class="display">No shows on the calendar yet</p><p>Check back soon — dates will land here first.</p></div>`;
      return;
    }
    wrap.innerHTML = shows.map(s => `
      <div class="show-row reveal">
        <span class="date">${s.date}</span>
        <span class="venue">${s.venue}<br><span class="city">${s.city}</span></span>
        <a class="pill" href="${s.link}" target="_blank" rel="noopener">Tickets</a>
      </div>
    `).join("");
  })
  .catch(() => {
    document.getElementById("show-list").innerHTML =
      `<div class="empty-state"><p class="display">Couldn't load shows</p><p>Check that data/shows.json is present.</p></div>`;
  });

// ---------- links (streaming + social) ----------
fetch("data/links.json")
  .then(r => r.json())
  .then(links => {
    const streamRow = document.getElementById("streaming-row");
    streamRow.innerHTML = links.streaming.map(l =>
      `<a class="pill" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
    ).join("");

    const connectLinks = document.getElementById("connect-links");
    connectLinks.innerHTML = links.social.map(l =>
      `<a href="${l.url}" target="_blank" rel="noopener">${l.label} <span>&rarr;</span></a>`
    ).join("");

    const emailLink = document.getElementById("email-link");
    emailLink.textContent = links.email;
    emailLink.href = `mailto:${links.email}`;
  })
  .catch(() => { /* leave defaults in place */ });
