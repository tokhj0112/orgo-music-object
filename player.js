(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (key) => window.orgoI18n?.text(key) || key;
  const isKorean = () => document.documentElement.lang === "ko";
  const PAGE_WIDTH = 1200;
  const PAGE_HEIGHT = 460;
  const PAGE_ROTATION = Math.PI * 8;
  const pitches = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
  const toneProfiles = {
    bright: { filter: 8800, detune: 8, reverb: 0.11, harmony: 0.022, partials: [{ ratio: 1, gain: .165, decay: 1.85 }, { ratio: 2.02, gain: .115, decay: 1.2 }, { ratio: 2.78, gain: .075, decay: .9 }, { ratio: 5.42, gain: .035, decay: .55 }] },
    warm: { filter: 5600, detune: 5, reverb: .2, harmony: .034, partials: [{ ratio: .5, gain: .035, decay: 1.45 }, { ratio: 1, gain: .18, decay: 2.5 }, { ratio: 2.01, gain: .072, decay: 1.55 }, { ratio: 2.76, gain: .035, decay: 1.1 }, { ratio: 5.4, gain: .009, decay: .62 }] },
    soft: { filter: 4100, detune: 3, reverb: .28, harmony: .045, partials: [{ ratio: .5, gain: .052, decay: 1.7 }, { ratio: 1, gain: .16, decay: 2.8 }, { ratio: 2, gain: .045, decay: 1.7 }, { ratio: 2.72, gain: .016, decay: 1.12 }] },
  };
  const harmonyProgression = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];

  const sheet = $("player-sheet");
  const sheetCtx = sheet.getContext("2d");
  const feed = $("player-feed");
  const feedCtx = feed.getContext("2d");
  const crank = $("player-crank");
  const toneSelector = $("player-tone");
  const volume = $("player-volume");
  const params = new URLSearchParams(window.location.search);
  const archiveId = params.get("archive");
  let item = null;
  let notes = [];
  let strokes = [];
  let toneName = "warm";
  let progress = 0;
  let angle = 0;
  let previousAngle = null;
  let audio = null;
  let master = null;
  let reverbMix = null;
  let activeHarmonyStep = -1;
  let lastHarmonyTime = -Infinity;

  function pointForPlayer(point, sourceWidth, sourceHeight) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.max(0, Math.min(PAGE_WIDTH, x / sourceWidth * PAGE_WIDTH)), y: Math.max(0, Math.min(PAGE_HEIGHT, y / sourceHeight * PAGE_HEIGHT)) };
  }

  function readItem() {
    try {
      const saved = JSON.parse(localStorage.getItem("orgo-archive") || "[]");
      item = Array.isArray(saved) ? saved.find((entry) => entry?.id === archiveId) : null;
    } catch { item = null; }
    if (!item) return false;

    const sourceWidth = Number(item.width) > 0 ? Number(item.width) : PAGE_WIDTH;
    const sourceHeight = Number(item.height) > 0 ? Number(item.height) : PAGE_HEIGHT;
    notes = (Array.isArray(item.notes) ? item.notes : []).map((point) => pointForPlayer(point, sourceWidth, sourceHeight)).filter(Boolean).sort((a, b) => a.x - b.x);
    strokes = (Array.isArray(item.strokes) ? item.strokes : []).map((stroke) => {
      const points = (Array.isArray(stroke?.points) ? stroke.points : []).map((point) => pointForPlayer(point, sourceWidth, sourceHeight)).filter(Boolean);
      return points.length ? { ink: stroke.ink || "#262722", width: Math.max(1, Math.min(12, Number(stroke.width) || 3)), points } : null;
    }).filter(Boolean);
    toneName = toneProfiles[item.tone] ? item.tone : "warm";
    toneSelector.value = toneName;
    volume.value = Number.isFinite(Number(item.volume)) ? Math.max(0, Math.min(100, Number(item.volume))) : 65;
    return notes.length > 0;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "ORGO";
    return new Intl.DateTimeFormat(isKorean() ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(date).toUpperCase();
  }

  function updateCopy() {
    if (!item) return;
    const fallback = isKorean() ? "이름 없는 선율" : "Untitled melody";
    const title = item.title?.trim() || fallback;
    $("player-title").textContent = title;
    $("player-description").textContent = t("playerDescription");
    $("player-status").textContent = t("playerInstruction");
    $("paper-meta").textContent = `${item.kind === "HAND" ? "HAND" : "MOUSE"} / ${formatDate(item.createdAt)}`;
    document.title = `${title} — ORGO`;
  }

  function drawSheet() {
    sheetCtx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    strokes.forEach((stroke) => {
      const points = stroke.points;
      if (!points.length) return;
      sheetCtx.beginPath();
      sheetCtx.strokeStyle = stroke.ink;
      sheetCtx.lineWidth = stroke.width;
      sheetCtx.lineCap = "round";
      sheetCtx.lineJoin = "round";
      points.forEach((point, index) => index ? sheetCtx.lineTo(point.x, point.y) : sheetCtx.moveTo(point.x, point.y));
      if (points.length === 1) sheetCtx.lineTo(points[0].x + .1, points[0].y);
      sheetCtx.stroke();
    });
    notes.forEach((point) => {
      sheetCtx.beginPath();
      sheetCtx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      sheetCtx.fillStyle = "#20211e";
      sheetCtx.fill();
      sheetCtx.strokeStyle = "#ffffffaa";
      sheetCtx.lineWidth = 1;
      sheetCtx.stroke();
    });
  }

  function drawFeed() {
    const width = feed.width;
    const height = feed.height;
    feedCtx.clearRect(0, 0, width, height);
    feedCtx.fillStyle = "#e8e7de";
    feedCtx.fillRect(0, 0, width, height);
    feedCtx.strokeStyle = "#c3c2b9";
    feedCtx.lineWidth = 2;
    for (let y = 16; y < height; y += 42) { feedCtx.beginPath(); feedCtx.moveTo(0, y); feedCtx.lineTo(width, y); feedCtx.stroke(); }
    for (const offset of [-PAGE_WIDTH, 0, PAGE_WIDTH]) {
      notes.forEach((point) => {
        const x = width / 2 + (point.x + offset - progress) * .8;
        if (x < -8 || x > width + 8) return;
        const y = 18 + point.y / PAGE_HEIGHT * (height - 36);
        feedCtx.beginPath();
        feedCtx.arc(x, y, 4.4, 0, Math.PI * 2);
        feedCtx.fillStyle = "#1d201b";
        feedCtx.fill();
      });
    }
    feedCtx.fillStyle = "#ad5540";
    feedCtx.fillRect(width / 2 - 2, 0, 4, height);
  }

  async function audioReady() {
    if (!audio) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      audio = new AudioContextClass();
      master = audio.createGain();
      const limiter = audio.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 12; limiter.ratio.value = 10; limiter.attack.value = .003; limiter.release.value = .18;
      const reverb = audio.createConvolver();
      const length = Math.floor(audio.sampleRate * 1.65);
      const impulse = audio.createBuffer(2, length, audio.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let index = 0; index < length; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2.8;
      }
      reverb.buffer = impulse;
      const reverbTone = audio.createBiquadFilter();
      reverbTone.type = "lowpass"; reverbTone.frequency.value = 3200; reverbTone.Q.value = .45;
      reverbMix = audio.createGain();
      master.connect(limiter); master.connect(reverb); reverb.connect(reverbTone); reverbTone.connect(reverbMix); reverbMix.connect(limiter); limiter.connect(audio.destination);
    }
    master.gain.setTargetAtTime(Number(volume.value) / 100, audio.currentTime, .02);
    reverbMix.gain.setTargetAtTime(toneProfiles[toneName].reverb, audio.currentTime, .04);
    if (audio.state !== "running") await audio.resume();
    return audio.state === "running";
  }

  function note(y, strength = .82, x) {
    if (!audio || audio.state !== "running") return;
    const time = audio.currentTime;
    const index = Math.max(0, Math.min(pitches.length - 1, 8 - Math.round(y / PAGE_HEIGHT * 8)));
    const frequency = pitches[index];
    const pitchDecay = Math.max(.78, Math.min(1.2, 920 / frequency));
    const profile = toneProfiles[toneName];
    profile.partials.forEach((partial) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const filter = audio.createBiquadFilter();
      oscillator.type = "sine"; oscillator.frequency.value = frequency * partial.ratio; oscillator.detune.value = (Math.random() - .5) * profile.detune;
      filter.type = "lowpass"; filter.frequency.value = profile.filter; filter.Q.value = .35;
      const decay = partial.decay * pitchDecay;
      envelope.gain.setValueAtTime(.0001, time);
      envelope.gain.exponentialRampToValueAtTime(partial.gain * strength, time + .005);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + decay);
      oscillator.connect(envelope).connect(filter).connect(master);
      oscillator.start(); oscillator.stop(time + decay + .05);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); filter.disconnect(); };
    });
    if (x !== undefined) playHarmony(x, strength);
  }

  function playHarmony(x, strength) {
    const time = audio.currentTime;
    const step = Math.min(harmonyProgression.length - 1, Math.floor(x / PAGE_WIDTH * harmonyProgression.length));
    if (step === activeHarmonyStep || time - lastHarmonyTime < .65) return;
    activeHarmonyStep = step; lastHarmonyTime = time;
    const profile = toneProfiles[toneName];
    harmonyProgression[step].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const filter = audio.createBiquadFilter();
      oscillator.type = "sine"; oscillator.frequency.value = frequency; oscillator.detune.value = (index - 1) * 2;
      filter.type = "lowpass"; filter.frequency.value = profile.filter * .7; filter.Q.value = .25;
      envelope.gain.setValueAtTime(.0001, time); envelope.gain.exponentialRampToValueAtTime(profile.harmony * strength, time + .035); envelope.gain.exponentialRampToValueAtTime(.0001, time + 2.7);
      oscillator.connect(envelope).connect(filter).connect(master); oscillator.start(); oscillator.stop(time + 2.76);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); filter.disconnect(); };
    });
  }

  function updatePlayer() {
    crank.style.setProperty("--angle", `${angle}rad`);
    $("player-progress").textContent = `PLAYING / ${Math.round(progress / PAGE_WIDTH * 100)}%`;
    drawFeed();
  }

  function turn(delta) {
    if (delta <= 0 || !notes.length) return;
    let travel = delta * PAGE_WIDTH / PAGE_ROTATION;
    angle += delta;
    while (travel > 0) {
      if (progress >= PAGE_WIDTH) { progress = 0; activeHarmonyStep = -1; }
      const oldProgress = progress;
      const step = Math.min(travel, PAGE_WIDTH - progress);
      progress += step; travel -= step;
      notes.forEach((point) => { if (point.x > oldProgress && point.x <= progress) note(point.y, Math.min(1.15, Math.max(.58, delta * 10)), point.x); });
    }
    updatePlayer();
  }

  function pointerAngle(event) {
    const bounds = crank.getBoundingClientRect();
    return Math.atan2(event.clientY - bounds.top - bounds.height / 2, event.clientX - bounds.left - bounds.width / 2);
  }

  crank.addEventListener("pointerdown", async (event) => {
    if (!await audioReady()) return;
    crank.setPointerCapture(event.pointerId);
    previousAngle = pointerAngle(event);
    $("player-status").textContent = isKorean() ? "손잡이를 돌리고 있어요…" : "Turning the music box…";
  });
  crank.addEventListener("pointermove", (event) => {
    if (previousAngle === null) return;
    const next = pointerAngle(event);
    let delta = next - previousAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    previousAngle = next;
    turn(Math.max(0, delta));
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => crank.addEventListener(eventName, () => { previousAngle = null; }));
  crank.addEventListener("keydown", async (event) => {
    if (!["ArrowRight", "ArrowUp", " "].includes(event.key)) return;
    event.preventDefault();
    if (await audioReady()) turn(Math.PI / 12);
  });

  $("player-rewind").addEventListener("click", () => {
    progress = 0; angle = 0; activeHarmonyStep = -1;
    $("player-status").textContent = t("playerInstruction");
    updatePlayer();
  });
  toneSelector.addEventListener("change", async () => { toneName = toneSelector.value; await audioReady(); });
  volume.addEventListener("input", () => { if (master && audio) master.gain.setTargetAtTime(Number(volume.value) / 100, audio.currentTime, .02); });
  document.addEventListener("orgo-languagechange", updateCopy);

  if (!archiveId || !readItem()) {
    $("player-machine").remove();
    document.querySelector(".player-settings").remove();
    document.querySelector(".saved-paper").remove();
    $("player-title").textContent = t("playerUnavailableTitle");
    $("player-description").textContent = t("playerUnavailableCopy");
    document.querySelector(".player-intro").classList.add("player-empty");
  } else {
    updateCopy();
    drawSheet();
    updatePlayer();
  }
})();
