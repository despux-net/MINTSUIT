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

// ---------- sticky nav ----------
const siteNav = document.getElementById("site-nav");
if (siteNav) {
  const onNavScroll = () => siteNav.classList.toggle("scrolled", window.scrollY > 60);
  onNavScroll();
  window.addEventListener("scroll", onNavScroll, { passive: true });
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

// ---------- site content ----------
fetch("data/site.json", { cache: "no-store" })
  .then(r => r.json())
  .then(site => {
    document.getElementById("hero-eyebrow").textContent = site.hero_eyebrow;
    document.getElementById("hero-image").src = site.hero_image;
    document.getElementById("hero-cta-label").textContent = site.hero_cta_label;
    document.getElementById("hero-cta").href = site.hero_cta_url;
    const heroEl = document.querySelector(".hero");
    if (site.hero_title_lift !== undefined) {
      heroEl.style.setProperty("--hero-lift", `${site.hero_title_lift}px`);
    }
    if (site.hero_cta_gap !== undefined) {
      heroEl.style.setProperty("--hero-cta-gap", `${site.hero_cta_gap}px`);
    }

    document.getElementById("music-description").textContent = site.music_description;
    setupReleases(site.spotify_releases, site.spotify_album_id);

    document.getElementById("video-title").textContent = site.video_title;

    document.getElementById("about-image").src = site.about_image;
    document.getElementById("about-p1").textContent = site.about_p1;
    document.getElementById("about-p2").textContent = site.about_p2;
    document.getElementById("about-tags").textContent = site.tags.join("  ·  ");

    renderBio(site);

    document.getElementById("connect-intro").textContent = site.connect_intro;

    setupBandcampModal(site.bandcamp_track_id);
    setupVideoPlayer(site.youtube_id);
  })
  .catch(() => { /* leave defaults in place */ });

// ---------- music: spotify release switcher ----------
function spotifyEmbedUrl(id) {
  return `https://open.spotify.com/embed/album/${id}?utm_source=generator&theme=0`;
}

function setupReleases(releases, fallbackId) {
  const frame = document.getElementById("spotify-embed");
  const row = document.getElementById("release-switch");
  if (!frame) return;

  const list = (releases || []).filter(r => r && r.spotify_id);
  if (!list.length) {
    if (fallbackId) frame.src = spotifyEmbedUrl(fallbackId);
    if (row) row.hidden = true;
    return;
  }

  frame.src = spotifyEmbedUrl(list[0].spotify_id);
  frame.title = `MINT SUIT — ${list[0].title || "Spotify"}`;

  // A single release needs no switcher.
  if (!row || list.length < 2) {
    if (row) row.hidden = true;
    return;
  }

  row.textContent = "";
  const buttons = list.map((release, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "release-tab";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(i === 0));
    btn.textContent = release.title || `Release ${i + 1}`;
    btn.addEventListener("click", () => {
      frame.src = spotifyEmbedUrl(release.spotify_id);
      frame.title = `MINT SUIT — ${release.title || "Spotify"}`;
      buttons.forEach(b => b.setAttribute("aria-selected", String(b === btn)));
    });
    row.appendChild(btn);
    return btn;
  });
}

// ---------- biography ----------
function renderBio(site) {
  if (site.bio_title) document.getElementById("bio-title").textContent = site.bio_title;
  if (site.bio_intro) document.getElementById("bio-intro").textContent = site.bio_intro;

  const list = document.getElementById("bio-list");
  if (!list) return;
  const points = (site.bio_points || []).filter(p => p && (p.label || p.text));
  if (!points.length) {
    list.hidden = true;
    return;
  }

  list.textContent = "";
  points.forEach(point => {
    const dt = document.createElement("dt");
    dt.textContent = point.label || "";
    const dd = document.createElement("dd");
    dd.textContent = point.text || "";
    list.append(dt, dd);
  });
}

