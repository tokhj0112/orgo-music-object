(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const isKorean = () => document.documentElement.lang === "ko";

  const canvas = $("sheet");
  const ctx = canvas.getContext("2d");
  const feed = $("feed");
  const feedCtx = feed.getContext("2d");

  const PAGE_WIDTH = 1200;
  // 종이 높이를 조금 넓혀 손글씨가 숨 쉴 공간을 만듭니다.
  const PAGE_HEIGHT = 460;
  // 글씨를 가리지 않도록 실제 펀칭 홀은 작고 또렷하게 표시합니다.
  const HOLE_RADIUS = 4;
  const PUNCH_SHAPES = ["circle", "star", "heart", "diamond"];
  const PUNCH_SIZES = {
    small: 0.78,
    medium: 1,
    large: 1.28,
  };

  // 자동재생 한 페이지 길이: 12초
  const PAGE_DURATION = 12000;

  // 손잡이 네 바퀴 = 종이 한 페이지
  const PAGE_ROTATION = Math.PI * 8;

  const pitches = [
    523.25,
    587.33,
    659.25,
    783.99,
    880,
    1046.5,
    1174.66,
    1318.51,
    1567.98,
  ];

  const toneProfiles = {
    bright: {
      label: "맑은 별빛",
      filter: 8800,
      detune: 8,
      reverb: 0.11,
      harmony: 0.022,
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
      harmony: 0.034,
      partials: [
        { ratio: 0.5, gain: 0.035, decay: 1.45 },
        { ratio: 1, gain: 0.18, decay: 2.5 },
        { ratio: 2.01, gain: 0.072, decay: 1.55 },
        { ratio: 2.76, gain: 0.035, decay: 1.1 },
        { ratio: 5.4, gain: 0.009, decay: 0.62 },
      ],
    },
    soft: {
      label: "밤의 자장가",
      filter: 4100,
      detune: 3,
      reverb: 0.28,
      harmony: 0.045,
      partials: [
        { ratio: 0.5, gain: 0.052, decay: 1.7 },
        { ratio: 1, gain: 0.16, decay: 2.8 },
        { ratio: 2, gain: 0.045, decay: 1.7 },
        { ratio: 2.72, gain: 0.016, decay: 1.12 },
      ],
    },
  };

  let toneName = "warm";
  // 아카이브에서 불러온 곡은 새 곡처럼 다시 저장하지 않고,
  // 이 페이지를 오르골 플레이어로 사용합니다.
  let archivePlayback = null;
  let lastArchivedId = null;
  let reverbMix = null;
  let lastHarmonyTime = -Infinity;
  let activeHarmonyStep = -1;

  // 손글씨의 어느 높이에서도 어울리도록 C 메이저 펜타토닉으로 제한하고,
  // 종이 진행에 따라 C → Am → F → G 코드가 아주 약하게 받쳐줍니다.
  const harmonyProgression = [
    [261.63, 329.63, 392],
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 246.94, 293.66],
  ];

  let strokes = [];
  let holes = [];
  let candidates = [];

  let current = null;
  let ink = "#222222";
  let mode = "write";
  let punchShape = "mix";
  let punchSize = "mix";

  let sound = true;
  let audio = null;
  let master = null;
  let audioOK = false;

  let autoTimer = 0;
  let punching = false;
  let punchToken = 0;

  let looping = false;
  let loopToken = 0;
  let lastFrame = 0;
  let raf = 0;

  let progress = 0;
  let angle = 0;
  let previousAngle = null;

  let pencilSource = null;
  let pencilGain = null;
  let pencilFilter = null;
  let pencilTimer = 0;

  /* ------------------------------
     오디오 초기화
  ------------------------------ */

  async function audioReady() {
    try {
      if (!audio) {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error("Web Audio is unavailable");
        }

        audio = new AudioContextClass();

        master = audio.createGain();
        master.gain.value = sound
          ? Number($("volume").value) / 100
          : 0;

        const limiter = audio.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 12;
        limiter.ratio.value = 10;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;

        // 작은 금속 상자 안에서 울리는 듯한 짧고 부드러운 잔향
        const reverb = audio.createConvolver();
        const reverbLength = Math.floor(audio.sampleRate * 1.65);
        const impulse = audio.createBuffer(
          2,
          reverbLength,
          audio.sampleRate
        );

        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);

          for (let index = 0; index < reverbLength; index++) {
            const fade = (1 - index / reverbLength) ** 2.8;
            data[index] = (Math.random() * 2 - 1) * fade;
          }
        }

        reverb.buffer = impulse;

        const reverbTone = audio.createBiquadFilter();
        reverbTone.type = "lowpass";
        reverbTone.frequency.value = 3200;
        reverbTone.Q.value = 0.45;

        const reverbGain = audio.createGain();
        reverbGain.gain.value = toneProfiles[toneName].reverb;
        reverbMix = reverbGain;

        master.connect(limiter);
        master.connect(reverb);
        reverb.connect(reverbTone);
        reverbTone.connect(reverbGain);
        reverbGain.connect(limiter);
        limiter.connect(audio.destination);
      }

      if (audio.state !== "running") {
        await audio.resume();
      }

      audioOK = audio.state === "running";

      if (!audioOK) {
        throw new Error("Audio context is suspended");
      }

      return true;
    } catch {
      audioOK = false;

      $("hint").textContent =
        "소리 연결이 중단됐어요. 상단의 ‘소리 확인’을 눌러 다시 연결해 주세요.";

      return false;
    }
  }

  function updateMasterVolume() {
    if (!master || !audio) return;

    const volume = sound
      ? Number($("volume").value) / 100
      : 0;

    master.gain.setTargetAtTime(
      volume,
      audio.currentTime,
      0.02
    );
  }

  /* ------------------------------
     펀칭 소리: 짧고 단단한 타격음
  ------------------------------ */

  function noise(duration, frequency, gain) {
    if (!sound || !audioOK) return;

    const time = audio.currentTime;

    const buffer = audio.createBuffer(
      1,
      Math.ceil(audio.sampleRate * duration),
      audio.sampleRate
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const envelope = audio.createGain();

    source.buffer = buffer;

    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;

    envelope.gain.setValueAtTime(gain, time);

    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      time + duration
    );

    source
      .connect(filter)
      .connect(envelope)
      .connect(master);

    source.start();

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  function holeStyle(point = {}, order = 0) {
    const x = Number.isFinite(point.x) ? point.x : 0;
    const y = Number.isFinite(point.y) ? point.y : 0;
    const signature = Math.abs(Math.floor(x * 11 + y * 7 + order * 17));
    const shape = punchShape === "mix"
      ? PUNCH_SHAPES[signature % PUNCH_SHAPES.length]
      : punchShape;
    const sizeNames = Object.keys(PUNCH_SIZES);
    const sizeName = punchSize === "mix"
      ? sizeNames[Math.floor(signature / PUNCH_SHAPES.length) % sizeNames.length]
      : punchSize;

    return {
      shape: PUNCH_SHAPES.includes(shape) ? shape : "circle",
      size: PUNCH_SIZES[sizeName] || 1,
    };
  }

  function prepareHole(point, order = holes.length) {
    Object.assign(point, holeStyle(point, order));
    return point;
  }

  function normalizedHole(point = {}) {
    const shape = PUNCH_SHAPES.includes(point.shape) ? point.shape : "circle";
    const size = Math.max(0.72, Math.min(1.35, Number(point.size) || 1));
    return { shape, size };
  }

  function punchPath(target, point, radius, shape = "circle") {
    const x = point.x;
    const y = point.y;
    target.beginPath();

    if (shape === "star") {
      for (let index = 0; index < 10; index++) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const length = index % 2 === 0 ? radius : radius * 0.43;
        const px = x + Math.cos(angle) * length;
        const py = y + Math.sin(angle) * length;
        if (index === 0) target.moveTo(px, py);
        else target.lineTo(px, py);
      }
      target.closePath();
      return;
    }

    if (shape === "heart") {
      target.moveTo(x, y + radius * 0.92);
      target.bezierCurveTo(
        x - radius * 1.2,
        y + radius * 0.14,
        x - radius * 1.05,
        y - radius * 0.78,
        x - radius * 0.45,
        y - radius * 0.68
      );
      target.bezierCurveTo(
        x - radius * 0.12,
        y - radius * 0.63,
        x,
        y - radius * 0.34,
        x,
        y - radius * 0.18
      );
      target.bezierCurveTo(
        x,
        y - radius * 0.34,
        x + radius * 0.12,
        y - radius * 0.63,
        x + radius * 0.45,
        y - radius * 0.68
      );
      target.bezierCurveTo(
        x + radius * 1.05,
        y - radius * 0.78,
        x + radius * 1.2,
        y + radius * 0.14,
        x,
        y + radius * 0.92
      );
      target.closePath();
      return;
    }

    if (shape === "diamond") {
      target.moveTo(x, y - radius);
      target.lineTo(x + radius * 0.82, y);
      target.lineTo(x, y + radius);
      target.lineTo(x - radius * 0.82, y);
      target.closePath();
      return;
    }

    target.arc(x, y, radius, 0, Math.PI * 2);
  }

  function punchSound(point = {}, order = holes.length) {
    if (!sound || !audioOK) return;

    // 뚫는 위치마다 종이의 저항과 금속판을 치는 위치가 다르게 느껴지도록,
    // 같은 점은 늘 같은 성격으로 들리고 점마다만 미세하게 달라지게 합니다.
    const x = Number.isFinite(point.x) ? point.x : 0;
    const y = Number.isFinite(point.y) ? point.y : PAGE_HEIGHT / 2;
    const vertical = 1 - Math.max(0, Math.min(1, y / PAGE_HEIGHT));
    const fingerprint = Math.sin(x * 0.0187 + y * 0.0431 + order * 0.71);
    const variation = (fingerprint + 1) / 2;
    const time = audio.currentTime;

    // 종이 섬유가 끊어지는 짧은 사각임: 높을수록 조금 더 맑게.
    noise(
      0.052 + variation * 0.045,
      1350 + vertical * 1050 + variation * 280,
      0.42 + variation * 0.16
    );

    // 금속 펀치의 몸통 소리와 아주 짧은 링을 겹쳐 각각 다른 타격감을 만듭니다.
    const body = audio.createOscillator();
    const bodyEnvelope = audio.createGain();
    const ring = audio.createOscillator();
    const ringEnvelope = audio.createGain();
    const bodyPitch = 92 + vertical * 88 + variation * 24;

    body.type = variation > 0.57 ? "triangle" : "sine";
    body.frequency.setValueAtTime(bodyPitch * 1.8, time);
    body.frequency.exponentialRampToValueAtTime(bodyPitch, time + 0.075 + variation * 0.025);

    bodyEnvelope.gain.setValueAtTime(0.0001, time);
    bodyEnvelope.gain.exponentialRampToValueAtTime(0.25 + vertical * 0.09, time + 0.003);
    bodyEnvelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.085 + variation * 0.04);

    ring.type = "sine";
    ring.frequency.setValueAtTime(1180 + vertical * 740 + variation * 220, time);
    ring.detune.value = (variation - 0.5) * 34;
    ringEnvelope.gain.setValueAtTime(0.0001, time);
    ringEnvelope.gain.exponentialRampToValueAtTime(0.055 + vertical * 0.025, time + 0.004);
    ringEnvelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.12 + variation * 0.09);

    body.connect(bodyEnvelope).connect(master);
    ring.connect(ringEnvelope).connect(master);

    body.start();
    ring.start();
    body.stop(time + 0.16);
    ring.stop(time + 0.25);

    body.onended = () => { body.disconnect(); bodyEnvelope.disconnect(); };
    ring.onended = () => { ring.disconnect(); ringEnvelope.disconnect(); };

    // 펀칭 순간에도 선택한 모양의 재질감을 짧게 미리 들려줍니다.
    if (point.shape && point.shape !== "circle") {
      playHoleNote(point, 0.24, false);
    }
  }

  /* ------------------------------
     글쓰기 소리: 이어지는 사각사각
  ------------------------------ */

  function silencePencil() {
    clearTimeout(pencilTimer);

    if (pencilGain && audio) {
      pencilGain.gain.setTargetAtTime(
        0,
        audio.currentTime,
        0.015
      );
    }
  }

  function writingSound(speed = 1) {
    if (!sound || !audioOK) return;

    if (!pencilSource) {
      const buffer = audio.createBuffer(
        1,
        audio.sampleRate * 2,
        audio.sampleRate
      );

      const data = buffer.getChannelData(0);
      let softenedNoise = 0;

      for (let i = 0; i < data.length; i++) {
        softenedNoise =
          0.8 * softenedNoise +
          0.2 * (Math.random() * 2 - 1);

        const texture =
          0.65 +
          0.35 * Math.sin((i / audio.sampleRate) * 97);

        data[i] = softenedNoise * texture;
      }

      pencilSource = audio.createBufferSource();
      pencilSource.buffer = buffer;
      pencilSource.loop = true;

      const highpass = audio.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 950;

      pencilFilter = audio.createBiquadFilter();
      pencilFilter.type = "peaking";
      pencilFilter.frequency.value = 3800;
      pencilFilter.Q.value = 0.8;
      pencilFilter.gain.value = 7;

      pencilGain = audio.createGain();
      pencilGain.gain.value = 0;

      pencilSource
        .connect(highpass)
        .connect(pencilFilter)
        .connect(pencilGain)
        .connect(master);

      pencilSource.start();
    }

    const intensity = Math.min(
      1,
      Math.max(0.1, speed / 22)
    );

    pencilGain.gain.setTargetAtTime(
      0.12 + intensity * 0.35,
      audio.currentTime,
      0.012
    );

    pencilFilter.frequency.setTargetAtTime(
      2800 + intensity * 1800,
      audio.currentTime,
      0.025
    );

    clearTimeout(pencilTimer);

    // 손이 멈추면 사각거리는 소리도 사라짐
    pencilTimer = setTimeout(silencePencil, 85);
  }

  /* ------------------------------
     오르골 음색
  ------------------------------ */

  function note(y, strength = 0.82, x) {
    if (!sound || !audioOK) return;

    const time = audio.currentTime;

    const pitchIndex = Math.max(
      0,
      Math.min(
        pitches.length - 1,
        8 - Math.round((y / PAGE_HEIGHT) * 8)
      )
    );

    const frequency = pitches[pitchIndex];
    const pitchDecay = Math.max(
      0.78,
      Math.min(1.2, 920 / frequency)
    );

    const profile = toneProfiles[toneName];
    const partials = profile.partials;

    partials.forEach((partial) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const tone = audio.createBiquadFilter();
      const panner = audio.createStereoPanner
        ? audio.createStereoPanner()
        : null;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency * partial.ratio;
      oscillator.detune.value =
        (Math.random() - 0.5) * profile.detune;

      tone.type = "lowpass";
      tone.frequency.value = profile.filter;
      tone.Q.value = 0.35;

      if (panner) {
        panner.pan.value =
          ((pitchIndex / (pitches.length - 1)) * 2 - 1) * 0.12;
      }

      const decay = partial.decay * pitchDecay;

      envelope.gain.setValueAtTime(0.0001, time);

      envelope.gain.exponentialRampToValueAtTime(
        partial.gain * strength,
        time + 0.005
      );

      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        time + decay
      );

      oscillator.connect(envelope).connect(tone);

      if (panner) {
        tone.connect(panner);
        panner.connect(master);
      } else {
        tone.connect(master);
      }

      oscillator.start();
      oscillator.stop(time + decay + 0.05);

      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        tone.disconnect();
        if (panner) panner.disconnect();
      };
    });

    if (x !== undefined) {
      playHarmony(x, strength);
    }
  }

  function pitchForY(y) {
    const pitchIndex = Math.max(
      0,
      Math.min(
        pitches.length - 1,
        8 - Math.round((y / PAGE_HEIGHT) * 8)
      )
    );
    return pitches[pitchIndex];
  }

  function playHoleNote(point, strength = 0.82, withHarmony = true) {
    if (!sound || !audioOK) return;

    const { shape, size } = normalizedHole(point);

    if (shape === "circle") {
      note(point.y, strength * (0.9 + size * 0.1), withHarmony ? point.x : undefined);
      return;
    }

    const time = audio.currentTime;
    const frequency = pitchForY(point.y);
    const sizeGain = 0.86 + size * 0.14;
    let voices;
    let filterType = "lowpass";
    let filterFrequency = 7600;

    if (shape === "star") {
      // 유리 조각을 살짝 건드린 듯한 밝고 긴 차임.
      voices = [
        { ratio: 1, gain: 0.13, decay: 2.25 },
        { ratio: 2.76, gain: 0.072, decay: 1.45 },
        { ratio: 5.32, gain: 0.035, decay: 0.86 },
      ];
      filterFrequency = 9400;
    } else if (shape === "heart") {
      // 짧게 위로 튀어 오르는 두 번의 피치로 ‘뿅뿅’ 질감을 만듭니다.
      voices = [
        { ratio: 1, from: 0.62, gain: 0.15, decay: 0.72, delay: 0 },
        { ratio: 1.19, from: 0.74, gain: 0.105, decay: 0.58, delay: 0.11 },
      ];
      filterFrequency = 4200;
    } else {
      // 다이아는 단단한 금속성 배음이 짧게 반짝입니다.
      voices = [
        { ratio: 1, gain: 0.11, decay: 1.08, type: "triangle" },
        { ratio: 1.414, gain: 0.065, decay: 0.82 },
        { ratio: 2.91, gain: 0.035, decay: 0.56 },
      ];
      filterType = "bandpass";
      filterFrequency = 5400;
    }

    voices.forEach((voice) => {
      const start = time + (voice.delay || 0);
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const tone = audio.createBiquadFilter();
      const targetFrequency = frequency * voice.ratio;

      oscillator.type = voice.type || "sine";
      oscillator.frequency.setValueAtTime(
        frequency * (voice.from || voice.ratio),
        start
      );
      if (voice.from) {
        oscillator.frequency.exponentialRampToValueAtTime(
          targetFrequency,
          start + 0.11
        );
      }

      tone.type = filterType;
      tone.frequency.value = filterFrequency;
      tone.Q.value = shape === "diamond" ? 0.7 : 0.28;

      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(
        voice.gain * strength * sizeGain,
        start + 0.006
      );
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        start + voice.decay
      );

      oscillator.connect(envelope).connect(tone).connect(master);
      oscillator.start(start);
      oscillator.stop(start + voice.decay + 0.04);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        tone.disconnect();
      };
    });

    if (withHarmony && point.x !== undefined) {
      playHarmony(point.x, strength * 0.82);
    }
  }

  function playHarmony(x, strength) {
    const time = audio.currentTime;
    const step = Math.min(
      harmonyProgression.length - 1,
      Math.floor((x / PAGE_WIDTH) * harmonyProgression.length)
    );

    if (step === activeHarmonyStep || time - lastHarmonyTime < 0.65) {
      return;
    }

    activeHarmonyStep = step;
    lastHarmonyTime = time;

    const profile = toneProfiles[toneName];

    harmonyProgression[step].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const tone = audio.createBiquadFilter();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (index - 1) * 2;

      tone.type = "lowpass";
      tone.frequency.value = profile.filter * 0.7;
      tone.Q.value = 0.25;

      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(
        profile.harmony * strength,
        time + 0.035
      );
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        time + 2.7
      );

      oscillator.connect(envelope).connect(tone).connect(master);
      oscillator.start();
      oscillator.stop(time + 2.76);

      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        tone.disconnect();
      };
    });
  }

  /* ------------------------------
     화면 그리기
  ------------------------------ */

  function draw(playX) {
    ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // 사용자가 쓴 원본 글씨
    for (const stroke of strokes) {
      ctx.beginPath();
      ctx.strokeStyle = stroke.ink;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      stroke.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      if (stroke.points.length === 1) {
        const point = stroke.points[0];
        ctx.lineTo(point.x + 0.01, point.y);
      }

      ctx.stroke();
    }

    // 아직 뚫지 않은 점
    if (mode !== "write") {
      for (let index = 0; index < candidates.length; index++) {
        const point = candidates[index];
        if (holes.includes(point)) continue;

        const preview = holeStyle(point, index);

        punchPath(
          ctx,
          point,
          HOLE_RADIUS * preview.size,
          preview.shape
        );

        ctx.fillStyle = "#eeece5";
        ctx.fill();

        ctx.strokeStyle = "#8c887e";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 완성된 펀칭 구멍
    for (const point of holes) {
      const style = normalizedHole(point);
      punchPath(
        ctx,
        point,
        HOLE_RADIUS * style.size,
        style.shape
      );

      ctx.fillStyle = "#181818";
      ctx.fill();

      ctx.strokeStyle = "#ffffff99";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 현재 연주 위치
    if (playX !== undefined) {
      ctx.fillStyle = "#a45345";
      ctx.fillRect(playX, 0, 1.5, PAGE_HEIGHT);
    }

    $("placeholder").hidden = strokes.length > 0;

    $("count").textContent =
      mode === "write"
        ? `${strokes.length} STROKES`
        : `${holes.length} / ${candidates.length} HOLES`;

    $("next").disabled =
      mode === "write"
        ? strokes.length === 0
        : mode === "punch"
          ? holes.length === 0
          : false;

    $("undo").disabled =
      mode === "listen" ||
      (mode === "write"
        ? strokes.length === 0
        : holes.length === 0);

    $("auto").disabled =
      mode === "punch" &&
      candidates.length > 0 &&
      holes.length === candidates.length &&
      !punching;

    drawFeed();
  }

  function drawFeed() {
    feedCtx.clearRect(0, 0, 600, 100);

    feedCtx.fillStyle = "#eeece5";
    feedCtx.fillRect(0, 0, 600, 100);

    // 반복되는 같은 종이를 앞뒤로 이어서 표시
    for (const pageOffset of [-PAGE_WIDTH, 0, PAGE_WIDTH]) {
      for (const hole of holes) {
        const x =
          300 + (hole.x + pageOffset - progress) * 0.6;

        if (x < -5 || x > 605) continue;

        const y = 10 + (hole.y / PAGE_HEIGHT) * 80;

        const style = normalizedHole(hole);
        punchPath(
          feedCtx,
          { x, y },
          2.6 * style.size,
          style.shape
        );
        feedCtx.fillStyle = "#222";
        feedCtx.fill();
      }
    }

    feedCtx.fillStyle = "#a45345";
    feedCtx.fillRect(299, 0, 2, 100);
  }

  /* ------------------------------
     정지 / 단계 전환
  ------------------------------ */

  function stop() {
    looping = false;
    loopToken++;

    punching = false;
    punchToken++;

    cancelAnimationFrame(raf);
    clearTimeout(autoTimer);

    silencePencil();

    $("autoplay").textContent = isKorean() ? "자동재생 · 한 페이지 반복 ↻" : "Autoplay · repeat page ↻";

    $("autoplay").setAttribute("aria-pressed", "false");

    $("auto").textContent = isKorean() ? "자동으로 모두 뚫기" : "Punch all automatically";

    $("next").textContent = isKorean()
      ? (mode === "listen" ? "다시 연주하기 ↶" : mode === "punch" ? "이 종이로 연주하기 →" : "다 썼어요 · 펀칭하기 →")
      : (mode === "listen" ? "Play again ↶" : mode === "punch" ? "Play this page →" : "Finished writing · punch it →");

    draw(mode === "listen" ? progress : undefined);
  }

  function setMode(nextMode) {
    if (nextMode === mode) return;

    if (nextMode === "punch" && strokes.length === 0) {
      $("hint").textContent =
      isKorean() ? "먼저 종이에 손글씨를 써주세요." : "Write something on the paper first.";
      return;
    }

    if (nextMode === "listen" && holes.length === 0) {
      $("hint").textContent =
      isKorean() ? "직접 점을 누르거나 자동 펀칭으로 구멍을 뚫어주세요." : "Punch holes yourself or use automatic punching first.";
      return;
    }

    stop();
    current = null;
    mode = nextMode;

    if (mode === "punch" && candidates.length === 0) {
      buildCandidates();
    }

    for (const id of ["write", "punch", "listen"]) {
      const active = id === mode;

      $(id).classList.toggle("active", active);
      $(id).setAttribute("aria-pressed", String(active));
    }

    $("auto").hidden = mode !== "punch";
    $("skip").hidden = mode !== "punch";
    $("punch-tools").hidden = mode !== "punch";
    $("autoplay").hidden = mode !== "listen";
    $("save-archive").hidden = mode !== "listen" || Boolean(archivePlayback);
    $("open-archive").hidden = mode !== "listen" || !lastArchivedId;

    if (mode === "listen") {
      $("save-archive").textContent = isKorean() ? "아카이브에 저장하기 +" : "Save to archive +";
      $("open-archive").textContent = isKorean() ? "아카이브에서 보기 ↗" : "View in archive ↗";
    }

    document.body.dataset.mode = mode;

    $("crank").disabled = mode !== "listen";
    $("rewind").disabled = mode !== "listen";

    $("crank-label").textContent = mode === "listen"
      ? (isKorean() ? "시계 방향으로 돌려보세요 ↻" : "Turn clockwise ↻")
      : (isKorean() ? "종이를 완성하면 연주할 수 있어요" : "Finish the paper to play it.");

    const copy = isKorean() ? {
      write: [
        "01 / WRITE",
        "종이에 글씨를 써주세요",
        "가로 위치는 시간, 세로 위치는 음높이로 변환됩니다.",
      ],
      punch: [
        "02 / PUNCH",
        "글씨를 펀칭 위치로 변환합니다.",
        "점을 직접 누르거나 자동 펀칭을 사용하세요.",
      ],
      listen: [
        "03 / PLAY",
        "이제, 손끝으로 음악을 움직여보세요.",
        "손잡이로 연주하거나 같은 페이지를 자동 반복하세요.",
      ],
    } : {
      write: ["01 / WRITE", "Start by leaving your handwriting.", "Horizontal position becomes time; vertical position becomes pitch."],
      punch: ["02 / PUNCH", "Punch the places where sound will happen.", "Select dots yourself, or punch every hole automatically."],
      listen: ["03 / PLAY", "Now move the music with your hand.", "Turn the crank, or loop the same page automatically."],
    };
    const stageCopy = copy[mode];

    [
      "stage-label",
      "stage-title",
      "stage-description",
    ].forEach((id, index) => {
      $(id).textContent = stageCopy[index];
    });

    const hints = isKorean() ? {
      write: "글씨를 움직여 쓰면 종이 위 마찰음이 납니다.",
      punch: "점을 직접 누르거나 자동 펀칭·스킵을 선택하세요.",
      listen:
        "손잡이를 돌리거나 자동재생을 누르세요. 같은 종이가 반복됩니다.",
    } : {
      write: "Move the pen to hear the texture of writing on paper.",
      punch: "Select dots yourself, or choose automatic punch or skip.",
      listen: "Turn the crank or press autoplay. The same page will repeat.",
    };

    $("hint").textContent = hints[mode];

    rewind();
    stop();
  }

  /* ------------------------------
     손글씨 → 펀칭 위치
  ------------------------------ */

  function buildCandidates() {
    const used = new Set();
    candidates = [];

    function add(point) {
      const x = Math.max(
        24,
        Math.min(
          PAGE_WIDTH - 24,
          Math.round(point.x / 24) * 24
        )
      );

      const y = Math.max(
        35,
        Math.min(
          PAGE_HEIGHT - 35,
          Math.round(point.y / 35) * 35
        )
      );

      const key = `${x},${y}`;

      if (!used.has(key)) {
        used.add(key);
        candidates.push({ x, y });
      }
    }

    for (const stroke of strokes) {
      add(stroke.points[0]);

      for (let i = 1; i < stroke.points.length; i++) {
        const start = stroke.points[i - 1];
        const end = stroke.points[i];

        const distance = Math.hypot(
          end.x - start.x,
          end.y - start.y
        );

        const steps = Math.max(
          1,
          Math.ceil(distance / 8)
        );

        for (let j = 1; j <= steps; j++) {
          add({
            x: start.x + ((end.x - start.x) * j) / steps,
            y: start.y + ((end.y - start.y) * j) / steps,
          });
        }
      }
    }

    candidates.sort((a, b) => a.x - b.x || a.y - b.y);
  }

  /* ------------------------------
     글쓰기 / 직접 펀칭
  ------------------------------ */

  function pointerPoint(event) {
    const bounds = canvas.getBoundingClientRect();

    return {
      x:
        ((event.clientX - bounds.left) * PAGE_WIDTH) /
        bounds.width,
      y:
        ((event.clientY - bounds.top) * PAGE_HEIGHT) /
        bounds.height,
    };
  }

  function punch(point) {
    let nearest = null;
    let distance = 25;

    for (const candidate of candidates) {
      if (holes.includes(candidate)) continue;

      const nextDistance = Math.hypot(
        candidate.x - point.x,
        candidate.y - point.y
      );

      if (nextDistance < distance) {
        nearest = candidate;
        distance = nextDistance;
      }
    }

    if (nearest) {
      prepareHole(nearest, holes.length);
      holes.push(nearest);
      punchSound(nearest, holes.length);
      draw();
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (mode === "listen") return;

    event.preventDefault();
    audioReady();

    canvas.setPointerCapture(event.pointerId);

    const point = pointerPoint(event);

    if (mode === "write") {
      candidates = [];
      holes = [];

      current = {
        ink,
        width: Number($("width").value),
        points: [point],
      };

      strokes.push(current);
      draw();
    } else {
      if (punching) stop();

      current = true;

      // 펀칭 동작 자체는 오디오 성공 여부와 관계없이 수행
      punch(point);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!current) return;

    const point = pointerPoint(event);

    if (mode === "write") {
      const last = current.points[current.points.length - 1];

      const distance = Math.hypot(
        point.x - last.x,
        point.y - last.y
      );

      current.points.push(point);

      if (distance > 0.3) {
        writingSound(distance);
      }

      draw();
    } else if (mode === "punch") {
      punch(point);
    }
  });

  for (const eventName of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ]) {
    canvas.addEventListener(eventName, () => {
      current = null;
      silencePencil();
    });
  }

  /* ------------------------------
     색상 / 굵기 / 되돌리기
  ------------------------------ */

  document.querySelectorAll(".swatch").forEach((button) => {
    button.onclick = () => {
      if (mode !== "write") return;

      ink = button.dataset.color;
      $("color").value = ink;

      document.querySelectorAll(".swatch").forEach((swatch) => {
        const selected = swatch === button;

        swatch.classList.toggle("selected", selected);
        swatch.setAttribute(
          "aria-pressed",
          String(selected)
        );
      });
    };
  });

  function selectPunchOption(selector, button) {
    document.querySelectorAll(selector).forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle("selected", selected);
      choice.setAttribute("aria-pressed", String(selected));
    });
    draw();
  }

  document.querySelectorAll("[data-punch-shape]").forEach((button) => {
    button.onclick = () => {
      punchShape = button.dataset.punchShape;
      selectPunchOption("[data-punch-shape]", button);
      $("hint").textContent = punchShape === "mix"
        ? (isKorean() ? "원·별·하트·다이아를 섞어 펀칭합니다." : "Circle, star, heart, and diamond punches will be mixed.")
        : (isKorean() ? "선택한 모양으로 펀칭합니다." : "Punching with the selected shape.");
    };
  });

  document.querySelectorAll("[data-punch-size]").forEach((button) => {
    button.onclick = () => {
      punchSize = button.dataset.punchSize;
      selectPunchOption("[data-punch-size]", button);
      $("hint").textContent = punchSize === "mix"
        ? (isKorean() ? "작은 구멍부터 큰 구멍까지 자연스럽게 섞습니다." : "Punch sizes will vary naturally.")
        : (isKorean() ? "선택한 크기로 펀칭합니다." : "Punching with the selected size.");
    };
  });

  $("color").oninput = (event) => {
    if (mode !== "write") return;

    ink = event.target.value;

    document.querySelectorAll(".swatch").forEach((swatch) => {
      swatch.classList.remove("selected");
      swatch.setAttribute("aria-pressed", "false");
    });
  };

  $("undo").onclick = () => {
    if (mode === "listen") return;

    stop();
    current = null;

    if (mode === "write") {
      strokes.pop();
      holes = [];
      candidates = [];
    } else {
      holes.pop();
    }

    draw();
  };

  $("clear").onclick = () => {
    stop();

    current = null;
    strokes = [];
    holes = [];
    candidates = [];

    setMode("write");
    rewind();
    draw();

    $("hint").textContent =
      "새 종이를 준비했어요. 자유롭게 써보세요.";
  };

  /* ------------------------------
     소리 설정
  ------------------------------ */

  $("test").onclick = async () => {
    sound = true;

    $("sound").textContent = "음소거";
    $("sound").setAttribute("aria-pressed", "false");

    if (await audioReady()) {
      updateMasterVolume();
      note(210);

      $("hint").textContent =
        "확인음을 재생했습니다. 안 들리면 컴퓨터 음량과 브라우저 탭 음소거를 확인해 주세요.";
    }
  };

  $("sound").onclick = async () => {
    sound = !sound;

    if (!sound) {
      silencePencil();
    }

    $("sound").textContent = sound ? "음소거" : "소리 켜기";

    $("sound").setAttribute(
      "aria-pressed",
      String(!sound)
    );

    updateMasterVolume();

    if (sound && (await audioReady())) {
      updateMasterVolume();
      note(210);
    }
  };

  $("volume").oninput = updateMasterVolume;

  $("tone").onchange = async (event) => {
    toneName = event.target.value;

    if (await audioReady()) {
      reverbMix.gain.setTargetAtTime(
        toneProfiles[toneName].reverb,
        audio.currentTime,
        0.08
      );
      note(210);
    }

    $("hint").textContent =
      `${toneProfiles[toneName].label} 음색으로 바꿨어요.`;
  };

  /* ------------------------------
     자동 펀칭 / 즉시 완성
  ------------------------------ */

  $("auto").onclick = async () => {
    if (mode !== "punch") return;

    if (punching) {
      stop();
      return;
    }

    punching = true;
    const token = ++punchToken;

    await audioReady();

    if (
      !punching ||
      mode !== "punch" ||
      token !== punchToken
    ) {
      return;
    }

    $("auto").textContent = "자동 펀칭 멈추기 □";

    const remaining = candidates.filter(
      (point) => !holes.includes(point)
    );

    let index = 0;

    function tick() {
      if (
        !punching ||
        mode !== "punch" ||
        token !== punchToken
      ) {
        return;
      }

      if (index >= remaining.length) {
        stop();

        $("hint").textContent =
          "모든 구멍을 뚫었어요. 이제 이 종이로 연주해 보세요.";

        return;
      }

      const hole = remaining[index++];

      if (!holes.includes(hole)) {
        prepareHole(hole, holes.length);
        holes.push(hole);
        punchSound(hole, holes.length);
        draw();
      }

      autoTimer = setTimeout(tick, 65);
    }

    tick();
  };

  $("skip").onclick = () => {
    if (mode !== "punch") return;

    stop();
    holes = candidates.map((point, index) => prepareHole(point, index));

    setMode("listen");

    $("hint").textContent =
      "펀칭을 즉시 완료했어요. 손잡이를 돌리거나 자동재생을 눌러주세요.";
  };

  /* ------------------------------
     손잡이 / 종이 이동 / 반복
  ------------------------------ */

  function turn(delta) {
    if (mode !== "listen" || delta <= 0) return;

    let travel =
      (delta * PAGE_WIDTH) / PAGE_ROTATION;

    angle += delta;

    while (travel > 0) {
      if (progress >= PAGE_WIDTH) {
        progress = 0;
        activeHarmonyStep = -1;
      }

      const oldProgress = progress;

      const step = Math.min(
        travel,
        PAGE_WIDTH - progress
      );

      progress += step;
      travel -= step;

      for (const hole of holes) {
        if (
          hole.x > oldProgress &&
          hole.x <= progress
        ) {
          const strength = Math.min(
            1.15,
            Math.max(0.58, delta * 10)
          );
          playHoleNote(hole, strength);
        }
      }
    }

    $("crank").style.setProperty(
      "--angle",
      `${angle}rad`
    );

    draw(progress);

    $("position").textContent =
      `${Math.round(progress / 12)}% · 같은 페이지 반복`;
  }

  const crank = $("crank");

  function pointerAngle(event) {
    const bounds = crank.getBoundingClientRect();

    return Math.atan2(
      event.clientY - bounds.top - bounds.height / 2,
      event.clientX - bounds.left - bounds.width / 2
    );
  }

  crank.onpointerdown = (event) => {
    if (mode !== "listen") return;

    if (looping) stop();

    audioReady();

    crank.setPointerCapture(event.pointerId);
    previousAngle = pointerAngle(event);
  };

  crank.onpointermove = (event) => {
    if (previousAngle === null) return;

    const nextAngle = pointerAngle(event);
    let delta = nextAngle - previousAngle;

    if (delta > Math.PI) {
      delta -= Math.PI * 2;
    }

    if (delta < -Math.PI) {
      delta += Math.PI * 2;
    }

    previousAngle = nextAngle;

    // 시계 방향 회전만 종이 진행에 반영
    turn(Math.max(0, delta));
  };

  for (const eventName of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ]) {
    crank.addEventListener(eventName, () => {
      previousAngle = null;
    });
  }

  crank.onkeydown = async (event) => {
    const supportedKeys = [
      "ArrowRight",
      "ArrowUp",
      " ",
    ];

    if (!supportedKeys.includes(event.key)) return;

    event.preventDefault();

    if (looping) stop();

    await audioReady();

    if (mode === "listen") {
      turn(Math.PI / 12);
    }
  };

  function rewind() {
    progress = 0;
    angle = 0;
    previousAngle = null;
    activeHarmonyStep = -1;

    crank.style.setProperty("--angle", "0rad");

    $("position").textContent = "0% · 종이의 시작";

    draw(mode === "listen" ? 0 : undefined);
  }

  $("rewind").onclick = () => {
    stop();
    rewind();
  };

  /* ------------------------------
     자동재생: 같은 한 페이지 반복
  ------------------------------ */

  $("autoplay").onclick = async () => {
    if (looping) {
      stop();
      return;
    }

    if (mode !== "listen" || holes.length === 0) {
      return;
    }

    looping = true;
    const token = ++loopToken;

    $("autoplay").textContent = "재생 정지 □";
    $("autoplay").setAttribute("aria-pressed", "true");

    const ready = await audioReady();

    if (
      token !== loopToken ||
      !looping ||
      mode !== "listen"
    ) {
      return;
    }

    if (!ready) {
      stop();
      return;
    }

    lastFrame = performance.now();

    $("hint").textContent =
      "지금 쓴 한 페이지를 반복해서 연주합니다. 손잡이를 잡으면 직접 연주로 전환돼요.";

    function tick(now) {
      if (
        !looping ||
        mode !== "listen" ||
        token !== loopToken
      ) {
        return;
      }

      const elapsed = Math.min(
        100,
        Math.max(0, now - lastFrame)
      );

      lastFrame = now;

      const rotation =
        (elapsed / PAGE_DURATION) * PAGE_ROTATION;

      turn(rotation);

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
  };

  /* ------------------------------
     아카이브 저장
  ------------------------------ */

  function requestArchiveName(onSave) {
    const copy = isKorean()
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

  function saveArchive(title) {
    if (holes.length === 0) return;

    const key = "orgo-archive";
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    const id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    saved.unshift({
      id,
      kind: "MOUSE",
      createdAt: new Date().toISOString(),
      title,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      tone: toneName,
      volume: Number($("volume").value),
      notes: holes.map(({ x, y, shape, size }) => ({
        x,
        y,
        shape: PUNCH_SHAPES.includes(shape) ? shape : "circle",
        size: Math.max(0.72, Math.min(1.35, Number(size) || 1)),
      })),
      strokes: strokes.map((stroke) => {
        const points = stroke.points || [];
        const interval = Math.max(1, Math.ceil(points.length / 240));

        return {
          ink: stroke.ink,
          width: stroke.width,
          points: points
            .filter((_, index) => index % interval === 0 || index === points.length - 1)
            .map(({ x, y }) => ({ x, y })),
        };
      }),
    });

    localStorage.setItem(key, JSON.stringify(saved.slice(0, 30)));
    lastArchivedId = id;
    $("hint").textContent = isKorean()
      ? "아카이브에 저장했어요. 바로 아카이브에서 다시 확인할 수 있습니다."
      : "Saved to your archive. You can open it right away.";
    $("save-archive").textContent = isKorean() ? "저장됨 ✓" : "Saved ✓";
    $("open-archive").hidden = false;
  }

  $("save-archive").onclick = () => {
    if (holes.length === 0) return;
    requestArchiveName(saveArchive);
  };

  $("open-archive").onclick = () => {
    const query = lastArchivedId ? `?new=${encodeURIComponent(lastArchivedId)}` : "";
    window.location.href = `archive.html${query}`;
  };

  /* ------------------------------
     단계 버튼
  ------------------------------ */

  for (const id of ["write", "punch", "listen"]) {
    $(id).onclick = () => setMode(id);
  }

  $("next").onclick = () => {
    audioReady();

    if (mode === "write") {
      setMode("punch");
    } else if (mode === "punch") {
      setMode("listen");
    } else {
      stop();
      rewind();
    }
  };

  document.addEventListener("orgo-languagechange", () => {
    const activeMode = mode;
    mode = "";
    setMode(activeMode);

    if (archivePlayback) {
      updateArchivePlaybackCopy();
    }
  });

  /* ------------------------------
     아카이브의 곡을 실제 오르골로 불러오기
  ------------------------------ */

  function archivePoint(point, sourceWidth, sourceHeight) {
    const x = Number(point?.x);
    const y = Number(point?.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
      x: Math.max(0, Math.min(PAGE_WIDTH, (x / sourceWidth) * PAGE_WIDTH)),
      y: Math.max(0, Math.min(PAGE_HEIGHT, (y / sourceHeight) * PAGE_HEIGHT)),
      shape: PUNCH_SHAPES.includes(point.shape) ? point.shape : "circle",
      size: Math.max(0.72, Math.min(1.35, Number(point.size) || 1)),
    };
  }

  function updateArchivePlaybackCopy() {
    if (!archivePlayback) return;

    const fallback = isKorean() ? "제목 없음" : "Untitled melody";
    const title = archivePlayback.title?.trim() || fallback;
    const prefix = isKorean() ? "ARCHIVE / 연주 중" : "ARCHIVE / PLAYING";

    $("stage-label").textContent = prefix;
    $("stage-title").textContent = title;
    $("stage-description").textContent = isKorean()
      ? "손잡이를 돌려 저장한 곡을 재생하세요."
      : "Turn the crank to hear this saved paper in its original tone.";
    $("hint").textContent = isKorean()
      ? "아카이브에서 불러온 곡입니다. 손잡이를 시계 방향으로 돌리세요."
      : "This melody came from your archive. Turn the crank clockwise to play it.";
    document.title = `${title} — ORGO`;
  }

  function loadArchivePlayback() {
    const archiveId = new URLSearchParams(window.location.search).get("archive");
    if (!archiveId) return;

    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("orgo-archive") || "[]");
    } catch {
      return;
    }

    archivePlayback = Array.isArray(saved)
      ? saved.find((item) => item?.id === archiveId)
      : null;

    if (!archivePlayback) return;

    const sourceWidth = Number(archivePlayback.width) > 0
      ? Number(archivePlayback.width)
      : PAGE_WIDTH;
    const sourceHeight = Number(archivePlayback.height) > 0
      ? Number(archivePlayback.height)
      : PAGE_HEIGHT;

    holes = (Array.isArray(archivePlayback.notes) ? archivePlayback.notes : [])
      .map((point) => archivePoint(point, sourceWidth, sourceHeight))
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);

    strokes = (Array.isArray(archivePlayback.strokes) ? archivePlayback.strokes : [])
      .map((stroke) => {
        const points = (Array.isArray(stroke?.points) ? stroke.points : [])
          .map((point) => archivePoint(point, sourceWidth, sourceHeight))
          .filter(Boolean);

        if (!points.length) return null;

        return {
          ink: stroke.ink || "#222222",
          width: Math.max(1, Math.min(12, Number(stroke.width) || 3)),
          points,
        };
      })
      .filter(Boolean);

    candidates = [...holes];

    if (toneProfiles[archivePlayback.tone]) {
      toneName = archivePlayback.tone;
      $("tone").value = toneName;
    }

    if (Number.isFinite(Number(archivePlayback.volume))) {
      $("volume").value = Math.max(0, Math.min(100, Number(archivePlayback.volume)));
    }

    mode = "";
    setMode("listen");
    updateArchivePlaybackCopy();

    requestAnimationFrame(() => {
      $("mechanism").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // 다른 탭으로 이동하면 자동 동작 정지
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      current = null;
      previousAngle = null;
      stop();
    }
  });

  draw();
  loadArchivePlayback();
})();

