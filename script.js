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
    if (site.hero_title_lift !== undefined) {
      document.querySelector(".hero").style.setProperty("--hero-lift", `${site.hero_title_lift}px`);
    }

    document.getElementById("music-description").textContent = site.music_description;
    document.getElementById("spotify-embed").src =
      `https://open.spotify.com/embed/album/${site.spotify_album_id}?utm_source=generator&theme=0`;

    document.getElementById("video-title").textContent = site.video_title;

    document.getElementById("about-image").src = site.about_image;
    document.getElementById("about-p1").textContent = site.about_p1;
    document.getElementById("about-p2").textContent = site.about_p2;
    document.getElementById("about-tags").textContent = site.tags.join("  ·  ");

    document.getElementById("connect-intro").textContent = site.connect_intro;

    setupVideoPlayer(site.youtube_id);
  })
  .catch(() => { /* leave defaults in place */ });

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