// ---------- gallery ----------
fetch("data/gallery.json", { cache: "no-store" })
  .then(r => r.json())
  .then(gallery => {
    const grid = document.getElementById("gallery-grid");
    const section = document.getElementById("gallery");
    const items = (gallery.items || []).filter(i => i && i.image);
    if (!grid || !items.length) {
      if (section) section.hidden = true;
      return;
    }

    if (gallery.gallery_eyebrow) {
      document.getElementById("gallery-eyebrow").textContent = gallery.gallery_eyebrow;
    }
    if (gallery.gallery_title) {
      document.getElementById("gallery-title").textContent = gallery.gallery_title;
    }

    grid.textContent = "";
    items.forEach(item => {
      const caption = item.caption || "";

      const fig = document.createElement("figure");
      fig.className = "gallery-item";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gallery-open";
      btn.setAttribute("aria-label", caption ? `Enlarge — ${caption}` : "Enlarge image");

      const img = document.createElement("img");
      img.src = item.image;
      img.alt = caption;
      img.loading = "lazy";

      btn.appendChild(img);
      fig.appendChild(btn);

      if (caption) {
        const cap = document.createElement("figcaption");
        cap.textContent = caption;
        fig.appendChild(cap);
      }

      btn.addEventListener("click", () => openLightbox(item.image, caption));
      grid.appendChild(fig);
    });
  })
  .catch(() => {
    const section = document.getElementById("gallery");
    if (section) section.hidden = true;
  });

const lightbox = document.getElementById("gallery-lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCaption = document.getElementById("lightbox-caption");
let lightboxOpener = null;

function openLightbox(src, caption) {
  if (!lightbox) return;
  lightboxOpener = document.activeElement;
  lightboxImage.src = src;
  lightboxImage.alt = caption || "";
  lightboxCaption.textContent = caption || "";
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("lightbox-close").focus();
}

function closeLightbox() {
  if (!lightbox || !lightbox.classList.contains("open")) return;
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  lightboxImage.removeAttribute("src");
  if (lightboxOpener) lightboxOpener.focus();
}

if (lightbox) {
  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-figure")) closeLightbox();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeLightbox();
  });
}

// ---------- design (fonts, sizes, colors) ----------
const FONT_STACKS = {
  "Bodoni Moda": `"Bodoni Moda", serif`,
  "Playfair Display": `"Playfair Display", serif`,
  "Cormorant Garamond": `"Cormorant Garamond", serif`,
  "DM Serif Display": `"DM Serif Display", serif`,
  "Jost": `"Jost", sans-serif`,
  "Inter": `"Inter", sans-serif`,
  "Work Sans": `"Work Sans", sans-serif`,
  "Space Grotesk": `"Space Grotesk", sans-serif`
};

function hexToRgbTriplet(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(",");
}

fetch("data/design.json", { cache: "no-store" })
  .then(r => r.json())
  .then(design => {
    const root = document.documentElement.style;

    if (design.heading_font && FONT_STACKS[design.heading_font]) {
      root.setProperty("--font-heading", FONT_STACKS[design.heading_font]);
    }
    if (design.body_font && FONT_STACKS[design.body_font]) {
      root.setProperty("--font-body", FONT_STACKS[design.body_font]);
    }
    if (design.heading_scale) root.setProperty("--heading-scale", design.heading_scale / 100);
    if (design.body_scale) root.setProperty("--body-scale", design.body_scale / 100);

    const bgRgb = hexToRgbTriplet(design.bg_color);
    if (design.bg_color) root.setProperty("--bg", design.bg_color);
    if (bgRgb) root.setProperty("--bg-rgb", bgRgb);

    const textRgb = hexToRgbTriplet(design.text_color);
    if (design.text_color) {
      root.setProperty("--text", design.text_color);
      if (textRgb) {
        root.setProperty("--text-dim", `rgba(${textRgb},0.6)`);
        root.setProperty("--hair", `rgba(${textRgb},0.16)`);
        root.setProperty("--hair-soft", `rgba(${textRgb},0.08)`);
      }
    }

    if (design.hero_bg_color) root.setProperty("--hero-bg", design.hero_bg_color);
    if (design.about_bg_color) root.setProperty("--about-bg", design.about_bg_color);
    if (design.music_bg_color) root.setProperty("--music-bg", design.music_bg_color);
    if (design.connect_bg_color) root.setProperty("--connect-bg", design.connect_bg_color);

    const veilRgb = hexToRgbTriplet(design.video_veil_color);
    if (veilRgb) root.setProperty("--veil-rgb", veilRgb);

    if (design.hero_image_focus_y !== undefined) {
      root.setProperty("--hero-focus-y", design.hero_image_focus_y);
    }
  })
  .catch(() => { /* leave defaults in place */ });

