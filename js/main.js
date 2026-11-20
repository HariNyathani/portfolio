/* ============================================================
   NYATHANI HARIHARAN — portfolio
   every animation below is timeline-scrubbed: mapped 1:1 to
   scrollbar position, so scrolling up reverses it perfectly.
   ============================================================ */

((enableMotion) => {
  "use strict";

  /* ---------- helpers ---------- */

  // deterministic PRNG so the heatmap pattern is stable across loads
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const splitChars = (el) => {
    const text = el.textContent;
    el.textContent = "";
    return [...text].map((ch) => {
      const span = document.createElement("span");
      span.className = "char";
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch === " " ? " " : ch;
      el.appendChild(span);
      return span;
    });
  };

  const splitWords = (el) => {
    const nodes = [...el.childNodes];
    el.textContent = "";
    const words = [];
    const pushWords = (text, highlighted) => {
      text.split(/\s+/).filter(Boolean).forEach((w) => {
        // punctuation-only tokens (", while" after an <em>) glue to the previous word
        if (/^[,.;:!?)—-]+$/.test(w) && words.length) {
          words[words.length - 1].textContent += w;
          return;
        }
        const span = document.createElement("span");
        span.className = "word" + (highlighted ? " word--hl" : "");
        span.textContent = w;
        el.appendChild(span);
        el.appendChild(document.createTextNode(" "));
        words.push(span);
      });
    };
    nodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) pushWords(n.textContent, false);
      else pushWords(n.textContent, n.tagName === "EM");
    });
    return words;
  };

  /* ---------- heatmap DOM (built regardless of motion prefs) ---------- */
  const heatmap = document.getElementById("heatmap");
  const HM_ROWS = 7;
  const HM_COLS = window.innerWidth < 640 ? 18 : 26;
  const rand = mulberry32(20260707);
  const cells = [];
  for (let col = 0; col < HM_COLS; col++) {
    for (let row = 0; row < HM_ROWS; row++) {
      const cell = document.createElement("span");
      cell.className = "heatmap__cell";
      // streak-flavoured distribution: busier toward recent weeks
      const bias = col / HM_COLS;
      const r = rand() + bias * 0.45;
      const lvl = r > 1.15 ? 4 : r > 0.92 ? 3 : r > 0.68 ? 2 : r > 0.42 ? 1 : 0;
      cell.dataset.lvl = String(lvl);
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      heatmap.appendChild(cell);
      cells.push(cell);
    }
  }

  /* ---------- static layout for reduced motion and short viewports ---------- */
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);
  const refreshEvents = "visibilitychange,DOMContentLoaded,load,resize";
  const motionQuery = window.matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 600px)");
  const sections = [...document.querySelectorAll("main > section")];
  let context;
  let activeSection;

  const rememberSection = () => {
    // A resize can trigger a scroll event before the media-query callback.
    // Keep the last section seen with the old layout until the switch finishes.
    if (motionQuery.matches !== Boolean(context)) return;
    activeSection = sections.find((el) => el.getBoundingClientRect().bottom > 90);
  };

  const syncMotion = (preserveSection) => {
    // Pin spacers change document height. Keep the current section on screen
    // when a preference or orientation change adds or removes those spacers.
    const section = preserveSection && activeSection;
    if (motionQuery.matches) {
      ScrollTrigger.config({ autoRefreshEvents: refreshEvents });
      context = gsap.context(() => enableMotion({ splitChars, splitWords, cells, HM_ROWS, HM_COLS }));
      ScrollTrigger.refresh();
    } else if (context) {
      context.revert();
      context = null;
      ScrollTrigger.config({ autoRefreshEvents: "none" });
      // Flush a resize refresh queued by the pinned layout before restoring
      // the section in the now-shorter static document.
      ScrollTrigger.refresh();
    } else {
      ScrollTrigger.config({ autoRefreshEvents: "none" });
    }
    if (section) window.scrollTo(0, scrollY + section.getBoundingClientRect().top);
    rememberSection();
  };

  syncMotion(false);
  motionQuery.addEventListener("change", () => syncMotion(true));
  window.addEventListener("scroll", rememberSection, { passive: true });
  window.addEventListener("load", () => {
    if (context) ScrollTrigger.refresh();
    rememberSection();
  });
})(({ splitChars, splitWords, cells, HM_ROWS, HM_COLS }) => {
  document.documentElement.classList.add("has-motion");
  const events = new AbortController();
  const { signal } = events;
  const originals = new Map([...document.querySelectorAll(
    "#heroName, #statementText, .contact__line1, .contact__line2, [data-count], #ringPct"
  )].map((el) => [el, [...el.childNodes]]));
  const marqueeCopies = [];
  const magnetic = document.querySelectorAll(".magnetic");
  let stopLenis = () => {};

  /* ---------- smooth scroll (Lenis) driving ScrollTrigger ---------- */
  // Use native anchors and focus; Lenis smooths wheel input only.
  if (typeof Lenis !== "undefined") {
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    const cancelWheel = () => {
      if (lenis.isScrolling !== "smooth") return;
      lenis.stop();
      lenis.start();
    };
    // Cancel pending wheel frames, but leave focus, fragments and scroll
    // restoration to the browser. This also covers keyboard-activated links.
    document.addEventListener("click", (event) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('a[href^="#"]')) cancelWheel();
    }, { capture: true, signal });
    window.addEventListener("popstate", cancelWheel, { signal });
    window.addEventListener("hashchange", cancelWheel, { signal });
    stopLenis = () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }

  /* ---------- global progress bar ---------- */
  gsap.to("#progressBar", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { trigger: document.body, start: "top top", end: "max", scrub: true },
  });
  gsap.set("#progressBar", { scaleX: 0 });

  /* ============================================================
     01 / HERO — doors open to reveal the architecture
     ============================================================ */
  const nameChars = splitChars(document.getElementById("heroName"));
  const mid = (nameChars.length - 1) / 2;
  const codeLines = gsap.utils.toArray(".code-line");

  gsap.set("#heroCode", { autoAlpha: 0 });
  gsap.set(codeLines, { opacity: 0, y: 18, filter: "blur(6px)" });

  const heroTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "+=260%",
      pin: ".hero__pin",
      scrub: true,
      anticipatePin: 1,
    },
  });

  heroTl
    .to("#heroHint", { opacity: 0, y: 20, duration: 0.1 }, 0)
    .to("#heroEyebrow", { opacity: 0, letterSpacing: "1.2em", duration: 0.35 }, 0)
    .to("#heroSub", { opacity: 0, y: 30, duration: 0.3 }, 0)
    // the doors: each letter slides outward proportional to its distance from center
    .to(nameChars, {
      x: (i) => {
        const dir = i < mid ? -1 : 1;
        const dist = Math.abs(i - mid) / mid; // 0 at center → 1 at edges
        return dir * (28 + dist * 60) + "vw";
      },
      rotateY: (i) => (i < mid ? -24 : 24),
      opacity: 0.9,
      filter: "blur(2px)",
      duration: 1,
    }, 0.05)
    // The innermost letters only travel 28vw. Fade the whole heading layer
    // out during the reveal so none remain visible at the code hold/unpin.
    // Keep this in the scrubbed timeline so reverse scrolling restores it.
    .to(".hero__type", { opacity: 0, duration: 0.36 }, 0.34)
    .to("#heroCode", { autoAlpha: 1, duration: 0.35 }, 0.28)
    .to(codeLines, {
      opacity: 1, y: 0, filter: "blur(0px)",
      stagger: 0.055, duration: 0.5,
    }, 0.42)
    .to(["#heroCornerL", "#heroCornerR"], { opacity: 0, duration: 0.2 }, 0.5)
    // brief hold with the code glowing; the unpin scrolls it away naturally
    .to({}, { duration: 0.25 });

  /* ============================================================
     02 / STATEMENT — word-by-word mask wipe
     ============================================================ */
  const words = splitWords(document.getElementById("statementText"));
  gsap.set(words, { opacity: 0.52 });

  const stTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".statement",
      start: "top top",
      end: "+=180%",
      pin: ".statement__pin",
      scrub: true,
    },
  });

  words.forEach((w, i) => {
    stTl.to(w, {
      opacity: 1,
      color: w.classList.contains("word--hl") ? "#00ff88" : "#f2f2ef",
      textShadow: w.classList.contains("word--hl") ? "0 0 26px rgba(0,255,136,0.45)" : "none",
      duration: 0.6,
    }, i * 0.14);
  });
  stTl.to({}, { duration: 1.4 }); // settle time before unpin

  /* ============================================================
     03 / PROJECT 1 — heatmap draws, tags orbit in, metrics scale
     ============================================================ */
  const tags = gsap.utils.toArray("#dsaTags .tag");
  const counters = (scope) => gsap.utils.toArray(scope.querySelectorAll("[data-count]"));

  const countTween = (el, pos, tl, dur = 0.8) => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const proxy = { v: 0 };
    el.textContent = prefix + "0" + suffix;
    tl.to(proxy, {
      v: target,
      duration: dur,
      ease: "none",
      onUpdate: () => { el.textContent = prefix + Math.round(proxy.v) + suffix; },
    }, pos);
  };

  // The Work anchor lands at the start of this pin, so the heading and link
  // must already be visible before the heatmap, tags, and metrics reveal.
  gsap.set("#dsaCard", { y: 18, opacity: 1, rotateX: 3, transformPerspective: 900 });
  gsap.set(cells, { scale: 0, opacity: 0 });
  gsap.set(tags, { opacity: 0 });
  gsap.set(".metric", { y: 40, opacity: 0 });

  const p1Tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".proj1",
      start: "top top",
      end: "+=280%",
      pin: ".proj1__pin",
      scrub: true,
      anticipatePin: 1,
    },
  });

  p1Tl
    .to("#dsaCard", { y: 0, opacity: 1, rotateX: 0, duration: 0.5 }, 0)
    // heatmap draws itself row by row, left → right
    .to(cells, {
      scale: 1, opacity: 1, duration: 0.25,
      stagger: (i, target) => {
        const row = +target.dataset.row, col = +target.dataset.col;
        return (row * HM_COLS + col) * (1.5 / (HM_ROWS * HM_COLS));
      },
    }, 0.35)
    // tech tags orbit the card and lock into place
    .from(tags, {
      x: (i) => Math.cos((i / tags.length) * Math.PI * 2) * 320,
      y: (i) => Math.sin((i / tags.length) * Math.PI * 2) * 220,
      rotation: (i) => (i % 2 ? 140 : -140),
      scale: 0.4,
      duration: 0.7,
      stagger: 0.08,
      ease: "power1.inOut",
    }, 1.7)
    .to(tags, { opacity: 1, duration: 0.5, stagger: 0.08 }, 1.7)
    // massive metrics scale up
    .to(".metric", { y: 0, opacity: 1, duration: 0.4, stagger: 0.12 }, 2.5);

  counters(document.getElementById("dsaMetrics")).forEach((el, i) =>
    countTween(el, 2.55 + i * 0.12, p1Tl, 0.7)
  );
  p1Tl.to({}, { duration: 0.4 });

  /* ============================================================
     04 / PROJECT 2 — scrubbed progress ring → terminal reveal
     ============================================================ */
  const ringFill = document.getElementById("ringFill");
  const ringPct = document.getElementById("ringPct");
  const CIRC = 2 * Math.PI * 130;
  gsap.set(ringFill, { strokeDasharray: CIRC, strokeDashoffset: CIRC });

  const termLines = gsap.utils.toArray(".term__line");
  gsap.set("#term", { opacity: 0, y: 60, scale: 0.94, pointerEvents: "none" });
  gsap.set(termLines, { opacity: 0, x: -14 });
  gsap.set([".term__title", ".term__sub"], { opacity: 0, y: 24 });

  const ringProxy = { p: 0 };
  const p2Tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".proj2",
      start: "top top",
      end: "+=300%",
      pin: ".proj2__pin",
      scrub: true,
      anticipatePin: 1,
    },
  });

  p2Tl
    // ring fills 0 → 100% strictly with the scrollbar
    .to(ringProxy, {
      p: 1,
      duration: 1.6,
      onUpdate: () => {
        ringFill.style.strokeDashoffset = CIRC * (1 - ringProxy.p);
        ringPct.textContent = String(Math.round(ringProxy.p * 100)).padStart(2, "0") + "%";
      },
    }, 0)
    // at 100% the ring flashes and hands off to the terminal
    .to(".ring__fill", { strokeWidth: 10, duration: 0.12 }, 1.6)
    .to("#ringWrap", { scale: 1.6, autoAlpha: 0, filter: "blur(10px)", duration: 0.4 }, 1.75)
    .to("#term", { opacity: 1, y: 0, scale: 1, duration: 0.45 }, 1.95)
    .to(termLines, { opacity: 1, x: 0, duration: 0.3, stagger: 0.12 }, 2.25)
    .to([".term__title", ".term__sub"], { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, 2.9)
    .set("#term", { pointerEvents: "auto" }, 3.35);

  p2Tl.to({}, { duration: 0.4 });

  /* ============================================================
     05 / EXPERIENCE — traveling node + sliding cards
     ============================================================ */
  const rail = document.querySelector(".exp__rail");

  gsap.to("#expLineFill", {
    scaleY: 1,
    ease: "none",
    scrollTrigger: { trigger: rail, start: "top 70%", end: "bottom 55%", scrub: true },
  });
  gsap.to("#expNode", {
    y: () => rail.offsetHeight,
    ease: "none",
    scrollTrigger: {
      trigger: rail, start: "top 70%", end: "bottom 55%",
      scrub: true, invalidateOnRefresh: true,
    },
  });

  gsap.utils.toArray("[data-exp]").forEach((card) => {
    gsap.from(card, {
      x: () => (!card.classList.contains("exp-card--right") || innerWidth <= 900) ? -90 : 90,
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: card, start: "top 88%", end: "top 52%", scrub: true, invalidateOnRefresh: true },
    });
  });

  /* ============================================================
     06 / SKILLS — scroll-driven counter-marquee
     ============================================================ */
  ["marqueeA", "marqueeB"].forEach((id) => {
    const row = document.getElementById(id);
    const items = [...row.children];
    for (let i = 0; i < 2; i++) {
      items.forEach((item) => {
        const copy = item.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        row.appendChild(copy);
        marqueeCopies.push(copy);
      });
    }
  });
  gsap.fromTo("#marqueeA", { xPercent: 0 }, {
    xPercent: -22, ease: "none",
    scrollTrigger: { trigger: ".skills", start: "top bottom", end: "bottom top", scrub: true },
  });
  gsap.fromTo("#marqueeB", { xPercent: -22 }, {
    xPercent: 0, ease: "none",
    scrollTrigger: { trigger: ".skills", start: "top bottom", end: "bottom top", scrub: true },
  });

  /* ============================================================
     07 / CONTACT — LET'S BUILD + drawing underline
     ============================================================ */
  const line1Chars = splitChars(document.querySelector(".contact__line1"));
  const line2Chars = splitChars(document.querySelector(".contact__line2"));
  line2Chars[line2Chars.length - 1].classList.add("accent"); // the "." keeps its glow
  const bigChars = [...line1Chars, ...line2Chars];
  gsap.set(bigChars, { yPercent: 110, opacity: 0 });
  // the container takes the scrubbed y so the magnetic effect owns the links' transforms
  gsap.set("#contactLinks", { y: 34 });
  gsap.set(".contact__link", { opacity: 0 });
  gsap.set(".footer", { opacity: 0 });

  const cTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".contact",
      start: "top 75%",
      end: "bottom bottom",
      scrub: true,
    },
  });

  cTl
    .to(bigChars, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.06 }, 0)
    .to("#contactUnderline", { scaleX: 1, duration: 0.7 }, 0.7)
    .to("#contactLinks", { y: 0, duration: 0.5 }, 1.1)
    .to(".contact__link", { opacity: 1, duration: 0.4, stagger: 0.1 }, 1.1)
    .to(".footer", { opacity: 1, duration: 0.3 }, 1.4);

  /* ============================================================
     cursor — lerped ring + instant dot + magnetic elements
     ============================================================ */
  if (window.matchMedia("(pointer: fine)").matches) {
    const cursor = document.getElementById("cursor");
    const dot = document.getElementById("cursorDot");
    const label = document.getElementById("cursorLabel");

    const ringX = gsap.quickTo(cursor, "x", { duration: 0.45, ease: "power3" });
    const ringY = gsap.quickTo(cursor, "y", { duration: 0.45, ease: "power3" });
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08 });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08 });

    let cursorActive = false;
    window.addEventListener("mousemove", (e) => {
      if (!cursorActive) {
        // jump straight to the pointer so the ring doesn't glide in from (0,0)
        cursorActive = true;
        gsap.set([cursor, dot], { x: e.clientX, y: e.clientY });
        cursor.classList.add("is-active");
        dot.classList.add("is-active");
      }
      ringX(e.clientX); ringY(e.clientY);
      dotX(e.clientX); dotY(e.clientY);
    }, { signal });

    const labelFor = (el) => {
      const href = el.getAttribute("href") || "";
      if (href.startsWith("mailto:")) return "SAY HI";
      if (href.startsWith("tel:")) return "CALL";
      if (href.startsWith("http")) return "OPEN";
      return "GO";
    };

    document.querySelectorAll("a, button").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        cursor.classList.add("is-hover");
        label.textContent = labelFor(el);
      }, { signal });
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"), { signal });
    });

    // magnetic pull
    magnetic.forEach((el) => {
      const strength = 0.35;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * strength,
          y: (e.clientY - r.top - r.height / 2) * strength,
          duration: 0.4, ease: "power3.out", overwrite: "auto",
        });
      }, { signal });
      el.addEventListener("mouseleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.35)", overwrite: "auto" });
      }, { signal });
    });
  }

  return () => {
    events.abort();
    stopLenis();
    // Mouse events create magnetic tweens after context setup.
    gsap.killTweensOf(magnetic);
    gsap.set(magnetic, { clearProps: "transform" });
    for (const [el, nodes] of originals) el.replaceChildren(...nodes);
    marqueeCopies.forEach((copy) => copy.remove());
    document.getElementById("cursor").classList.remove("is-active", "is-hover");
    document.getElementById("cursorDot").classList.remove("is-active");
    document.documentElement.classList.remove("has-motion");
  };
});
