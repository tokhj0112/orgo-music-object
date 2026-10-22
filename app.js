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
  let backingName = "none";
  // 아카이브에서 불러온 곡은 새 곡처럼 다시 저장하지 않고,
  // 이 페이지를 오르골 플레이어로 사용합니다.
  let archivePlayback = null;
  let lastArchivedId = null;
  let reverbMix = null;
  let backingBus = null;
  let guitarBus = null;
  let bassBus = null;
  let beatBus = null;
  let backingNoiseBuffer = null;
  let activeBackingBeat = -1;

  // 한 페이지를 16박으로 나누고, 각 4박 구간의 손글씨 음을 분석해
  // 통기타와 베이스가 실제 멜로디에 어울리는 코드를 고릅니다.
  const BACKING_STEPS = 16;
  const harmonyChoices = [
    { name: "Cadd9", root: 65.41, tones: [0, 2, 4, 7], frequencies: [130.81, 164.81, 196, 293.66] },
    { name: "Am7", root: 55, tones: [9, 0, 4, 7], frequencies: [110, 130.81, 164.81, 196] },
    { name: "Fmaj7", root: 43.65, tones: [5, 9, 0, 4], frequencies: [87.31, 130.81, 164.81, 220] },
    { name: "Gsus2", root: 49, tones: [7, 9, 2], frequencies: [98, 146.83, 196, 220] },
    { name: "Dm7", root: 73.42, tones: [2, 5, 9, 0], frequencies: [146.83, 174.61, 220, 261.63] },
    { name: "Em7", root: 82.41, tones: [4, 7, 11, 2], frequencies: [164.81, 196, 246.94, 293.66] },
  ];
  const fallbackHarmony = [0, 1, 2, 3];

  // 멜로디 음색과 같은 방향으로 반주도 밝기와 어택을 바꿉니다.
  // 반주가 별개의 트랙처럼 튀지 않고 어떤 손글씨에서도 한 악기군처럼 들리게 합니다.
  const backingCharacters = {
    bright: {
      guitarBrightness: 0.69,
      guitarCutoff: 5000,
      guitarLevel: 0.96,
      bassAttack: 1080,
      bassLevel: 0.92,
      percussionTone: 4200,
      percussionLevel: 0.9,
    },
    warm: {
      guitarBrightness: 0.57,
      guitarCutoff: 4250,
      guitarLevel: 1,
      bassAttack: 890,
      bassLevel: 1,
      percussionTone: 3400,
      percussionLevel: 0.82,
    },
    soft: {
      guitarBrightness: 0.45,
      guitarCutoff: 3350,
      guitarLevel: 0.92,
      bassAttack: 720,
      bassLevel: 0.9,
      percussionTone: 2750,
      percussionLevel: 0.68,
    },
  };

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

  function saturationCurve(amount = 1.8) {
    const curve = new Float32Array(2048);
    const normalizer = Math.tanh(amount);
    for (let index = 0; index < curve.length; index++) {
      const x = (index / (curve.length - 1)) * 2 - 1;
      curve[index] = Math.tanh(x * amount) / normalizer;
    }
    return curve;
  }

  function acousticBodyImpulse(context) {
    const duration = 0.42;
    const buffer = context.createBuffer(
      2,
      Math.floor(context.sampleRate * duration),
      context.sampleRate
    );
    const modes = [
      [108, 0.34, 11],
      [196, 0.24, 14],
      [284, 0.16, 17],
      [422, 0.11, 20],
      [760, 0.07, 25],
      [1180, 0.04, 31],
    ];

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index++) {
        const time = index / context.sampleRate;
        let sample = (Math.random() * 2 - 1) * 0.018 * Math.exp(-time * 24);
        modes.forEach(([frequency, gain, decay], modeIndex) => {
          const detune = channel === 0 ? 1 : 1 + (modeIndex + 1) * 0.0007;
          sample += Math.sin(Math.PI * 2 * frequency * detune * time) * gain * Math.exp(-time * decay);
        });
        data[index] = sample * 0.42;
      }
    }

    return buffer;
  }

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

        backingBus = audio.createGain();
        backingBus.gain.value = 0.96;
        backingBus.connect(master);

        guitarBus = audio.createGain();
        const guitarHighpass = audio.createBiquadFilter();
        const guitarWood = audio.createBiquadFilter();
        const guitarBody = audio.createBiquadFilter();
        const guitarPresence = audio.createBiquadFilter();
        const guitarAir = audio.createBiquadFilter();
        const guitarBodySpace = audio.createConvolver();
        const guitarDry = audio.createGain();
        const guitarWet = audio.createGain();
        const guitarCompressor = audio.createDynamicsCompressor();
        guitarBus.gain.value = 1;
        guitarHighpass.type = "highpass";
        guitarHighpass.frequency.value = 72;
        guitarWood.type = "peaking";
        guitarWood.frequency.value = 112;
        guitarWood.Q.value = 0.7;
        guitarWood.gain.value = 2.4;
        guitarBody.type = "peaking";
        guitarBody.frequency.value = 218;
        guitarBody.Q.value = 0.82;
        guitarBody.gain.value = 4;
        guitarPresence.type = "peaking";
        guitarPresence.frequency.value = 2850;
        guitarPresence.Q.value = 0.75;
        guitarPresence.gain.value = -1.35;
        guitarAir.type = "lowpass";
        guitarAir.frequency.value = 5250;
        guitarAir.Q.value = 0.42;
        guitarBodySpace.buffer = acousticBodyImpulse(audio);
        guitarDry.gain.value = 0.78;
        guitarWet.gain.value = 0.34;
        guitarCompressor.threshold.value = -25;
        guitarCompressor.knee.value = 14;
        guitarCompressor.ratio.value = 3.2;
        guitarCompressor.attack.value = 0.006;
        guitarCompressor.release.value = 0.2;
        guitarBus
          .connect(guitarHighpass)
          .connect(guitarWood)
          .connect(guitarBody)
          .connect(guitarPresence)
          .connect(guitarAir);
        guitarAir.connect(guitarDry).connect(guitarCompressor);
        guitarAir.connect(guitarBodySpace).connect(guitarWet).connect(guitarCompressor);
        guitarCompressor.connect(backingBus);

        bassBus = audio.createGain();
        const bassHighpass = audio.createBiquadFilter();
        const bassWeight = audio.createBiquadFilter();
        const bassSaturation = audio.createWaveShaper();
        const bassCompressor = audio.createDynamicsCompressor();
        bassBus.gain.value = 1.04;
        bassHighpass.type = "highpass";
        bassHighpass.frequency.value = 31;
        bassWeight.type = "lowshelf";
        bassWeight.frequency.value = 116;
        bassWeight.gain.value = 4.6;
        bassSaturation.curve = saturationCurve(1.3);
        bassSaturation.oversample = "4x";
        bassCompressor.threshold.value = -29;
        bassCompressor.knee.value = 18;
        bassCompressor.ratio.value = 4.2;
        bassCompressor.attack.value = 0.012;
        bassCompressor.release.value = 0.24;
        bassBus
          .connect(bassHighpass)
          .connect(bassWeight)
          .connect(bassSaturation)
          .connect(bassCompressor)
          .connect(backingBus);

        beatBus = audio.createGain();
        beatBus.gain.value = 0.92;
        beatBus.connect(backingBus);

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
      playHoleNote(point, 0.24);
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

  function note(y, strength = 0.82) {
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

  function playHoleNote(point, strength = 0.82) {
    if (!sound || !audioOK) return;

    const { shape, size } = normalizedHole(point);

    if (shape === "circle") {
      note(point.y, strength * (0.9 + size * 0.1));
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

  }

  function backingNoise() {
    if (backingNoiseBuffer) return backingNoiseBuffer;

    backingNoiseBuffer = audio.createBuffer(
      1,
      Math.floor(audio.sampleRate * 0.36),
      audio.sampleRate
    );

    const data = backingNoiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) {
      data[index] = Math.random() * 2 - 1;
    }

    return backingNoiseBuffer;
  }

  function pitchClassForHole(hole) {
    const frequency = pitchForY(hole.y);
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    return ((midi % 12) + 12) % 12;
  }

  function harmonyForSection(sectionIndex) {
    const sectionStart = (sectionIndex / 4) * PAGE_WIDTH;
    const sectionEnd = ((sectionIndex + 1) / 4) * PAGE_WIDTH;
    const melodyTones = holes
      .filter((hole) => hole.x >= sectionStart && hole.x < sectionEnd)
      .map(pitchClassForHole);
    const fallbackIndex = fallbackHarmony[sectionIndex] ?? 0;

    if (!melodyTones.length) return harmonyChoices[fallbackIndex];

    return harmonyChoices.reduce((best, choice, choiceIndex) => {
      const score = melodyTones.reduce((total, pitchClass) => {
        if (choice.tones.includes(pitchClass)) return total + 3;
        const nearest = Math.min(...choice.tones.map((tone) => {
          const distance = Math.abs(tone - pitchClass);
          return Math.min(distance, 12 - distance);
        }));
        return total + (nearest === 1 ? 0.25 : -1.1);
      }, choiceIndex === fallbackIndex ? 0.45 : 0);

      return !best || score > best.score ? { choice, score } : best;
    }, null).choice;
  }

  function pluckedStringBuffer(frequency, duration = 1.25, brightness = 0.78) {
    const length = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(audio.sampleRate / frequency));
    const damping = 0.992 + brightness * 0.0043;
    let previousNoise = 0;

    for (let index = 0; index < period && index < data.length; index++) {
      const pickPosition = Math.sin((Math.PI * (index + 1)) / (period + 1));
      const rawNoise = Math.random() * 2 - 1;
      // 흰 노이즈를 그대로 쓰면 일렉 기타처럼 날카로워집니다.
      // 앞 샘플과 섞어 나일론/브론즈 현을 손가락으로 튕긴 듯한 둥근 어택을 만듭니다.
      previousNoise = previousNoise * (0.54 - brightness * 0.16) + rawNoise * (0.46 + brightness * 0.16);
      data[index] = previousNoise * (0.58 + pickPosition * 0.42);
    }

    for (let index = period; index < data.length; index++) {
      const first = data[index - period];
      const second = data[index - period + 1] || first;
      const bridgeLoss = index % period === 0 ? 0.997 : 1;
      data[index] = (first + second) * 0.5 * damping * bridgeLoss;
    }

    return buffer;
  }

  function playGuitarBacking(beatIndex, harmony, mix = 1, noteDensity = 0) {
    const beatInChord = beatIndex % 4;
    const time = audio.currentTime;
    const character = backingCharacters[toneName] || backingCharacters.warm;
    const accent = [1, 0.5, 0.74, 0.42][beatInChord];
    const voicing = [...harmony.frequencies];
    const topRoot = harmony.root * 4;
    if (!voicing.some((frequency) => Math.abs(frequency - topRoot) < 2)) {
      voicing.push(topRoot);
    }

    // 글씨가 많은 구간에는 가장 약한 업스트로크를 비워 멜로디가 숨 쉴 자리를 만듭니다.
    if (noteDensity >= 6 && beatInChord === 3) return;

    const downstroke = beatInChord % 2 === 0;
    let chord = downstroke ? voicing : [...voicing].reverse();
    if (!downstroke) chord = chord.slice(0, noteDensity >= 4 ? 2 : 3);
    else if (beatInChord === 2 && noteDensity >= 5) chord = chord.slice(0, 3);

    chord.forEach((frequency, index) => {
      const humanDelay = Math.random() * 0.004;
      const start = time + index * (downstroke ? 0.021 : 0.014) + humanDelay;
      const source = audio.createBufferSource();
      const envelope = audio.createGain();
      const pickTone = audio.createBiquadFilter();
      const panner = audio.createStereoPanner ? audio.createStereoPanner() : null;
      const brightness = character.guitarBrightness + (beatInChord === 0 ? 0.06 : -0.035);
      const duration = beatInChord === 0 ? 1.34 : 0.96;
      const velocityHumanize = 0.94 + Math.random() * 0.1;

      source.buffer = pluckedStringBuffer(frequency, duration, brightness);
      source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.0016;
      pickTone.type = "lowpass";
      pickTone.frequency.value = character.guitarCutoff * (beatInChord === 0 ? 1.06 : 0.9);
      pickTone.Q.value = 0.28;
      if (panner) panner.pan.value = (index - (chord.length - 1) / 2) * 0.095;

      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(
        0.071 * accent * mix * character.guitarLevel * velocityHumanize * (1 - index * 0.04),
        start + 0.008
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      source.connect(envelope).connect(pickTone);
      if (panner) pickTone.connect(panner).connect(guitarBus);
      else pickTone.connect(guitarBus);
      source.start(start);
      source.stop(start + duration + 0.03);
      source.onended = () => {
        source.disconnect();
        envelope.disconnect();
        pickTone.disconnect();
        if (panner) panner.disconnect();
      };
    });
  }

  function playBassBacking(beatIndex, harmony, mix = 1, noteDensity = 0) {
    const beatInChord = beatIndex % 4;
    const time = audio.currentTime;
    const character = backingCharacters[toneName] || backingCharacters.warm;
    const ratios = [1, 2, 1.5, 2];
    const accents = [0.205, 0.085, 0.145, 0.07];
    const frequency = harmony.root * ratios[beatInChord];
    const tone = audio.createBiquadFilter();
    const envelope = audio.createGain();
    const panner = audio.createStereoPanner ? audio.createStereoPanner() : null;

    // 촘촘한 멜로디에서는 네 번째 워킹 음을 생략해 저음이 문장을 덮지 않게 합니다.
    if (noteDensity >= 7 && beatInChord === 3) return;

    tone.type = "lowpass";
    tone.frequency.setValueAtTime(character.bassAttack, time);
    tone.frequency.exponentialRampToValueAtTime(325, time + 0.42);
    tone.Q.value = 0.82;
    if (panner) panner.pan.value = beatInChord % 2 === 0 ? -0.025 : 0.025;

    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(
      accents[beatInChord] * mix * character.bassLevel,
      time + 0.012
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.76);

    // 현의 짧은 어택과 둥근 바디를 겹쳐 신스 베이스 대신 어쿠스틱 베이스에 가깝게 만듭니다.
    const string = audio.createBufferSource();
    const stringGain = audio.createGain();
    string.buffer = pluckedStringBuffer(frequency, 0.94, 0.3);
    stringGain.gain.value = 0.52;
    string.connect(stringGain).connect(envelope);

    const body = audio.createOscillator();
    const bodyGain = audio.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(frequency * 1.035, time);
    body.frequency.exponentialRampToValueAtTime(frequency, time + 0.045);
    bodyGain.gain.value = 0.78;
    body.connect(bodyGain).connect(envelope);

    const wood = audio.createOscillator();
    const woodGain = audio.createGain();
    wood.type = "triangle";
    wood.frequency.value = frequency;
    wood.detune.value = -2;
    woodGain.gain.value = 0.14;
    wood.connect(woodGain).connect(envelope);

    envelope.connect(tone);
    if (panner) tone.connect(panner).connect(bassBus);
    else tone.connect(bassBus);

    string.start(time);
    string.stop(time + 0.96);
    body.start(time);
    body.stop(time + 0.8);
    wood.start(time);
    wood.stop(time + 0.8);
    body.onended = () => {
      string.disconnect();
      stringGain.disconnect();
      body.disconnect();
      bodyGain.disconnect();
      wood.disconnect();
      woodGain.disconnect();
      envelope.disconnect();
      tone.disconnect();
      if (panner) panner.disconnect();
    };
  }

  function playBeatBacking(beatIndex, mix = 1, noteDensity = 0) {
    const time = audio.currentTime;
    const beatInChord = beatIndex % 4;
    const character = backingCharacters[toneName] || backingCharacters.warm;

    // 빽빽한 구간에서는 오프비트 하이햇을 비워 타악기가 글씨 리듬과 경쟁하지 않게 합니다.
    if (noteDensity < 6 || beatInChord % 2 === 0) {
      const hat = audio.createBufferSource();
      const hatFilter = audio.createBiquadFilter();
      const hatEnvelope = audio.createGain();
      hat.buffer = backingNoise();
      hatFilter.type = "bandpass";
      hatFilter.frequency.value = character.percussionTone;
      hatFilter.Q.value = 0.78;
      hatEnvelope.gain.setValueAtTime(
        (beatInChord % 2 === 0 ? 0.04 : 0.024) * mix * character.percussionLevel,
        time
      );
      hatEnvelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      hat.connect(hatFilter).connect(hatEnvelope).connect(beatBus);
      hat.start(time);
      hat.stop(time + 0.1);
      hat.onended = () => {
        hat.disconnect();
        hatFilter.disconnect();
        hatEnvelope.disconnect();
      };
    }

    if (beatInChord === 0 || beatInChord === 2) {
      const kick = audio.createOscillator();
      const kickEnvelope = audio.createGain();
      kick.type = "sine";
      kick.frequency.setValueAtTime(92, time);
      kick.frequency.exponentialRampToValueAtTime(48, time + 0.18);
      kickEnvelope.gain.setValueAtTime(
        (beatInChord === 0 ? 0.255 : 0.19) * mix * character.percussionLevel,
        time
      );
      kickEnvelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.36);
      kick.connect(kickEnvelope).connect(beatBus);
      kick.start(time);
      kick.stop(time + 0.38);
      kick.onended = () => {
        kick.disconnect();
        kickEnvelope.disconnect();
      };
    }

    if (beatInChord === 1 || beatInChord === 3) {
      const snare = audio.createBufferSource();
      const snareFilter = audio.createBiquadFilter();
      const snareEnvelope = audio.createGain();
      snare.buffer = backingNoise();
      snareFilter.type = "bandpass";
      snareFilter.frequency.value = character.percussionTone * 0.43;
      snareFilter.Q.value = 0.68;
      snareEnvelope.gain.setValueAtTime(
        (beatInChord === 1 ? 0.105 : 0.08) * mix * character.percussionLevel,
        time
      );
      snareEnvelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.21);
      snare.connect(snareFilter).connect(snareEnvelope).connect(beatBus);
      snare.start(time);
      snare.stop(time + 0.23);
      snare.onended = () => {
        snare.disconnect();
        snareFilter.disconnect();
        snareEnvelope.disconnect();
      };
    }
  }

  function playBackingBeat(beatIndex) {
    if (
      backingName === "none" ||
      !sound ||
      !audioOK ||
      !backingBus
    ) return;

    const sectionIndex = Math.min(3, Math.floor(beatIndex / 4));
    const harmony = harmonyForSection(sectionIndex);

    const beatStart = (beatIndex / BACKING_STEPS) * PAGE_WIDTH;
    const beatEnd = ((beatIndex + 1) / BACKING_STEPS) * PAGE_WIDTH;
    const noteDensity = holes.reduce(
      (count, hole) => count + (hole.x >= beatStart && hole.x < beatEnd ? 1 : 0),
      0
    );
    // 음표가 빽빽한 구간에서는 반주를 살짝 낮추고,
    // 비어 있는 구간에서는 반주가 리듬을 채우도록 자동 조절합니다.
    const mix = Math.max(0.78, Math.min(1.12, 1.12 - noteDensity * 0.052));

    if (backingName === "guitar") playGuitarBacking(beatIndex, harmony, mix, noteDensity);
    else if (backingName === "bass") playBassBacking(beatIndex, harmony, mix, noteDensity);
    else if (backingName === "beat") playBeatBacking(beatIndex, mix, noteDensity);
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

    $("autoplay").textContent = isKorean() ? "자동재생 · 한 페이지 반복" : "Autoplay · repeat page";

    $("autoplay").setAttribute("aria-pressed", "false");

    $("auto").textContent = isKorean() ? "자동으로 모두 뚫기" : "Punch all automatically";

    $("next").textContent = isKorean()
      ? (mode === "listen" ? "다시 연주하기" : mode === "punch" ? "이 종이로 연주하기" : "다 썼어요 · 펀칭하기")
      : (mode === "listen" ? "Play again" : mode === "punch" ? "Play this page" : "Finished writing · punch it");

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
      $("open-archive").textContent = isKorean() ? "아카이브에서 보기" : "View in archive";
    }

    document.body.dataset.mode = mode;

    $("crank").disabled = mode !== "listen";
    $("rewind").disabled = mode !== "listen";

    $("crank-label").textContent = mode === "listen"
      ? (isKorean() ? "시계 방향으로 돌려보세요" : "Turn clockwise")
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
     손글씨와 펀칭 위치 연결
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

  $("backing").onchange = async (event) => {
    const nextBacking = event.target.value;
    backingName = ["none", "guitar", "bass", "beat"].includes(nextBacking)
      ? nextBacking
      : "none";
    activeBackingBeat = -1;

    const labels = isKorean()
      ? {
        none: "반주 없이 멜로디만 재생합니다.",
        guitar: "통기타의 나무 울림을 추가했어요. 손글씨 음정에 맞는 코드를 고르고 빽빽한 구간은 가볍게 연주합니다.",
        bass: "둥근 어쿠스틱 베이스를 추가했어요. 손글씨 멜로디의 코드와 밀도에 맞춰 저음을 연주합니다.",
        beat: "부드러운 킥·스네어 리듬을 추가했어요. 손글씨가 많은 구간에서는 하이햇을 비워줍니다.",
      }
      : {
        none: "The melody will play without backing.",
        guitar: "Acoustic strums now choose chords from your handwritten melody.",
        bass: "Rounded acoustic bass follows the chord roots and density of your melody.",
        beat: "Soft kick and snare leave out hi-hat notes under denser handwriting.",
      };

    $("hint").textContent = labels[backingName];

    if (backingName !== "none" && (await audioReady())) {
      playBackingBeat(0);
    }
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
        activeBackingBeat = -1;
      }

      const oldProgress = progress;

      const step = Math.min(
        travel,
        PAGE_WIDTH - progress
      );

      progress += step;
      travel -= step;

      const backingBeat = Math.min(
        BACKING_STEPS - 1,
        Math.floor((progress / PAGE_WIDTH) * BACKING_STEPS)
      );

      if (backingBeat !== activeBackingBeat) {
        activeBackingBeat = backingBeat;
        playBackingBeat(backingBeat);
      }

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
    activeBackingBeat = -1;

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
      backing: backingName,
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

    if (["none", "guitar", "bass", "beat"].includes(archivePlayback.backing)) {
      backingName = archivePlayback.backing;
      $("backing").value = backingName;
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
  const callout = document.getElementById("tutorial-callout");
  const stepLabel = document.getElementById("tutorial-step-label");
  const calloutTitle = document.getElementById("tutorial-callout-title");
  const calloutCopy = document.getElementById("tutorial-callout-copy");
  const progress = [...(dialog?.querySelectorAll(".tutorial-progress i") || [])];
  const previous = document.getElementById("tutorial-prev");
  const next = document.getElementById("tutorial-next");
  const skip = document.getElementById("tutorial-skip");
  const closeButton = document.getElementById("tutorial-close");
  const openButton = document.getElementById("open-tutorial");
  const ringLayer = dialog?.querySelector(".tutorial-focus-rings");
  let frame = 0;
  let currentStep = 0;

  if (
    !dialog || !title || !headingCopy || !callout || !stepLabel || !calloutTitle ||
    !calloutCopy || !previous || !next || !skip || !closeButton || !ringLayer
  ) return;

  const isKorean = () => document.documentElement.lang === "ko";
  const steps = [
    { target: ".camera-mode-link", placement: "below" },
    { target: ".sound-dock", placement: "below" },
    { target: ".steps", placement: "below" },
    { target: ".paper", placement: "inside-left" },
    { target: "#crank", placement: "left" },
    { target: ".actionbar", placement: "above" },
  ];
  const translations = {
    ko: {
      title: "이 화면에서 곡을 만드는 순서",
      heading: "한 단계씩 핵심 기능을 확인해 보세요.",
      previous: "이전 단계",
      next: "다음 단계",
      skip: "안내 건너뛰기",
      start: "바로 시작하기",
      close: "튜토리얼 닫기",
      guide: "사용 안내",
      steps: [
        ["01 / INPUT", "마우스 또는 카메라를 선택하세요", "현재 작업대에서는 마우스로, 카메라 모드에서는 손끝 움직임으로 그릴 수 있습니다."],
        ["02 / SOUND", "음색과 배경 반주를 선택하세요", "통기타·베이스·비트가 손글씨의 음정과 밀도를 읽고 밝기와 연주량을 자동으로 맞춥니다."],
        ["03 / FLOW", "쓰기 · 펀칭 · 연주 순서입니다", "현재 단계가 밝게 표시되며, 완료하면 다음 작업으로 자연스럽게 이어집니다."],
        ["04 / WRITE + PUNCH", "글씨가 음의 위치가 됩니다", "가로는 시간, 세로는 음높이입니다. 펀칭 단계에서는 원·별·하트와 크기를 선택할 수 있습니다."],
        ["05 / PLAY", "손잡이를 돌려 직접 재생하세요", "종이와 멜로디, 선택한 반주가 손잡이를 돌리는 속도에 맞춰 함께 움직입니다."],
        ["06 / SAVE", "완성한 곡은 저장할 수 있습니다", "하단 작업 버튼에서 자동 재생을 확인하고 아카이브에 곡을 저장하세요."],
      ],
    },
    en: {
      title: "How to build a melody here",
      heading: "Check the essential controls one step at a time.",
      previous: "Previous step",
      next: "Next step",
      skip: "Skip guide",
      start: "Start composing",
      close: "Close tutorial",
      guide: "GUIDE",
      steps: [
        ["01 / INPUT", "Choose mouse or camera input", "Write with the mouse here, or use fingertip movement in camera mode."],
        ["02 / SOUND", "Choose a tone and backing", "Guitar, bass, and beat adapt their harmony, brightness, and activity to your handwriting."],
        ["03 / FLOW", "Write · Punch · Play", "The active stage is highlighted and each completed task leads to the next."],
        ["04 / WRITE + PUNCH", "Your writing becomes note positions", "Horizontal position is time and vertical position is pitch. In Punch, choose circles, stars, hearts, and their size."],
        ["05 / PLAY", "Turn the crank to play", "The paper, melody, and selected backing move at the speed of your hand."],
        ["06 / SAVE", "Save the finished melody", "Use the bottom controls to preview the loop and save it to your archive."],
      ],
    },
  };

  function renderText() {
    const copy = translations[isKorean() ? "ko" : "en"];
    const [label, heading, body] = copy.steps[currentStep];
    title.textContent = copy.title;
    headingCopy.textContent = copy.heading;
    stepLabel.textContent = label;
    calloutTitle.textContent = heading;
    calloutCopy.textContent = body;
    previous.textContent = copy.previous;
    previous.hidden = currentStep === 0;
    skip.textContent = copy.skip;
    next.textContent = currentStep === steps.length - 1 ? copy.start : copy.next;
    closeButton.setAttribute("aria-label", copy.close);
    if (openButton) openButton.textContent = copy.guide;
    progress.forEach((marker, index) => {
      marker.classList.toggle("is-active", index === currentStep);
      marker.classList.toggle("is-complete", index < currentStep);
    });
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function placeGuide() {
    if (dialog.hidden) return;

    const narrow = window.innerWidth < 720;
    const margin = narrow ? 14 : 24;
    ringLayer.replaceChildren();
    const step = steps[currentStep];
    const target = document.querySelector(step.target);
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
    if (narrow) {
      left = margin;
      top = window.innerHeight - callout.offsetHeight - 78;
    } else if (step.placement === "above") {
      left = rect.left + rect.width / 2 - callout.offsetWidth / 2;
      top = rect.top - callout.offsetHeight - 18;
    } else if (step.placement === "inside-left") {
      left = rect.left + 24;
      top = rect.top + 24;
    } else if (step.placement === "left") {
      left = rect.left - callout.offsetWidth - 22;
      top = rect.top + rect.height / 2 - callout.offsetHeight / 2;
    } else {
      left = rect.left + rect.width / 2 - callout.offsetWidth / 2;
      top = rect.bottom + 18;
    }

    left = clamp(left, margin, window.innerWidth - callout.offsetWidth - margin);
    top = clamp(top, 94, window.innerHeight - callout.offsetHeight - 76);
    callout.style.left = `${left}px`;
    callout.style.top = `${top}px`;
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

  function showStep(index) {
    currentStep = clamp(index, 0, steps.length - 1);
    renderText();
    const target = document.querySelector(steps[currentStep].target);
    if (target) {
      const rect = target.getBoundingClientRect();
      if (getComputedStyle(target).position !== "fixed" && (rect.top < 88 || rect.bottom > window.innerHeight - 82)) {
        target.scrollIntoView({ behavior: "instant", block: "center" });
      }
    }
    requestAnimationFrame(scheduleGuide);
  }

  function open() {
    currentStep = 0;
    dialog.hidden = false;
    document.body.classList.add("tutorial-is-open");
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      showStep(0);
      closeButton.focus({ preventScroll: true });
    });
  }

  previous.addEventListener("click", () => showStep(currentStep - 1));
  next.addEventListener("click", () => {
    if (currentStep === steps.length - 1) {
      close();
      document.querySelector(".paper")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      showStep(currentStep + 1);
    }
  });
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