// ---------- bandcamp buy modal ----------
function setupBandcampModal(trackId) {
  const heroCta = document.getElementById("hero-cta");
  const modal = document.getElementById("bandcamp-modal");
  const modalClose = document.getElementById("modal-close");
  const modalFrame = document.getElementById("bandcamp-frame");
  if (!trackId || !heroCta || !modal || !modalFrame) return;

  function openModal() {
    modalFrame.src = `https://bandcamp.com/EmbeddedPlayer/track=${trackId}/size=large/bgcol=f4f1ea/linkcol=17161a/tracklist=false/artwork=small/transparent=true/`;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    modalFrame.src = "";
  }

  heroCta.addEventListener("click", e => {
    e.preventDefault();
    openModal();
  });
  if (modalClose) modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });
}

// ---------- video (autoplay muted, custom sound toggle) ----------
function setupVideoPlayer(videoId) {
  const ytFrame = document.getElementById("yt-player");
  if (!ytFrame || !videoId) return;

  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: videoId,
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    iv_load_policy: "3",
    disablekb: "1",
    enablejsapi: "1",
    origin: location.origin
  });
  ytFrame.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;

  const soundToggle = document.getElementById("sound-toggle");
  let muted = true;

  function ytCommand(func, args = []) {
    ytFrame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube-nocookie.com"
    );
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      muted = !muted;
      if (muted) {
        ytCommand("mute");
        soundToggle.textContent = "Unmute";
        soundToggle.setAttribute("aria-pressed", "false");
      } else {
        ytCommand("unMute");
        ytCommand("setVolume", [100]);
        soundToggle.textContent = "Mute";
        soundToggle.setAttribute("aria-pressed", "true");
      }
    });
  }
}

// ---------- links (streaming + social) ----------
fetch("data/links.json", { cache: "no-store" })
  .then(r => r.json())
  .then(links => {
    const streamRow = document.getElementById("streaming-row");
    streamRow.innerHTML = links.streaming.map(l =>
      `<a class="text-link" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
    ).join("");

    const connectLinks = document.getElementById("connect-links");
    connectLinks.innerHTML = links.social.map(l =>
      `<a class="text-link" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
    ).join("");
  })
  .catch(() => { /* leave defaults in place */ });

// ---------- contact form ----------
const contactForm = document.getElementById("contact-form");
if (contactForm) {
  const status = document.getElementById("form-status");
  const submitBtn = contactForm.querySelector("button[type=submit]");

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Sending…";
    status.className = "form-status";
    submitBtn.disabled = true;

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(contactForm)
      });
      const result = await res.json();
      if (result.success) {
        status.textContent = "Thanks — your message is on its way.";
        status.className = "form-status success";
        contactForm.reset();
      } else {
        status.textContent = "Something went wrong. Please try again.";
        status.className = "form-status error";
      }
    } catch (err) {
      status.textContent = "Something went wrong. Please try again.";
      status.className = "form-status error";
    } finally {
      submitBtn.disabled = false;
    }
  });
}