/* --------------------------------
   Compose quick guide (every visit)
--------------------------------- */
(() => {
  const dialog = document.getElementById("compose-tutorial");
  const title = document.getElementById("tutorial-title");
  const headingCopy = dialog?.querySelector(".tutorial-heading p");
  const next = document.getElementById("tutorial-next");
  const skip = document.getElementById("tutorial-skip");
  const closeButton = document.getElementById("tutorial-close");
  const openButton = document.getElementById("open-tutorial");
  const svg = dialog?.querySelector(".tutorial-lines");
  const ringLayer = dialog?.querySelector(".tutorial-focus-rings");
  const callouts = [...(dialog?.querySelectorAll(".tutorial-callout") || [])];
  let frame = 0;

  if (!dialog || !title || !next || !skip || !closeButton || !svg || !ringLayer) return;

  const isKorean = () => document.documentElement.lang === "ko";
  const translations = {
    ko: {
      title: "화면을 따라 천천히 시작해 보세요.",
      heading: "화살표가 가리키는 순서대로 사용하면 됩니다.",
      skip: "안내 건너뛰기",
      start: "바로 시작하기",
      close: "튜토리얼 닫기",
      guide: "GUIDE ?",
      callouts: [
        ["먼저 음색을 선택하세요", "오르골 음색과 음량을 미리 확인할 수 있습니다."],
        ["쓰기 · 펀칭 · 연주", "세 단계가 왼쪽에서 오른쪽으로 이어집니다."],
        ["종이에 글씨를 써주세요", "가로는 시간, 세로는 음높이로 변환됩니다."],
        ["완성 후 손잡이를 돌리세요", "손잡이를 돌리는 속도에 맞춰 곡이 재생됩니다."],
      ],
    },
    en: {
      title: "Follow the screen to begin.",
      heading: "Use the controls in the order shown by the arrows.",
      skip: "Skip guide",
      start: "Start composing",
      close: "Close tutorial",
      guide: "GUIDE ?",
      callouts: [
        ["Choose a sound first", "Preview the music-box tone and set its volume."],
        ["Write · Punch · Play", "The three stages move from left to right."],
        ["Write directly on this paper", "Horizontal position is time; vertical position is pitch."],
        ["Turn the crank when finished", "The melody follows the speed of your hand."],
      ],
    },
  };

  function renderText() {
    const copy = translations[isKorean() ? "ko" : "en"];
    title.textContent = copy.title;
    headingCopy.textContent = copy.heading;
    skip.textContent = copy.skip;
    next.innerHTML = `${copy.start} <span aria-hidden="true">→</span>`;
    closeButton.setAttribute("aria-label", copy.close);
    if (openButton) openButton.textContent = copy.guide;
    callouts.forEach((callout, index) => {
      const [heading, body] = copy.callouts[index];
      callout.querySelector("strong").textContent = heading;
      callout.querySelector("p").textContent = body;
    });
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function placeGuide() {
    if (dialog.hidden) return;

    const narrow = window.innerWidth < 720;
    const margin = narrow ? 14 : 24;
    ringLayer.replaceChildren();
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    marker.id = "tutorial-arrow";
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    arrow.setAttribute("d", "M 1 1 L 9 5 L 1 9");
    arrow.setAttribute("fill", "none");
    arrow.setAttribute("stroke", "#f4f4ee");
    arrow.setAttribute("stroke-width", "1.5");
    marker.append(arrow);
    defs.append(marker);
    svg.append(defs);

    callouts.forEach((callout, index) => {
      const target = document.querySelector(callout.dataset.target);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const ring = document.createElement("span");
      ring.className = "tutorial-focus-ring";
      ring.style.left = `${clamp(rect.left - 5, 6, window.innerWidth - 12)}px`;
      ring.style.top = `${clamp(rect.top - 5, 6, window.innerHeight - 12)}px`;
      ring.style.width = `${Math.min(rect.width + 10, window.innerWidth - 12)}px`;
      ring.style.height = `${Math.min(rect.height + 10, window.innerHeight - 12)}px`;
      ringLayer.append(ring);

      let left;
      let top;
      const placement = callout.dataset.placement;
      if (narrow) {
        left = index % 2 ? window.innerWidth - 194 : 14;
        top = 96 + index * 112;
      } else if (placement === "above") {
        left = rect.left + rect.width * .18;
        top = rect.top - 88;
      } else if (placement === "below") {
        left = rect.left + rect.width * .24;
        top = rect.bottom + 18;
      } else if (placement === "inside-left") {
        left = rect.left + 28;
        top = rect.top + rect.height * .38;
      } else {
        left = rect.right - 224;
        top = rect.top + rect.height * .52;
      }

      left = clamp(left, margin, window.innerWidth - callout.offsetWidth - margin);
      top = clamp(top, 92, window.innerHeight - callout.offsetHeight - 84);
      callout.style.left = `${left}px`;
      callout.style.top = `${top}px`;

      const label = callout.getBoundingClientRect();
      const startX = label.left + label.width / 2;
      const startY = label.top + label.height / 2;
      const targetX = clamp(rect.left + rect.width / 2, 10, window.innerWidth - 10);
      const targetY = clamp(rect.top + rect.height / 2, 10, window.innerHeight - 10);
      const bendY = startY + (targetY - startY) * .58;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${startX} ${startY} Q ${startX} ${bendY}, ${targetX} ${targetY}`);
      svg.append(path);
    });
  }

  function scheduleGuide() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(placeGuide);
  }

  function close() {
    dialog.hidden = true;
    document.body.classList.remove("tutorial-is-open");
    document.getElementById("sheet")?.focus({ preventScroll: true });
  }

  function open() {
    renderText();
    dialog.hidden = false;
    document.body.classList.add("tutorial-is-open");
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      placeGuide();
      closeButton.focus({ preventScroll: true });
    });
  }

  next.addEventListener("click", () => close());
  skip.addEventListener("click", () => close());
  closeButton.addEventListener("click", () => close());
  openButton?.addEventListener("click", open);
  window.addEventListener("resize", scheduleGuide, { passive: true });
  window.addEventListener("scroll", scheduleGuide, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) close();
  });

  document.addEventListener("orgo-languagechange", () => {
    renderText();
    if (!dialog.hidden) scheduleGuide();
  });

  open();
})();
