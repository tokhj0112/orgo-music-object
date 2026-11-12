(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (key) => window.orgoI18n?.text(key) || key;
  const video = $("webcam");
  const overlay = $("hand-overlay");
  const overlayCtx = overlay.getContext("2d");
  const sheet = $("gesture-sheet");
  const sheetCtx = sheet.getContext("2d");
  const fingertipPointer = $("fingertip-pointer");
  const placeholder = $("sheet-placeholder");
  const cameraPlaceholder = $("camera-placeholder");
  const cameraStatus = $("camera-status");
  const handState = $("hand-state");
  const noteCount = $("note-count");
  const playButton = $("play-score");
  const finishButton = $("finish-score");
  const undoButton = $("undo-stroke");
  const clearButton = $("clear-sheet");
  const saveHandButton = $("save-hand-archive");
  const sheetActions = document.querySelector(".sheet-actions");
  const finishNextStep = $("finish-next-step");
  const cameraLed = $("camera-led");
  const toneSelector = $("hand-tone");
  const playerScreen = $("player-screen");
  const playerFeed = $("player-feed");
  const playerFeedCtx = playerFeed.getContext("2d");
  const playerCrank = $("player-crank");
  const playerPercent = $("player-percent");
  const handCrankStatus = $("hand-crank-status");
  const handCrankLed = $("hand-crank-led");
  const autoPlayerButton = $("auto-player");
  const autoSpeedInput = $("auto-speed");
  const autoSpeedValue = $("auto-speed-value");
  const cameraGuideDialog = $("camera-guide-dialog");
  const signalConsole = $("signal-console");
  const signalMode = $("signal-mode");
  const signalCanvases = {
    sheet: $("signal-sheet"),
    rack: $("signal-rack"),
    roll: $("signal-roll"),
    orbit: $("signal-orbit"),
  };
  const signalReadout = {
    printed: $("signal-printed"),
    time: $("signal-time"),
    lufs: $("signal-lufs"),
    peak: $("signal-peak"),
    current: $("signal-current"),
    bar: $("signal-bar"),
    tempo: $("signal-tempo"),
    hits: $("signal-hits"),
    revolution: $("signal-revolution"),
    sounding: $("signal-sounding"),
  };

  const pitches = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
  const toneProfiles = {
    bright: {
      label: "맑은 별빛",
      filter: 8600,
      detune: 8,
      reverb: 0.11,
      partials: [
        { ratio: 1, gain: 0.165, decay: 1.85 },
        { ratio: 2.02, gain: 0.115, decay: 1.2 },
        { ratio: 2.78, gain: 0.075, decay: 0.9 },
        { ratio: 5.42, gain: 0.035, decay: 0.55 },
      ],
    },
    warm: {
      label: "따뜻한 숲",
      filter: 5600,
      detune: 5,
      reverb: 0.2,
      partials: [
        { ratio: 0.5, gain: 0.025, decay: 1.35 },
        { ratio: 1, gain: 0.18, decay: 2.3 },
        { ratio: 2.01, gain: 0.075, decay: 1.45 },
        { ratio: 2.76, gain: 0.035, decay: 1.02 },
        { ratio: 5.4, gain: 0.01, decay: 0.62 },
      ],
    },
    soft: {
      label: "밤의 자장가",
      filter: 3900,
      detune: 3,
      reverb: 0.28,
      partials: [
        { ratio: 0.5, gain: 0.045, decay: 1.6 },
        { ratio: 1, gain: 0.16, decay: 2.8 },
        { ratio: 2, gain: 0.048, decay: 1.7 },
        { ratio: 2.72, gain: 0.016, decay: 1.1 },
      ],
    },
  };
  let handTracker = null;
  let camera = null;
  let stream = null;
  let drawing = false;
  let lastPoint = null;
  let lastNote = null;
  let strokes = [];
  let currentStroke = null;
  let currentStrokeId = null;
  let notes = [];
  let audio = null;
  let master = null;
  let signalAnalyser = null;
  let signalTimeData = null;
  let signalFrequencyData = null;
  let finished = false;
  let reverbMix = null;
  let toneName = "warm";
  let isPinching = false;
  let smoothedPinchRatio = null;
  let pinchFrames = 0;
  let releaseFrames = 0;
  let stabilizedPoint = null;
  let lastPointTime = 0;
  let lastHarmonyTime = -Infinity;
  let activeHarmonyStep = -1;
  let playerProgress = 0;
  let playerAngle = 0;
  let previousCrankAngle = null;
  let previousHandCrankAngle = null;
  let handCrankMotion = 0;
  let signalAnimation = 0;
  let autoPlayerAnimation = 0;
  let autoPlayerLastFrame = 0;
  let autoPlaying = false;
  let autoPlayerStart = 0;
  let autoPlayerEnd = sheet.width;
  let playbackStart = 0;
  let playbackEnd = sheet.width;
  let autoPlayDuration = 6;
  let autoPlaySpeed = Number(autoSpeedInput.value) || 1.25;
  const PLAYER_ROTATION = Math.PI * 8;
  const noteNames = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
  const signalState = {
    energy: 0,
    hitCount: 0,
    noteIndex: -1,
    activityUntil: 0,
    tempo: 96,
    phase: 0,
    lastFrame: 0,
  };

  const harmonyProgression = [
    [261.63, 329.63, 392],
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 246.94, 293.66],
  ];

  function updatePlaybackWindow() {
    if (!notes.length) {
      playbackStart = 0;
      playbackEnd = sheet.width;
      autoPlayerStart = playbackStart;
      autoPlayerEnd = playbackEnd;
      autoPlayDuration = 4;
      return;
    }

    const positions = notes.map((note) => note.x);
    const first = Math.min(...positions);
    const last = Math.max(...positions);
    const rawSpan = Math.max(1, last - first);
    const padding = Math.max(18, Math.min(42, rawSpan * .055));
    const minimumSpan = Math.min(sheet.width, Math.max(120, sheet.width * .16));
    let start = Math.max(0, first - padding);
    let end = Math.min(sheet.width, last + padding);

    if (end - start < minimumSpan) {
      const center = (first + last) / 2;
      start = Math.max(0, center - minimumSpan / 2);
      end = Math.min(sheet.width, start + minimumSpan);
      start = Math.max(0, end - minimumSpan);
    }

    playbackStart = start;
    playbackEnd = Math.max(start + 1, end);
    autoPlayerStart = playbackStart;
    autoPlayerEnd = playbackEnd;
    autoPlayDuration = Math.max(3.6, Math.min(7.2,
      2.5 + Math.sqrt(notes.length) * .72 + (rawSpan / sheet.width) * 1.45
    ));
  }

  function scoreXRatio(x) {
    const span = Math.max(1, playbackEnd - playbackStart);
    return Math.max(0, Math.min(1, (x - playbackStart) / span));
  }

  function playbackProgressRatio() {
    return scoreXRatio(playerProgress);
  }

  function updateAutoSpeed() {
    autoPlaySpeed = Math.max(.75, Math.min(2, Number(autoSpeedInput.value) || 1.25));
    autoSpeedValue.textContent = `${String(autoPlaySpeed).replace(/\.0+$/, "")}×`;
    if (autoPlaying) signalState.tempo = Math.round(88 + autoPlaySpeed * 24);
  }

  function updateSheet() {
    sheetCtx.clearRect(0, 0, sheet.width, sheet.height);
    sheetCtx.lineCap = "round";
    sheetCtx.lineJoin = "round";

    strokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      sheetCtx.beginPath();
      sheetCtx.strokeStyle = "#343434";
      sheetCtx.lineWidth = 7;
      sheetCtx.moveTo(stroke[0].x, stroke[0].y);

      for (let index = 1; index < stroke.length - 1; index++) {
        const point = stroke[index];
        const next = stroke[index + 1];
        sheetCtx.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) / 2,
          (point.y + next.y) / 2
        );
      }

      const last = stroke[stroke.length - 1];
      sheetCtx.lineTo(last.x, last.y);
      sheetCtx.stroke();
    });
  }

  function initAudio() {
    if (audio) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audio = new AudioContextClass();
    master = audio.createGain();
    master.gain.value = 0.55;

    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 8;

    const reverb = audio.createConvolver();
    const length = Math.floor(audio.sampleRate * 1.7);
    const impulse = audio.createBuffer(2, length, audio.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index++) {
        const fade = (1 - index / length) ** 2.9;
        data[index] = (Math.random() * 2 - 1) * fade;
      }
    }

    reverb.buffer = impulse;

    const reverbTone = audio.createBiquadFilter();
    reverbTone.type = "lowpass";
    reverbTone.frequency.value = 3400;

    const reverbGain = audio.createGain();
    reverbGain.gain.value = toneProfiles[toneName].reverb;
    reverbMix = reverbGain;

    master.connect(compressor);
    master.connect(reverb);
    reverb.connect(reverbTone);
    reverbTone.connect(reverbGain);
    reverbGain.connect(compressor);

    signalAnalyser = audio.createAnalyser();
    signalAnalyser.fftSize = 256;
    signalAnalyser.smoothingTimeConstant = 0.82;
    signalTimeData = new Uint8Array(signalAnalyser.fftSize);
    signalFrequencyData = new Uint8Array(signalAnalyser.frequencyBinCount);
    compressor.connect(signalAnalyser);
    signalAnalyser.connect(audio.destination);
  }

  function playNote(y, strength = 0.8, x) {
    if (!audio || !master) return;
    const index = Math.max(0, Math.min(pitches.length - 1, pitches.length - 1 - Math.round((y / sheet.height) * (pitches.length - 1))));
    const frequency = pitches[index];
    const now = audio.currentTime;
    const pitchDecay = Math.max(0.8, Math.min(1.2, 700 / frequency));
    const profile = toneProfiles[toneName];

    signalState.energy = Math.max(signalState.energy, Math.min(1, strength * 0.92));
    signalState.hitCount += 1;
    signalState.noteIndex = index;
    signalState.activityUntil = performance.now() + 420;

    profile.partials.forEach((partial) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const filter = audio.createBiquadFilter();
      const panner = audio.createStereoPanner
        ? audio.createStereoPanner()
        : null;
      const decay = partial.decay * pitchDecay;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency * partial.ratio;
      oscillator.detune.value = (Math.random() - 0.5) * profile.detune;
      filter.type = "lowpass";
      filter.frequency.value = profile.filter;
      filter.Q.value = 0.3;
      if (panner) panner.pan.value = ((index / (pitches.length - 1)) * 2 - 1) * 0.12;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(partial.gain * strength, now + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      oscillator.connect(envelope).connect(filter);
      if (panner) filter.connect(panner).connect(master);
      else filter.connect(master);
      oscillator.start();
      oscillator.stop(now + decay + 0.04);
    });

    if (x !== undefined) playHarmony(x, strength);
  }

  function playHarmony(x, strength) {
    const now = audio.currentTime;
    const step = Math.min(3, Math.floor((x / sheet.width) * 4));
    if (step === activeHarmonyStep || now - lastHarmonyTime < 0.7) return;

    activeHarmonyStep = step;
    lastHarmonyTime = now;

    harmonyProgression[step].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const filter = audio.createBiquadFilter();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (index - 1) * 2;
      filter.type = "lowpass";
      filter.frequency.value = 3600;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.032 * strength, now + 0.035);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      oscillator.connect(envelope).connect(filter).connect(master);
      oscillator.start();
      oscillator.stop(now + 2.85);
    });
  }

  function signalSurface(canvas) {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
  }

  function drawSignalGrid(context, width, height, columns, rows) {
    context.save();
    context.strokeStyle = "rgba(160, 160, 160, 0.11)";
    context.lineWidth = 1;

    for (let column = 1; column < columns; column++) {
      const x = Math.round((width / columns) * column) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    for (let row = 1; row < rows; row++) {
      const y = Math.round((height / rows) * row) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.restore();
  }

  function readSignalMeter() {
    let rms = 0;
    let peak = 0;

    if (signalAnalyser && signalTimeData) {
      signalAnalyser.getByteTimeDomainData(signalTimeData);
      let sum = 0;
      signalTimeData.forEach((sample) => {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
        peak = Math.max(peak, Math.abs(normalized));
      });
      rms = Math.sqrt(sum / signalTimeData.length);
    }

    return {
      rms,
      peak,
      level: Math.min(1, Math.max(signalState.energy * 0.68, rms * 3.1)),
    };
  }

  function drawSignalSheet(level) {
    const { context, width, height } = signalSurface(signalCanvases.sheet);
    const lanes = 5;
    const laneHeight = height / lanes;
    drawSignalGrid(context, width, height, 1, lanes);

    if (strokes.length === 0) {
      context.strokeStyle = "rgba(180, 180, 180, 0.32)";
      context.beginPath();
      context.moveTo(9, height / 2);
      context.lineTo(width - 9, height / 2);
      context.stroke();
      return;
    }

    for (let lane = 0; lane < lanes; lane++) {
      const laneCenter = laneHeight * (lane + 0.5);
      const alpha = 0.2 + lane * 0.09 + level * 0.12;
      const horizontalDrift = (lane - 2) * 1.7;
      context.strokeStyle = `rgba(190, 190, 190, ${alpha})`;
      context.lineWidth = lane === lanes - 2 ? 1.45 : 0.9;

      strokes.forEach((stroke) => {
        if (stroke.length < 2) return;
        context.beginPath();
        stroke.forEach((point, index) => {
          const x = 8 + scoreXRatio(point.x) * (width - 16) + horizontalDrift;
          const wave = ((point.y / sheet.height) - 0.5) * laneHeight * (0.58 + level * 0.18);
          const y = laneCenter + wave;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      });
    }

    const progressX = playbackProgressRatio() * width;
    context.fillStyle = "#dedede";
    context.beginPath();
    context.arc(progressX, height / 2, 3.5 + level * 2.5, 0, Math.PI * 2);
    context.fill();
  }

  function drawSignalRack(level) {
    const { context, width, height } = signalSurface(signalCanvases.rack);
    const waveformHeight = height * 0.57;
    drawSignalGrid(context, width, waveformHeight, 8, 3);

    context.save();
    context.beginPath();
    context.rect(0, 0, width, waveformHeight);
    context.clip();
    context.strokeStyle = "#bdbdbd";
    context.lineWidth = 1.45;
    context.beginPath();

    const points = signalTimeData?.length || 96;
    for (let index = 0; index < points; index++) {
      const sample = signalTimeData
        ? (signalTimeData[index] - 128) / 128
        : Math.sin(signalState.phase + index * 0.2) * level * 0.08;
      const x = (index / (points - 1)) * width;
      const y = waveformHeight / 2 + sample * waveformHeight * 0.38;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.restore();

    if (signalAnalyser && signalFrequencyData) {
      signalAnalyser.getByteFrequencyData(signalFrequencyData);
    }

    const spectrumTop = waveformHeight + 5;
    const spectrumHeight = height - spectrumTop - 4;
    const bars = 22;
    const gap = 2;
    const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars);
    for (let index = 0; index < bars; index++) {
      const sourceIndex = Math.floor((index / bars) * (signalFrequencyData?.length || bars));
      const sampled = signalFrequencyData ? signalFrequencyData[sourceIndex] / 255 : 0;
      const value = Math.max(sampled, level * Math.max(0, 1 - Math.abs(index - 8) / 12) * 0.54);
      const barHeight = Math.max(1, value * spectrumHeight);
      context.fillStyle = index === 8 || index === 9 ? "#d2d2d2" : "rgba(180, 180, 180, 0.48)";
      context.fillRect(index * (barWidth + gap), spectrumTop + spectrumHeight - barHeight, barWidth, barHeight);
    }
  }

  function drawSignalRoll(level) {
    const { context, width, height } = signalSurface(signalCanvases.roll);
    const labelWidth = 28;
    drawSignalGrid(context, width, height, 8, pitches.length);

    context.font = "7px Consolas, monospace";
    context.fillStyle = "rgba(200, 200, 200, 0.48)";
    ["E5", "C5", "G4", "C4"].forEach((label, index) => {
      context.fillText(label, 5, 14 + index * ((height - 12) / 4));
    });

    notes.forEach((note, index) => {
      const x = labelWidth + scoreXRatio(note.x) * (width - labelWidth - 5);
      const pitch = Math.max(0, Math.min(pitches.length - 1, pitches.length - 1 - Math.round((note.y / sheet.height) * (pitches.length - 1))));
      const y = height - ((pitch + 0.5) / pitches.length) * height;
      const played = note.x <= playerProgress;
      context.fillStyle = played ? "#ccc" : "rgba(145, 145, 145, 0.35)";
      context.fillRect(x, y - 1.5, 5 + (index % 3) * 2 + level * 3, 3);
    });

    const playhead = labelWidth + playbackProgressRatio() * (width - labelWidth - 5);
    context.strokeStyle = "#e6e6e6";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(playhead, 0);
    context.lineTo(playhead, height);
    context.stroke();
  }

  function drawSignalOrbit(level) {
    const { context, width, height } = signalSurface(signalCanvases.orbit);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.34;
    const progress = playbackProgressRatio();

    context.strokeStyle = "rgba(165, 165, 165, 0.2)";
    context.lineWidth = 1;
    [0.58, 0.82, 1].forEach((scale) => {
      context.beginPath();
      context.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
      context.stroke();
    });

    notes.forEach((note, index) => {
      const angle = scoreXRatio(note.x) * Math.PI * 2 - Math.PI / 2;
      const ring = 0.62 + (1 - note.y / sheet.height) * 0.33;
      const x = centerX + Math.cos(angle) * radius * ring;
      const y = centerY + Math.sin(angle) * radius * ring;
      context.fillStyle = note.x <= playerProgress ? "#c7c7c7" : "rgba(145, 145, 145, 0.28)";
      context.beginPath();
      context.arc(x, y, 1.7 + ((index + signalState.hitCount) % 3) * 0.55 + level, 0, Math.PI * 2);
      context.fill();
    });

    context.strokeStyle = "#d5d5d5";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.beginPath();
    context.arc(centerX, centerY, radius * 0.82, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    context.stroke();

    const hand = playerAngle - Math.PI / 2;
    context.strokeStyle = "#e6e6e6";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(hand) * radius * 1.08, centerY + Math.sin(hand) * radius * 1.08);
    context.stroke();

    context.fillStyle = "#e7e7e7";
    context.textAlign = "center";
    context.font = "8px Consolas, monospace";
    context.fillText("마디", centerX, centerY - 6);
    context.font = "600 23px -apple-system, sans-serif";
    context.fillText(String(Math.min(4, Math.floor(progress * 4) + 1)), centerX, centerY + 18);
    context.textAlign = "start";
  }

  function updateSignalReadout(meter) {
    const progress = playbackProgressRatio();
    const seconds = Math.round(progress * (autoPlayDuration / autoPlaySpeed));
    const lufs = meter.rms > 0.0005 ? `${(20 * Math.log10(meter.rms) - 8).toFixed(1)} LUFS` : "−∞ LUFS";
    const peak = meter.peak > 0.0005 ? `${Math.min(0, 20 * Math.log10(meter.peak)).toFixed(1)} dBFS` : "0.0 dBFS";
    const current = signalState.noteIndex >= 0 ? noteNames[signalState.noteIndex] : "—";

    signalReadout.printed.textContent = `${Math.round(progress * 100)}%`;
    signalReadout.time.textContent = `0:${String(seconds).padStart(2, "0")}`;
    signalReadout.lufs.textContent = lufs;
    signalReadout.peak.textContent = peak;
    signalReadout.current.textContent = current;
    signalReadout.bar.textContent = `마디 ${Math.min(4, Math.floor(progress * 4) + 1)}.${Math.floor((progress * 16) % 4) + 1}`;
    signalReadout.tempo.textContent = `빠르기 ${String(Math.round(signalState.tempo)).padStart(3, "0")} BPM`;
    signalReadout.hits.textContent = `음 ${signalState.hitCount}개`;
    signalReadout.revolution.textContent = `${(playerAngle / (Math.PI * 2)).toFixed(2)}바퀴`;
    signalReadout.sounding.textContent = `재생 음 ${current}`;
  }

  function drawSignalFrame(timestamp) {
    const elapsed = signalState.lastFrame ? Math.min(50, timestamp - signalState.lastFrame) : 16;
    signalState.lastFrame = timestamp;
    signalState.phase += elapsed * 0.006 * (1 + signalState.energy * 2.4);
    signalState.energy *= Math.pow(0.88, elapsed / 16);

    const meter = readSignalMeter();
    const active = performance.now() < signalState.activityUntil;
    signalConsole.classList.toggle("is-active", active);
    signalConsole.style.setProperty("--signal-energy", meter.level.toFixed(3));
    signalMode.textContent = active ? "회전 중 / 실시간" : "준비 / 듣기";

    drawSignalSheet(meter.level);
    drawSignalRack(meter.level);
    drawSignalRoll(meter.level);
    drawSignalOrbit(meter.level);
    updateSignalReadout(meter);
    signalAnimation = requestAnimationFrame(drawSignalFrame);
  }

  function startSignalConsole() {
    if (signalAnimation) cancelAnimationFrame(signalAnimation);
    signalState.lastFrame = 0;
    signalAnimation = requestAnimationFrame(drawSignalFrame);
  }

  function stopSignalConsole() {
    if (signalAnimation) cancelAnimationFrame(signalAnimation);
    signalAnimation = 0;
    signalConsole.classList.remove("is-active");
  }

  function addPoint(point) {
    if (finished) return;

    if (!currentStroke) {
      currentStroke = [];
      strokes.push(currentStroke);
      currentStrokeId = strokes.length - 1;
    }

    const distance = lastPoint
      ? Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y)
      : 0;
    if (lastPoint && distance < 7) return;

    // 프레임이 드문 구간도 종이 위 선이 끊기거나 각지지 않도록 사이를 보완합니다.
    if (lastPoint && distance > 18) {
      const segments = Math.min(8, Math.floor(distance / 16));
      for (let step = 1; step <= segments; step++) {
        const amount = step / (segments + 1);
        currentStroke.push({
          x: lastPoint.x + (point.x - lastPoint.x) * amount,
          y: lastPoint.y + (point.y - lastPoint.y) * amount,
        });
      }
    }
    currentStroke.push(point);
    lastPoint = point;
    placeholder.hidden = true;
    updateSheet();
    undoButton.disabled = false;

    if (!lastNote || Math.hypot(point.x - lastNote.x, point.y - lastNote.y) > 65) {
      const quantized = {
        x: Math.round(point.x / 45) * 45,
        y: Math.round(point.y / 64) * 64,
      };
      notes.push({ ...quantized, strokeId: currentStrokeId });
      lastNote = point;
      playNote(quantized.y, 0.72, quantized.x);
      noteCount.textContent = String(notes.length);
      noteCount.setAttribute("aria-label", `음 ${notes.length}개`);
      finishButton.disabled = false;
    }
  }

  function stopDrawing() {
    drawing = false;
    currentStroke = null;
    currentStrokeId = null;
    lastPoint = null;
    lastNote = null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getHandScale(landmarks) {
    // 손바닥이 기울어져도 폭 하나에만 의존하지 않도록 세로·가로 길이를 함께 씁니다.
    const palmWidth = Math.hypot(
      landmarks[5].x - landmarks[17].x,
      landmarks[5].y - landmarks[17].y
    );
    const palmLength = Math.hypot(
      landmarks[0].x - landmarks[9].x,
      landmarks[0].y - landmarks[9].y
    );
    return Math.max((palmWidth + palmLength) / 2, 0.065);
  }

  function resetPointStabilizer() {
    stabilizedPoint = null;
    lastPointTime = 0;
  }

  function mapHandToSheet(tip) {
    // 손을 화면 가장자리까지 옮기지 않아도 종이의 가장자리까지 쓸 수 있게
    // 유효 입력 영역을 조금 넓혀 매핑합니다. 영상만 좌우 반전되어 있습니다.
    const horizontalInset = 0.075;
    const verticalInset = 0.065;
    return {
      x: clamp((1 - tip.x - horizontalInset) / (1 - horizontalInset * 2), 0, 1) * sheet.width,
      y: clamp((tip.y - verticalInset) / (1 - verticalInset * 2), 0, 1) * sheet.height,
    };
  }

  function stabilizePoint(point) {
    const now = performance.now();
    if (!stabilizedPoint || now - lastPointTime > 220) {
      stabilizedPoint = { ...point };
      lastPointTime = now;
      return { ...stabilizedPoint };
    }

    const elapsed = Math.max(1, now - lastPointTime);
    const distance = Math.hypot(point.x - stabilizedPoint.x, point.y - stabilizedPoint.y);
    // 손이 가려졌을 때 한 프레임만 튀는 좌표는 선으로 연결하지 않습니다.
    const maximumStep = Math.max(165, elapsed * 4.8);
    if (distance > maximumStep && elapsed < 95) {
      return { ...stabilizedPoint };
    }

    // 멈춰 있을 때는 흔들림을 단단히 잡고, 손을 움직일 때는 즉시 따라갑니다.
    const follow = clamp(0.28 + (distance / 85) * 0.5, 0.28, 0.8);
    stabilizedPoint.x += (point.x - stabilizedPoint.x) * follow;
    stabilizedPoint.y += (point.y - stabilizedPoint.y) * follow;
    lastPointTime = now;
    return { ...stabilizedPoint };
  }

  function writingLandmark(landmarks) {
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    // 핀치 상태에서는 두 손가락이 닿는 지점 쪽으로 살짝 옮겨, 보이는 포인터와
    // 실제로 그려지는 위치가 최대한 일치하도록 합니다.
    const blend = isPinching ? 0.26 : 0;
    return {
      x: indexTip.x * (1 - blend) + thumbTip.x * blend,
      y: indexTip.y * (1 - blend) + thumbTip.y * blend,
    };
  }

  function updateFingertipPointer(point, mode = "idle") {
    if (!point || finished || !playerScreen.hidden) {
      fingertipPointer.hidden = true;
      return;
    }

    const paperBounds = sheet.parentElement.getBoundingClientRect();
    const sheetBounds = sheet.getBoundingClientRect();
    const x = sheetBounds.left - paperBounds.left + (point.x / sheet.width) * sheetBounds.width;
    const y = sheetBounds.top - paperBounds.top + (point.y / sheet.height) * sheetBounds.height;

    fingertipPointer.hidden = false;
    fingertipPointer.style.left = `${x}px`;
    fingertipPointer.style.top = `${y}px`;
    fingertipPointer.classList.toggle("is-writing", mode === "writing");
    fingertipPointer.classList.toggle("is-erasing", mode === "erasing");
  }

  function resetPinchState() {
    isPinching = false;
    pinchFrames = 0;
    releaseFrames = 0;
  }

  function updatePinchState(landmarks) {
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    // 손의 방향과 카메라와의 거리가 달라져도 같은 제스처로 읽히도록,
    // 두 손가락 간 거리를 손바닥의 가로·세로 평균 크기에 비례시킵니다.
    const rawRatio = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) /
      getHandScale(landmarks);

    smoothedPinchRatio = smoothedPinchRatio === null
      ? rawRatio
      : smoothedPinchRatio * 0.64 + rawRatio * 0.36;

    // 시작은 조금 넉넉하게, 해제는 더 여유 있게 잡고 2~3프레임만 확인합니다.
    // 그래서 닿을 때는 잘 시작하고, 쓰는 중에는 작은 떨림으로 끊기지 않습니다.
    pinchFrames = smoothedPinchRatio < 0.42 ? Math.min(pinchFrames + 1, 4) : Math.max(pinchFrames - 1, 0);
    releaseFrames = smoothedPinchRatio > 0.62 ? Math.min(releaseFrames + 1, 5) : 0;

    if (!isPinching && pinchFrames >= 2) {
      isPinching = true;
      releaseFrames = 0;
    }
    if (isPinching && releaseFrames >= 3) {
      isPinching = false;
      pinchFrames = 0;
    }
  }

  function getHandCrankAngle(landmarks) {
    // 카메라 화면의 중심이 아니라 손바닥을 축으로 삼습니다. 손이 화면의
    // 어느 위치에 있어도, 손목을 돌리는 동작만으로 안정적으로 인식됩니다.
    const pinch = {
      x: (landmarks[4].x + landmarks[8].x) / 2,
      y: (landmarks[4].y + landmarks[8].y) / 2,
    };
    const palm = landmarks[9];
    const mirroredPinchX = 1 - pinch.x;
    const mirroredPalmX = 1 - palm.x;
    const radius = Math.hypot(mirroredPinchX - mirroredPalmX, pinch.y - palm.y);

    if (radius < 0.045) return null;
    return Math.atan2(pinch.y - palm.y, mirroredPinchX - mirroredPalmX);
  }

  function resetHandCrankTracking() {
    previousHandCrankAngle = null;
    handCrankMotion = 0;
  }

  function drawOverlay(landmarks, pinching) {
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
    }

    overlayCtx.clearRect(0, 0, width, height);
    overlayCtx.strokeStyle = pinching ? "#f2f2f2" : "#b5b5b5";
    overlayCtx.fillStyle = pinching ? "#f2f2f2" : "#b5b5b5";
    overlayCtx.lineWidth = 3;

    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
    links.forEach(([from, to]) => {
      overlayCtx.beginPath();
      overlayCtx.moveTo(landmarks[from].x * width, landmarks[from].y * height);
      overlayCtx.lineTo(landmarks[to].x * width, landmarks[to].y * height);
      overlayCtx.stroke();
    });

    [4, 8].forEach((index) => {
      overlayCtx.beginPath();
      overlayCtx.arc(landmarks[index].x * width, landmarks[index].y * height, index === 8 ? 11 : 7, 0, Math.PI * 2);
      overlayCtx.fill();
    });
  }

  function onResults(results) {
    const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];
    if (!landmarks) {
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      smoothedPinchRatio = null;
      resetPinchState();
      resetPointStabilizer();
      updateFingertipPointer(null);
      if (!playerScreen.hidden) {
        handCrankStatus.textContent = autoPlaying
          ? t("cameraAutoPlaying")
          : t("cameraNeedHand");
        handCrankLed.classList.remove("is-on");
        resetHandCrankTracking();
      } else {
        handState.textContent = t("cameraNoHand");
      }
      resetPinchState();
      stopDrawing();
      return;
    }

    updatePinchState(landmarks);

    drawOverlay(landmarks, isPinching);
    const point = stabilizePoint(mapHandToSheet(writingLandmark(landmarks)));

    if (!playerScreen.hidden) {
      updateFingertipPointer(point);
      if (autoPlaying) {
        resetHandCrankTracking();
        handCrankLed.classList.remove("is-on");
        handCrankStatus.textContent = t("cameraAutoPlaying");
        return;
      }
      if (!isPinching) {
        resetHandCrankTracking();
        handCrankLed.classList.remove("is-on");
        handCrankStatus.textContent = t("cameraRotateHint");
        return;
      }

      const handAngle = getHandCrankAngle(landmarks);
      if (handAngle === null) {
        handCrankStatus.textContent = t("cameraRotateHint");
        return;
      }

      handCrankLed.classList.add("is-on");

      if (previousHandCrankAngle === null) {
        handCrankStatus.textContent = t("cameraCrankReady");
      } else {
        let delta = handAngle - previousHandCrankAngle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;

        // Tracking의 미세 떨림은 무시하고, 프레임 사이에 튄 값은 제한합니다.
        // 같은 동작을 조금 더 크게 전달해 작은 손목 회전도 자연스럽게 반영합니다.
        if (Math.abs(delta) >= 0.012) {
          const clockwise = Math.min(0.2, Math.max(0, delta));
          if (clockwise > 0) {
            handCrankMotion += clockwise;
            turnPlayer(clockwise * 1.55);
            handCrankStatus.textContent = t("cameraTurning");
          }
        }
      }

      previousHandCrankAngle = handAngle;
      return;
    }

    updateFingertipPointer(point, isPinching ? "writing" : "idle");

    if (!isPinching) {
      handState.textContent = t("cameraPinchHint");
      stopDrawing();
      return;
    }

    handState.textContent = t("cameraDrawing");
    drawing = true;
    addPoint(point);
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraStatus.textContent = "이 브라우저는 카메라 기능을 지원하지 않습니다.";
      return;
    }

    if (!window.Hands || !window.Camera) {
      cameraStatus.textContent = "손 인식 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.";
      return;
    }

    try {
      initAudio();
      if (audio && audio.state !== "running") await audio.resume();

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();

      handTracker = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      handTracker.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        // 실내 조명이나 손의 기울기가 있어도 추적이 너무 쉽게 끊기지 않도록
        // 초기 감지와 연속 추적 기준을 조금 낮춥니다. 이후 좌표 안정화가 미세한 오차를 잡습니다.
        minDetectionConfidence: 0.54,
        minTrackingConfidence: 0.5,
      });
      handTracker.onResults(onResults);

      camera = new Camera(video, {
        onFrame: async () => handTracker.send({ image: video }),
        width: 1280,
        height: 720,
      });
      camera.start();

      cameraPlaceholder.hidden = true;
      cameraLed.classList.add("is-on");
      cameraStatus.textContent = "카메라가 켜졌습니다. 검지와 엄지를 맞대고 공중에 그려보세요.";
    } catch (error) {
      cameraStatus.textContent = "카메라를 시작하지 못했습니다. 권한을 허용했는지 확인해 주세요.";
      console.error(error);
    }
  }

  function drawPlayerFeed() {
    const width = playerFeed.width;
    const height = playerFeed.height;
    const center = width / 2;
    const contentSpan = Math.max(1, playbackEnd - playbackStart);
    const feedScale = (width * .72) / contentSpan;

    playerFeedCtx.clearRect(0, 0, width, height);
    playerFeedCtx.fillStyle = "#ebebeb";
    playerFeedCtx.fillRect(0, 0, width, height);
    playerFeedCtx.strokeStyle = "#b8b8b8";
    playerFeedCtx.lineWidth = 2;

    for (let row = 1; row < 8; row++) {
      const y = (height / 8) * row;
      playerFeedCtx.beginPath();
      playerFeedCtx.moveTo(0, y);
      playerFeedCtx.lineTo(width, y);
      playerFeedCtx.stroke();
    }

    notes.forEach((note) => {
      const x = center + (note.x - playerProgress) * feedScale;
      const y = (note.y / sheet.height) * height;
      if (x < -12 || x > width + 12) return;
      playerFeedCtx.beginPath();
      playerFeedCtx.arc(x, y, 10, 0, Math.PI * 2);
      playerFeedCtx.fillStyle = "#333";
      playerFeedCtx.fill();
    });

    const percent = Math.round(playbackProgressRatio() * 100);
    playerPercent.textContent = `${percent}%`;
  }

  function rewindPlayer() {
    stopAutoPlayer();
    updatePlaybackWindow();
    playerProgress = playbackStart;
    playerAngle = 0;
    previousCrankAngle = null;
    activeHarmonyStep = -1;
    signalState.energy = 0;
    signalState.hitCount = 0;
    signalState.noteIndex = -1;
    signalState.tempo = 96;
    signalState.activityUntil = 0;
    playerCrank.style.setProperty("--angle", "0rad");
    drawPlayerFeed();
  }

  function turnPlayer(delta) {
    if (delta <= 0 || notes.length === 0) return;
    const playbackSpan = Math.max(1, playbackEnd - playbackStart);
    let travel = (delta * playbackSpan) / PLAYER_ROTATION;
    playerAngle += delta;
    signalState.tempo = Math.min(148, Math.max(72, 76 + delta * 420));
    signalState.activityUntil = performance.now() + 260;

    while (travel > 0) {
      if (playerProgress >= playbackEnd) {
        playerProgress = playbackStart;
        activeHarmonyStep = -1;
      }

      const oldProgress = playerProgress;
      const step = Math.min(travel, playbackEnd - playerProgress);
      playerProgress += step;
      travel -= step;

      notes.forEach((note) => {
        if (note.x > oldProgress && note.x <= playerProgress) {
          const strength = Math.min(1.12, Math.max(0.58, delta * 10));
          playNote(note.y, strength, note.x);
        }
      });
    }

    playerCrank.style.setProperty("--angle", `${playerAngle}rad`);
    drawPlayerFeed();
  }

  function stopAutoPlayer(statusKey) {
    autoPlaying = false;
    autoPlayerLastFrame = 0;
    if (autoPlayerAnimation) cancelAnimationFrame(autoPlayerAnimation);
    autoPlayerAnimation = 0;
    autoPlayerButton.setAttribute("aria-pressed", "false");
    autoPlayerButton.textContent = t("cameraAutoPlay");

    if (statusKey) handCrankStatus.textContent = t(statusKey);
  }

  function autoPlayerStep(timestamp) {
    if (!autoPlaying) return;
    if (!autoPlayerLastFrame) {
      autoPlayerLastFrame = timestamp;
      autoPlayerAnimation = requestAnimationFrame(autoPlayerStep);
      return;
    }

    const elapsed = Math.min(50, timestamp - autoPlayerLastFrame) / 1000;
    autoPlayerLastFrame = timestamp;
    const playbackRange = Math.max(1, autoPlayerEnd - autoPlayerStart);
    const effectiveDuration = Math.max(1.8, autoPlayDuration / autoPlaySpeed);
    const travel = elapsed * (playbackRange / effectiveDuration);
    const delta = (travel / playbackRange) * PLAYER_ROTATION;
    const remainingDelta = ((autoPlayerEnd - playerProgress) / playbackRange) * PLAYER_ROTATION;

    if (remainingDelta <= 0.0005) {
      stopAutoPlayer("cameraAutoDone");
      return;
    }

    turnPlayer(Math.min(delta, remainingDelta));
    signalState.tempo = Math.round(88 + autoPlaySpeed * 24);
    handCrankStatus.textContent = t("cameraAutoPlaying");

    if (playerProgress >= autoPlayerEnd - 0.5) {
      stopAutoPlayer("cameraAutoDone");
      return;
    }

    autoPlayerAnimation = requestAnimationFrame(autoPlayerStep);
  }

  async function toggleAutoPlayer() {
    if (autoPlaying) {
      stopAutoPlayer();
      handCrankStatus.textContent = stream ? t("cameraRotateHint") : t("cameraCrank");
      return;
    }

    initAudio();
    if (audio && audio.state !== "running") await audio.resume();

    updatePlaybackWindow();
    autoPlayerStart = playbackStart;
    autoPlayerEnd = playbackEnd;

    if (playerProgress < autoPlayerStart || playerProgress >= autoPlayerEnd - 0.5) {
      stopAutoPlayer();
      playerProgress = autoPlayerStart;
      playerAngle = 0;
      activeHarmonyStep = -1;
      signalState.hitCount = 0;
      signalState.noteIndex = -1;
      playerCrank.style.setProperty("--angle", `${playerAngle}rad`);
      drawPlayerFeed();
    }

    autoPlaying = true;
    autoPlayerLastFrame = 0;
    autoPlayerButton.setAttribute("aria-pressed", "true");
    autoPlayerButton.textContent = t("cameraAutoPause");
    handCrankLed.classList.remove("is-on");
    handCrankStatus.textContent = t("cameraAutoPlaying");
    autoPlayerAnimation = requestAnimationFrame(autoPlayerStep);
  }

  function crankAngle(event) {
    const bounds = playerCrank.getBoundingClientRect();
    return Math.atan2(
      event.clientY - bounds.top - bounds.height / 2,
      event.clientX - bounds.left - bounds.width / 2
    );
  }

  function clearSheet() {
    strokes = [];
    notes = [];
    currentStrokeId = null;
    resetPointStabilizer();
    resetPinchState();
    finished = false;
    activeHarmonyStep = -1;
    placeholder.hidden = false;
    noteCount.textContent = "0";
    noteCount.setAttribute("aria-label", "음 0개");
    undoButton.disabled = true;
    playButton.disabled = true;
    finishButton.disabled = true;
    saveHandButton.disabled = true;
    finishNextStep.hidden = true;
    sheetActions.classList.remove("is-finished");
    signalState.energy = 0;
    signalState.hitCount = 0;
    signalState.noteIndex = -1;
    playbackStart = 0;
    playbackEnd = sheet.width;
    playerProgress = 0;
    clearButton.textContent = t("cameraClear");
    finishButton.textContent = t("cameraFinish");
    playButton.textContent = t("cameraPlay");
    saveHandButton.textContent = t("cameraSave");
    handState.textContent = t("cameraWaiting");
    updateSheet();
  }

  function undoLastStroke() {
    if (finished || strokes.length === 0) return;

    stopDrawing();
    const lastStrokeId = strokes.length - 1;
    strokes.pop();
    notes = notes.filter((note) => note.strokeId !== lastStrokeId);

    placeholder.hidden = strokes.length > 0;
    noteCount.textContent = String(notes.length);
    noteCount.setAttribute("aria-label", `음 ${notes.length}개`);
    undoButton.disabled = strokes.length === 0;
    finishButton.disabled = notes.length === 0;
    activeHarmonyStep = -1;
    handState.textContent = t("cameraUndone");
    updateSheet();
  }

  function finishScore() {
    if (notes.length === 0) return;
    finished = true;
    isPinching = false;
    stopDrawing();
    undoButton.disabled = true;
    finishButton.disabled = true;
    finishButton.textContent = t("cameraFinished");
    playButton.disabled = false;
    saveHandButton.disabled = false;
    updatePlaybackWindow();
    finishNextStep.hidden = false;
    sheetActions.classList.add("is-finished");
    clearButton.textContent = t("cameraStartOver");
    playButton.textContent = t("cameraPlayNext");
    saveHandButton.textContent = t("cameraSaveNext");
    handState.textContent = t("cameraFinished");
    cameraStatus.textContent = "입력이 끝났습니다. ‘연주하기’에서 손잡이를 돌려 재생하세요.";
    requestAnimationFrame(() => playButton.focus({ preventScroll: true }));
  }

  function requestArchiveName(onSave) {
    const korean = document.documentElement.lang === "ko";
    const copy = korean
      ? {
        title: "곡 제목 입력",
        description: "아카이브에 표시할 제목을 입력하세요.",
        placeholder: "예: 비 오는 날",
        cancel: "취소",
        save: "저장하기",
        fallback: "제목 없음",
      }
      : {
        title: "Name this melody",
        description: "Choose a name to keep with this melody in your archive.",
        placeholder: "e.g. A melody for rainy days",
        cancel: "Cancel",
        save: "Save to archive",
        fallback: "Untitled melody",
      };
    const dialog = document.createElement("dialog");
    const form = document.createElement("form");
    const heading = document.createElement("h2");
    const description = document.createElement("p");
    const input = document.createElement("input");
    const actions = document.createElement("div");
    const cancel = document.createElement("button");
    const save = document.createElement("button");

    dialog.className = "archive-name-dialog";
    form.method = "dialog";
    heading.textContent = copy.title;
    description.textContent = copy.description;
    input.type = "text";
    input.maxLength = 32;
    input.placeholder = copy.placeholder;
    input.setAttribute("aria-label", copy.title);
    cancel.type = "button";
    cancel.textContent = copy.cancel;
    save.type = "submit";
    save.className = "primary";
    save.textContent = copy.save;
    actions.className = "archive-name-actions";
    actions.append(cancel, save);
    form.append(heading, description, input, actions);
    dialog.append(form);
    document.body.append(dialog);

    cancel.addEventListener("click", () => dialog.close());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onSave(input.value.trim() || copy.fallback);
      dialog.close();
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    requestAnimationFrame(() => input.focus());
  }

  function saveHandArchive(title) {
    if (!finished || notes.length === 0) return;

    const key = "orgo-archive";
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    const id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    saved.unshift({
      id,
      kind: "HAND",
      createdAt: new Date().toISOString(),
      title,
      width: sheet.width,
      height: sheet.height,
      tone: toneName,
      volume: 65,
      notes: notes.map(({ x, y }) => ({ x, y })),
      strokes: strokes.map((stroke) => {
        const interval = Math.max(1, Math.ceil(stroke.length / 240));

        return {
          ink: "#343434",
          width: 7,
          points: stroke
            .filter((_, index) => index % interval === 0 || index === stroke.length - 1)
            .map(({ x, y }) => ({ x, y })),
        };
      }),
    });

    localStorage.setItem(key, JSON.stringify(saved.slice(0, 30)));
    saveHandButton.textContent = t("cameraSaved");
    cameraStatus.textContent = "아카이브에 저장했습니다. ARCHIVE에서 다시 확인할 수 있어요.";
  }

  async function playScore() {
    if (!finished || notes.length === 0) return;
    initAudio();
    if (audio && audio.state !== "running") await audio.resume();
    updatePlaybackWindow();
    rewindPlayer();
    playerScreen.hidden = false;
    startSignalConsole();
    resetHandCrankTracking();
    handCrankLed.classList.remove("is-on");
    handCrankStatus.textContent = stream
      ? t("cameraRotateHint")
      : t("cameraCrank");
    playerScreen.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("start-camera").addEventListener("click", startCamera);
  $("open-camera-guide").addEventListener("click", () => cameraGuideDialog.showModal());
  cameraGuideDialog.addEventListener("close", () => {
    if (!stream) $("start-camera").focus();
  });
  clearButton.addEventListener("click", clearSheet);
  undoButton.addEventListener("click", undoLastStroke);
  finishButton.addEventListener("click", finishScore);
  saveHandButton.addEventListener("click", () => {
    if (!finished || notes.length === 0) return;
    requestArchiveName(saveHandArchive);
  });
  playButton.addEventListener("click", playScore);
  autoPlayerButton.addEventListener("click", toggleAutoPlayer);
  autoSpeedInput.addEventListener("input", updateAutoSpeed);
  updateAutoSpeed();
  $("rewind-player").addEventListener("click", rewindPlayer);
  $("close-player").addEventListener("click", () => {
    stopAutoPlayer();
    playerScreen.hidden = true;
    stopSignalConsole();
    resetHandCrankTracking();
    document.querySelector("main").scrollIntoView({ behavior: "smooth" });
  });

  playerCrank.addEventListener("pointerdown", (event) => {
    stopAutoPlayer();
    playerCrank.setPointerCapture(event.pointerId);
    previousCrankAngle = crankAngle(event);
  });

  playerCrank.addEventListener("pointermove", (event) => {
    if (previousCrankAngle === null) return;
    const nextAngle = crankAngle(event);
    let delta = nextAngle - previousCrankAngle;

    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    previousCrankAngle = nextAngle;
    turnPlayer(Math.max(0, delta));
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    playerCrank.addEventListener(eventName, () => {
      previousCrankAngle = null;
    });
  });

  playerCrank.addEventListener("keydown", async (event) => {
    if (!["ArrowRight", "ArrowUp", " "].includes(event.key)) return;
    event.preventDefault();
    stopAutoPlayer();
    initAudio();
    if (audio && audio.state !== "running") await audio.resume();
    turnPlayer(Math.PI / 12);
  });

  toneSelector.addEventListener("change", async (event) => {
    toneName = event.target.value;
    initAudio();

    if (audio && audio.state !== "running") await audio.resume();
    if (reverbMix) {
      reverbMix.gain.setTargetAtTime(
        toneProfiles[toneName].reverb,
        audio.currentTime,
        0.08
      );
    }

    playNote(sheet.height / 2, 0.85);
    cameraStatus.textContent = `${toneProfiles[toneName].label} 음색으로 바꿨어요.`;
  });
  window.addEventListener("pagehide", () => {
    stopAutoPlayer();
    stopSignalConsole();
    if (stream) stream.getTracks().forEach((track) => track.stop());
  });
  updateSheet();
  requestAnimationFrame(() => {
    if (!cameraGuideDialog.open) cameraGuideDialog.showModal();
  });
})();
