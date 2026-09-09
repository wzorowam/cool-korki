import { initLab3D } from "./lab3d.js";

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionMq.matches;
  let pageVisible = !document.hidden;

  /* ---------- WebGL lab room ---------- */
  let lab3d = null;
  let webglOn = false;

  const tearDownLab3D = () => {
    lab3d?.dispose?.();
    lab3d = null;
    webglOn = false;
    document.body.dataset.webgl = "off";
    document.body.classList.remove("has-webgl");
  };

  const bootLab3D = async () => {
    const canvas = $("#lab3d");
    if (!canvas || reduced) {
      document.body.dataset.webgl = "off";
      return;
    }
    try {
      // Ensure canvas has layout size before Three measures it
      canvas.width = Math.max(1, window.innerWidth);
      canvas.height = Math.max(1, window.innerHeight);
      lab3d = await initLab3D({ canvas, reduced: false });
      if (lab3d?.ready) {
        webglOn = true;
        document.body.dataset.webgl = "on";
        document.body.classList.add("has-webgl");
        // Prime camera with current scroll so the room isn't frozen at path 0
        const docH =
          document.documentElement.scrollHeight - window.innerHeight;
        const p = docH > 0 ? clamp(window.scrollY / docH, 0, 1) : 0;
        lab3d.setProgress(p);
        lab3d.setPaused?.(document.hidden);
      } else {
        document.body.dataset.webgl = "off";
      }
    } catch (err) {
      console.warn("WebGL lab failed, using CSS world:", err);
      document.body.dataset.webgl = "off";
      lab3d = null;
    }
  };

  const scheduleBootLab3D = () => {
    const run = () => {
      bootLab3D().then(() => {
        if (webglOn) {
          stars = [];
          ctx2d = null;
        }
      });
    };
    if ("requestIdleCallback" in window) {
      requestIdleCallback(run, { timeout: 1400 });
    } else {
      window.setTimeout(run, 60);
    }
  };

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ============================================================
     SOUND LAB — Web Audio ambient + chapter stingers
     Muted by default (browser autoplay). User unlocks via toggle.
     ============================================================ */
  const SoundLab = (() => {
    let ctx = null;
    let master = null;
    let ambientGain = null;
    let sfxGain = null;
    let oscA = null;
    let oscB = null;
    let lfo = null;
    let filter = null;
    let enabled = false;
    let started = false;
    let lastWhoosh = 0;

    const ensure = () => {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.22;
      ambientGain.connect(master);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.35;
      sfxGain.connect(master);

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 480;
      filter.Q.value = 0.7;
      filter.connect(ambientGain);

      // soft dual-osc pad
      oscA = ctx.createOscillator();
      oscA.type = "sine";
      oscA.frequency.value = 110;
      oscB = ctx.createOscillator();
      oscB.type = "triangle";
      oscB.frequency.value = 164.81; // E3

      const gA = ctx.createGain();
      gA.gain.value = 0.35;
      const gB = ctx.createGain();
      gB.gain.value = 0.12;
      oscA.connect(gA);
      oscB.connect(gB);
      gA.connect(filter);
      gB.connect(filter);

      // slow tremolo
      lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain);
      lfoGain.connect(ambientGain.gain);

      oscA.start();
      oscB.start();
      lfo.start();
      started = true;
      return true;
    };

    const setEnabled = async (on) => {
      if (on) {
        if (!ensure()) return false;
        if (ctx.state === "suspended") await ctx.resume();
        enabled = true;
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.55, t + 0.8);
        return true;
      }
      enabled = false;
      if (ctx && master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      }
      return false;
    };

    const isEnabled = () => enabled;

    /** Mood hue 0–360 → pad root frequency color */
    const setMood = (hue) => {
      if (!enabled || !ctx || !oscA) return;
      const roots = [98, 110, 123.47, 130.81, 146.83, 164.81];
      const idx = Math.floor((Number(hue) % 360) / 60) % roots.length;
      const t = ctx.currentTime;
      oscA.frequency.linearRampToValueAtTime(roots[idx], t + 1.2);
      oscB.frequency.linearRampToValueAtTime(roots[idx] * 1.5, t + 1.2);
      filter.frequency.linearRampToValueAtTime(380 + (Number(hue) % 60) * 4, t + 1);
    };

    const blip = (freq, dur = 0.12, type = "sine", vol = 0.2) => {
      if (!enabled || !ctx || !sfxGain) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.7, 40), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(sfxGain);
      o.start(t);
      o.stop(t + dur + 0.02);
    };

    const chapterStinger = (chapterIndex = 0) => {
      if (!enabled) return;
      const base = 220 + (chapterIndex % 7) * 28;
      blip(base, 0.1, "sine", 0.16);
      setTimeout(() => blip(base * 1.5, 0.14, "triangle", 0.1), 70);
      setTimeout(() => blip(base * 2, 0.18, "sine", 0.07), 140);
    };

    const whoosh = () => {
      if (!enabled || !ctx || !sfxGain) return;
      const now = performance.now();
      if (now - lastWhoosh < 400) return;
      lastWhoosh = now;
      const t = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.35;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(200, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      noise.connect(bp);
      bp.connect(g);
      g.connect(sfxGain);
      noise.start(t);
      noise.stop(t + 0.35);
    };

    const portalOpen = () => {
      if (!enabled) return;
      blip(164, 0.2, "sine", 0.14);
      setTimeout(() => blip(246, 0.25, "triangle", 0.12), 90);
      setTimeout(() => blip(329, 0.35, "sine", 0.1), 180);
      whoosh();
    };

    const clickSoft = () => blip(520, 0.06, "sine", 0.08);

    const scrollTick = (velocity) => {
      if (!enabled || !ctx || velocity < 8) return;
      // rare soft tick — not spammy
      if (Math.random() > 0.08) return;
      blip(180 + Math.min(velocity, 40) * 4, 0.04, "sine", 0.03);
    };

    return {
      setEnabled,
      isEnabled,
      setMood,
      chapterStinger,
      whoosh,
      portalOpen,
      clickSoft,
      scrollTick,
    };
  })();

  /* ---------- Sound toggle UI ---------- */
  const soundToggle = $("#sound-toggle");
  const updateSoundUI = () => {
    if (!soundToggle) return;
    const on = SoundLab.isEnabled();
    soundToggle.setAttribute("aria-pressed", on ? "true" : "false");
    soundToggle.classList.toggle("is-on", on);
    const icon = soundToggle.querySelector(".sound-icon");
    const label = soundToggle.querySelector(".sound-label");
    if (icon) icon.textContent = on ? "🔊" : "🔇";
    if (label) label.textContent = on ? "Dźwięk on" : "Dźwięk off";
    soundToggle.setAttribute("aria-label", on ? "Dźwięk włączony" : "Dźwięk wyłączony");
  };

  soundToggle?.addEventListener("click", async () => {
    const next = !SoundLab.isEnabled();
    await SoundLab.setEnabled(next);
    updateSoundUI();
    if (next) {
      SoundLab.chapterStinger(0);
      const hue = getComputedStyle(document.body).getPropertyValue("--mood") || "180";
      SoundLab.setMood(hue);
    }
  });

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const menuBtn = $("#menu-btn");
  const mobileMenu = $("#mobile-menu");

  const closeMenu = () => {
    if (!mobileMenu || !menuBtn) return;
    mobileMenu.classList.remove("open");
    mobileMenu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Otwórz menu");
  };
  const openMenu = () => {
    if (!mobileMenu || !menuBtn) return;
    mobileMenu.hidden = false;
    mobileMenu.classList.add("open");
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Zamknij menu");
    const first = mobileMenu.querySelector("a");
    first?.focus();
  };

  menuBtn?.addEventListener("click", () => {
    const open = menuBtn.getAttribute("aria-expanded") === "true";
    if (open) closeMenu();
    else openMenu();
  });
  mobileMenu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (menuBtn?.getAttribute("aria-expanded") === "true") {
        closeMenu();
        menuBtn.focus();
      }
      return;
    }
    if (e.key !== "Tab") return;
    if (menuBtn?.getAttribute("aria-expanded") !== "true") return;
    const items = [menuBtn, ...mobileMenu.querySelectorAll("a")];
    const i = items.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (!e.shiftKey && i === items.length - 1) {
      e.preventDefault();
      items[0]?.focus();
    }
  });

  /* ---------- Starfield ---------- */
  const canvas = $("#starfield");
  let stars = [];
  let ctx2d = null;
  let w = 0;
  let h = 0;
  let scrollBoost = 0;

  const initStars = () => {
    if (!canvas || reduced) return;
    ctx2d = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.floor((w * h) / 14000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      r: Math.random() * 1.4 + 0.3,
      tw: Math.random() * Math.PI * 2,
      sp: 0.2 + Math.random() * 0.6,
    }));
  };

  const drawStars = () => {
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, w, h);
    const mood = getComputedStyle(document.body).getPropertyValue("--mood") || "180";
    for (const s of stars) {
      s.tw += 0.02 * s.sp;
      s.y += (0.08 + s.z * 0.25 + scrollBoost * s.z) * (reduced ? 0 : 1);
      if (s.y > h + 4) {
        s.y = -4;
        s.x = Math.random() * w;
      }
      const alpha = 0.25 + s.z * 0.55 + Math.sin(s.tw) * 0.15;
      ctx2d.beginPath();
      ctx2d.fillStyle = `hsla(${mood}, 80%, ${70 + s.z * 20}%, ${alpha})`;
      ctx2d.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
      ctx2d.fill();
    }
    scrollBoost *= 0.88;
  };

  /* ---------- Pointer parallax ---------- */
  let targetMX = 0;
  let targetMY = 0;
  let mx = 0;
  let my = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (reduced) return;
      targetMX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMY = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  /* ---------- Scenes + smooth scrub state ---------- */
  const pinScenes = $$(".pin-scene");
  const flowScenes = $$(".flow-scene");
  const allScenes = [...pinScenes, ...flowScenes];
  const xpFill = $("#xp-fill");
  const railFill = $("#rail-fill");
  const railGuide = $("#rail-guide");
  const chapterNum = $("#chapter-num");
  const chapterName = $("#chapter-name");
  const railStops = $$(".rail-stop");
  const depthLayers = $$(".depth-layer");
  const whyPanels = $$(".why-panel");
  const whyDots = $$(".why-dots span");
  const questTrack = $("#quest-track");
  const questCards = $$(".quest-card");

  // smoothed values (lerp toward raw each frame)
  let smoothGlobal = 0;
  let smoothScenes = new Map(); // id -> progress
  let smoothQuestX = 0;
  let whyStepSmooth = 0;
  let targetWhyStep = 0;

  const tips = {
    start: {
      title: "Night lab 🚀",
      body: "Jeden next step: zostaw sygnał. Albo scroll — rozdziały same się otwierają.",
    },
    story: {
      title: "Setup",
      body: "Szkolny angielski nie jest zły — po prostu nie był pod Ciebie.",
    },
    why: {
      title: "3 Whys",
      body: "Scroll przełącza karty. Fun → talk → adventure.",
    },
    adventures: {
      title: "Quest tunnel",
      body: "Scroll = pan po questach. Zatrzymaj się na tym, co kręci.",
    },
    lab: {
      title: "Lab orbit",
      body: "Narzędzia krążą wokół Ciebie. Voice + NotebookLM = cheat codes.",
    },
    paths: {
      title: "Paths",
      body: "Orientacja, nie ulotka. Jak nie wiesz — napisz „nie wiem”.",
    },
    hello: {
      title: "Hello",
      body: "Jedyny next step. Imię + mail. Catch you soon 🪩",
    },
  };

  let currentScene = ""; // empty until first sample — avoids false transition FX on boot
  let tipOpen = false;
  const tipEl = $("#korki-tip");
  const tipBtn = $("#korki-btn");
  const sceneOrder = ["start", "story", "why", "adventures", "lab", "paths", "hello"];

  const renderTip = (id) => {
    const t = tips[id] || tips.start;
    if (!tipEl) return;
    tipEl.innerHTML = `<strong>${t.title}</strong>${t.body}`;
  };
  const showTip = () => {
    tipOpen = true;
    tipEl?.classList.add("show");
  };
  const hideTip = () => {
    tipOpen = false;
    tipEl?.classList.remove("show");
  };

  tipBtn?.addEventListener("click", () => {
    SoundLab.clickSoft();
    renderTip(currentScene);
    if (tipOpen) hideTip();
    else showTip();
  });

  const setActiveScene = (sceneEl) => {
    if (!sceneEl) return;
    const id = sceneEl.dataset.scene || "start";
    if (id === currentScene) {
      // keep is-active class in sync even when id unchanged (first paint)
      allScenes.forEach((s) =>
        s.classList.toggle("is-active", s === sceneEl)
      );
      return;
    }
    const prev = currentScene;
    currentScene = id;
    document.body.dataset.scene = id;
    allScenes.forEach((s) =>
      s.classList.toggle("is-active", s === sceneEl)
    );
    if (chapterNum) chapterNum.textContent = sceneEl.dataset.chapter || "00";
    if (chapterName) chapterName.textContent = sceneEl.dataset.title || "";
    railStops.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.goto === id);
    });
    if (tipOpen) renderTip(id);

    // chapter transition feedback (skip whoosh on boot when landing on start)
    const idx = sceneOrder.indexOf(id);
    if (prev) {
      SoundLab.whoosh();
      SoundLab.chapterStinger(Math.max(idx, 0));
    }
    const hue = getComputedStyle(document.body).getPropertyValue("--mood") || "180";
    SoundLab.setMood(hue);

    // brief HUD pulse
    const hud = $("#chapter-hud");
    if (hud) {
      hud.classList.remove("pulse");
      void hud.offsetWidth;
      hud.classList.add("pulse");
    }

    // hide scroll cue after leaving start
    if (prev === "start" && id !== "start") {
      document.body.classList.add("has-entered");
    }

    // re-trigger chapter intro animations when entering a pin scene
    if (sceneEl.classList.contains("pin-scene")) {
      sceneEl.querySelectorAll("[data-enter]").forEach((el) => {
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
      });
    }

    lab3d?.setScene?.(id);
  };

  /**
   * Sticky pin progress: 0 when chapter first sticks (fully on screen),
   * 1 when about to unstick. Never negative "pre-enter" for opacity hacks.
   */
  const rawSceneProgress = (el) => {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const total = Math.max(el.offsetHeight - vh, 1);
    // When section is still below the fold, keep progress at 0 (visible when it arrives)
    if (rect.top > 0) return 0;
    return clamp(-rect.top / total, 0, 1);
  };

  /* ---------- Video portal ---------- */
  const portal = $("#video-portal");
  const portalVideo = $("#portal-video");
  const portalPlay = $("#portal-play");
  const portalPoster = $("#portal-poster");
  const portalError = $("#portal-error");
  let portalOpenState = false;
  let portalHasVideo = true;

  const markPortalOffline = () => {
    portalHasVideo = false;
    portal?.classList.add("is-offline");
    if (portalError) portalError.hidden = false;
    portalPoster?.classList.remove("is-hidden");
    if (portalPlay) {
      const t = portalPlay.querySelector(".portal-play-text");
      if (t) t.textContent = "Hello · scroll";
      portalPlay.setAttribute("aria-label", "Przejdź do hello");
    }
  };

  portalVideo?.addEventListener("error", markPortalOffline);
  if (portalVideo) {
    portalVideo.addEventListener("loadeddata", () => {
      portalHasVideo = true;
      if (portalError) portalError.hidden = true;
    });
  }

  const openPortal = async () => {
    if (!portal || portalOpenState) return;
    if (!portalHasVideo) {
      const hello = document.getElementById("hello");
      if (hello) {
        const top = hello.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      }
      return;
    }
    portalOpenState = true;
    portal.classList.add("is-open");
    lab3d?.setPortalOpen?.(true);
    SoundLab.portalOpen();
    if (portalVideo) {
      try {
        portalVideo.currentTime = 0;
        await portalVideo.play();
        portalPoster?.classList.add("is-hidden");
      } catch {
        // autoplay blocked without mute — already muted
        portalPoster?.classList.remove("is-hidden");
      }
    }
    if (portalPlay) {
      portalPlay.setAttribute("aria-label", "Close hello portal");
      portalPlay.classList.add("is-playing");
      const t = portalPlay.querySelector(".portal-play-text");
      if (t) t.textContent = "Close portal";
    }
  };

  const closePortal = () => {
    if (!portal || !portalOpenState) return;
    portalOpenState = false;
    portal.classList.remove("is-open");
    lab3d?.setPortalOpen?.(false);
    portalVideo?.pause();
    portalPoster?.classList.remove("is-hidden");
    if (portalPlay) {
      portalPlay.setAttribute("aria-label", "Open hello portal");
      portalPlay.classList.remove("is-playing");
      const t = portalPlay.querySelector(".portal-play-text");
      if (t) t.textContent = "Hello portal";
    }
    SoundLab.clickSoft();
  };

  portalPlay?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (portalOpenState) closePortal();
    else openPortal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && portalOpenState) closePortal();
  });

  portal?.addEventListener("click", (e) => {
    if (e.target === portalPlay || portalPlay?.contains(e.target)) return;
    if (!portalOpenState) openPortal();
  });

  /* ---------- Smooth scroll-to for rail ---------- */
  let scrollTween = null;
  const smoothScrollTo = (targetY, duration = 900) => {
    if (reduced) {
      window.scrollTo(0, targetY);
      return;
    }
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    const start = performance.now();
    if (scrollTween) cancelAnimationFrame(scrollTween);

    const step = (now) => {
      const t = easeOutCubic((now - start) / duration);
      window.scrollTo(0, startY + dist * t);
      if (t < 1) scrollTween = requestAnimationFrame(step);
      else scrollTween = null;
    };
    scrollTween = requestAnimationFrame(step);
  };

  /* ---------- Core frame update ---------- */
  let lastY = window.scrollY;
  let lastFrame = performance.now();

  const sampleTargets = () => {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const rawGlobal = docH > 0 ? clamp(window.scrollY / docH, 0, 1) : 0;

    // scrub rate depends on frame time — snappier on low FPS, butter on high
    const now = performance.now();
    const dt = clamp((now - lastFrame) / 16.67, 0.5, 2.5);
    lastFrame = now;
    const scrub = reduced ? 1 : 1 - Math.pow(0.82, dt); // ~0.18 per frame @ 60fps

    smoothGlobal = lerp(smoothGlobal, rawGlobal, scrub);

    document.body.dataset.progress = smoothGlobal.toFixed(3);
    document.documentElement.style.setProperty("--p", smoothGlobal.toFixed(4));
    document.documentElement.style.setProperty(
      "--world-shift",
      `${smoothGlobal * -120}px`
    );

    // Drive WebGL camera path from global scroll
    lab3d?.setProgress?.(smoothGlobal);
    lab3d?.setPointer?.(mx, my);

    if (xpFill) xpFill.style.width = `${smoothGlobal * 100}%`;
    if (railFill) railFill.style.height = `${smoothGlobal * 100}%`;
    if (railGuide) railGuide.style.top = `${smoothGlobal * 100}%`;

    // best scene by visibility
    let best = null;
    let bestScore = -1;
    for (const scene of allScenes) {
      const r = scene.getBoundingClientRect();
      const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (visible > bestScore) {
        bestScore = visible;
        best = scene;
      }
    }
    if (best) setActiveScene(best);

    for (const scene of pinScenes) {
      const raw = rawSceneProgress(scene);
      const id = scene.id || scene.dataset.scene;
      const prev = smoothScenes.get(id) ?? raw;
      // Lerp only — no second smoothstep (that delayed the gateway feel)
      const p = lerp(prev, raw, scrub);
      smoothScenes.set(id, p);

      scene.style.setProperty("--scene-p", p.toFixed(4));
      const sticky = scene.querySelector(".scene-stage");
      if (sticky) sticky.style.setProperty("--scene-p", p.toFixed(4));

      const compact = window.matchMedia("(max-width: 640px)").matches;

      // Why stack — use mid band of pin scroll (hold → flip → exit)
      if (scene.id === "why" && whyPanels.length && !compact) {
        // map 0.08–0.72 of pin into panel steps
        const whyT = clamp((p - 0.08) / 0.64, 0, 0.999);
        targetWhyStep = whyT * whyPanels.length;
        whyStepSmooth = lerp(whyStepSmooth, targetWhyStep, scrub * 1.15);
        const step = Math.min(
          whyPanels.length - 1,
          Math.floor(whyStepSmooth)
        );
        const frac = whyStepSmooth - step;
        whyPanels.forEach((panel, i) => {
          panel.classList.toggle("is-active", i === step);
          panel.classList.toggle("is-past", i < step);
          if (i === step) {
            panel.style.setProperty("--step-p", frac.toFixed(3));
          }
        });
        whyDots.forEach((d, i) => d.classList.toggle("is-on", i === step));
      }

      // Quest tunnel — pan across most of the pin, ease ends
      // On phones: native horizontal swipe (CSS), no transform fight.
      if (scene.id === "adventures" && questTrack && !compact) {
        const maxShift = Math.max(
          questTrack.scrollWidth - window.innerWidth + 80,
          0
        );
        const tunnelT = smoothstep(clamp((p - 0.05) / 0.75, 0, 1));
        const targetX = -tunnelT * maxShift;
        smoothQuestX = lerp(smoothQuestX, targetX, scrub * 1.05);
        const rot = (tunnelT - 0.5) * 4;
        questTrack.style.transform = reduced
          ? "none"
          : `translate3d(${smoothQuestX.toFixed(2)}px, 0, 0) rotateY(${(rot * 0.2).toFixed(3)}deg)`;

        const center = window.innerWidth / 2;
        let focusIdx = 0;
        let bestDist = Infinity;
        questCards.forEach((card, i) => {
          const cr = card.getBoundingClientRect();
          const mid = cr.left + cr.width / 2;
          const dist = Math.abs(mid - center);
          if (dist < bestDist) {
            bestDist = dist;
            focusIdx = i;
          }
        });
        questCards.forEach((c, i) => c.classList.toggle("is-focus", i === focusIdx));
      }

      // Depth cards: always reasonably visible; slight lift as chapter progresses
      scene.querySelectorAll("[data-z]").forEach((card, i) => {
        const z = Number(card.dataset.z) || 1;
        const stagger = i * 0.04;
        const cardIn = clamp(0.55 + p * 0.7 - stagger, 0, 1);
        card.style.setProperty("--z", z);
        card.style.setProperty("--card-in", cardIn.toFixed(3));
        card.style.setProperty("--enter", "1");
      });
    }

    // depth layers
    depthLayers.forEach((layer) => {
      const depth = Number(layer.dataset.depth) || 0.2;
      const tx = mx * depth * 40;
      const ty = my * depth * 28 + smoothGlobal * depth * -180;
      const tz = depth * -200;
      layer.style.transform = reduced
        ? "none"
        : `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, ${tz.toFixed(2)}px)`;
    });

    // portal parallax — gentle; don't yank it during gateway hold
    if (portal && !reduced) {
      const pr = smoothScenes.get("start") ?? 0;
      const exitLift = clamp((pr - 0.55) / 0.45, 0, 1) * 36;
      portal.style.transform = `translate3d(${(mx * 12).toFixed(2)}px, ${(my * 8 - exitLift).toFixed(2)}px, 0)`;
    }

    // scroll cue fades as gateway progresses (not only on scene change)
    const startP = smoothScenes.get("start") ?? 0;
    if (startP > 0.2) document.body.classList.add("has-entered");

    const idx = sceneOrder.indexOf(currentScene);
    railStops.forEach((btn) => {
      const gi = sceneOrder.indexOf(btn.dataset.goto);
      btn.classList.toggle("is-done", gi >= 0 && gi < idx);
    });

    // close portal when gateway is mostly scrolled through
    if (portalOpenState && (currentScene !== "start" || startP > 0.7)) {
      closePortal();
    }

    return { rawGlobal, scrub };
  };

  const tick = () => {
    if (!pageVisible) {
      return;
    }
    mx = lerp(mx, targetMX, reduced ? 1 : 0.07);
    my = lerp(my, targetMY, reduced ? 1 : 0.07);
    document.documentElement.style.setProperty("--mx", mx.toFixed(4));
    document.documentElement.style.setProperty("--my", my.toFixed(4));

    const dy = Math.abs(window.scrollY - lastY);
    if (dy > 0) {
      scrollBoost = Math.min(scrollBoost + dy * 0.02, 4);
      SoundLab.scrollTick(dy);
    }
    lastY = window.scrollY;

    if (nav) nav.classList.toggle("scrolled", window.scrollY > 12);

    sampleTargets();
    // Starfield only as fallback when WebGL is off
    if (!webglOn && !reduced) drawStars();
    requestAnimationFrame(tick);
  };

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    lab3d?.setPaused?.(document.hidden);
    if (pageVisible) {
      lastFrame = performance.now();
      requestAnimationFrame(tick);
    }
  });

  const applyMotionPreference = (nextReduced) => {
    if (nextReduced === reduced) return;
    reduced = nextReduced;
    if (reduced) {
      tearDownLab3D();
      stars = [];
      ctx2d = null;
      if (questTrack) questTrack.style.transform = "none";
    } else {
      initStars();
      scheduleBootLab3D();
    }
  };
  const onMotionChange = (e) => applyMotionPreference(e.matches);
  if (motionMq.addEventListener) motionMq.addEventListener("change", onMotionChange);
  else motionMq.addListener?.(onMotionChange);

  /* ---------- Reveal (flow) ---------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("visible"));
  }

  /* ---------- Rail + in-page links ---------- */
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    smoothScrollTo(top, reduced ? 0 : 1000);
    SoundLab.clickSoft();
  };

  railStops.forEach((btn) => {
    btn.addEventListener("click", () => scrollToId(btn.dataset.goto));
  });

  // intercept hash links for smoother scroll
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href")?.slice(1);
      if (!id || !document.getElementById(id)) return;
      e.preventDefault();
      closeMenu();
      scrollToId(id);
    });
  });

  /* ---------- Form ---------- */
  const form = $("#contact-form");
  const success = $("#form-success");
  const formError = $("#form-error");
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  const setFieldError = (id, message) => {
    const input = $(`#${id}`);
    const err = $(`#${id}-error`);
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    if (err) {
      err.textContent = message || "";
      err.hidden = !message;
    }
  };

  const clearFormErrors = () => {
    setFieldError("name", "");
    setFieldError("email", "");
    if (formError) {
      formError.textContent = "";
      formError.hidden = true;
    }
  };

  form?.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === "name" || t.id === "email") setFieldError(t.id, "");
    if (formError) formError.hidden = true;
    success?.classList.remove("show");
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearFormErrors();
    success?.classList.remove("show");
    const data = Object.fromEntries(new FormData(form).entries());
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    let bad = false;
    if (!name) {
      setFieldError("name", "Wpisz imię — choćby nick.");
      bad = true;
    }
    if (!email) {
      setFieldError("email", "Potrzebujemy maila, żeby wrócić z sygnałem.");
      bad = true;
    } else if (!emailOk(email)) {
      setFieldError("email", "To nie wygląda jak email.");
      bad = true;
    }
    if (bad) {
      if (formError) {
        formError.textContent = "Dwa pola na start: imię i email.";
        formError.hidden = false;
      }
      const firstBad = form.querySelector('[aria-invalid="true"]');
      firstBad?.focus();
      return;
    }
    let stored = true;
    try {
      const key = "coolkorki_leads";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push({ ...data, name, email, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev));
    } catch {
      stored = false;
    }
    form.reset();
    clearFormErrors();
    if (success) {
      success.textContent = stored
        ? "Sygnał odebrany. Cool Korki kiwa głową. Zapisane na tym urządzeniu — albo napisz: hello@coolkorki.com"
        : "Nie udało się zapisać lokalnie. Napisz prosto: hello@coolkorki.com";
      success.classList.add("show");
    }
    if (!stored && formError) {
      formError.textContent = "Storage zablokowany. Użyj maila hello@coolkorki.com";
      formError.hidden = false;
    }
    SoundLab.chapterStinger(6);
    renderTip("hello");
    showTip();
    if (tipEl) {
      tipEl.innerHTML = stored
        ? "<strong>Sygnał w labie ✓</strong>Zapisane lokalnie. Albo od razu: hello@coolkorki.com"
        : "<strong>Prawie.</strong>Storage padł — napisz na hello@coolkorki.com";
    }
  });

  /* ---------- Boot ---------- */
  updateSoundUI();

  // Always start CSS ambient (stars + fallback layers) immediately so the
  // background is never dead while WebGL boots — or if WebGL fails.
  if (!reduced) {
    initStars();
    window.addEventListener("resize", () => initStars(), { passive: true });
  }
  requestAnimationFrame(tick);

  // Defer Three.js until idle so first paint / CSS world isn't blocked.
  // Hash links use JS smoothScrollTo — no wheel preventDefault / scroll hijack.
  scheduleBootLab3D();
  window.setTimeout(() => {
    if (webglOn) {
      if (tipEl) {
        tipEl.innerHTML =
          "<strong>WebGL Lab 🚀</strong>Scroll = walk the 3D room. Background keeps animating.";
      }
    } else {
      renderTip("start");
    }
    showTip();
    window.setTimeout(() => {
      if (currentScene === "start" || currentScene === "") hideTip();
    }, 5500);
  }, 900);

  // gentle portal pulse invite
  window.setTimeout(() => {
    if ((currentScene === "start" || currentScene === "") && !portalOpenState) {
      portal?.classList.add("invite");
    }
  }, 2800);
})();
