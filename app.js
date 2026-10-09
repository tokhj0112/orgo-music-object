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
      for (const point of candidates) {
        if (holes.includes(point)) continue;

        ctx.beginPath();
        ctx.arc(point.x, point.y, HOLE_RADIUS, 0, Math.PI * 2);

        ctx.fillStyle = "#eeece5";
        ctx.fill();

        ctx.strokeStyle = "#8c887e";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 완성된 펀칭 구멍
    for (const point of holes) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, HOLE_RADIUS, 0, Math.PI * 2);

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

        feedCtx.beginPath();
        feedCtx.arc(x, y, 3, 0, Math.PI * 2);
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
    $("autoplay").hidden = mode !== "listen";
    $("save-archive").hidden = mode !== "listen" || Boolean(archivePlayback);

    if (mode === "listen") {
      $("save-archive").textContent = isKorean() ? "아카이브에 저장하기 +" : "Save to archive +";
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
        "먼저, 당신의 글씨를 남겨주세요.",
        "가로 위치는 시간, 세로 위치는 음의 높이가 됩니다.",
      ],
      punch: [
        "02 / PUNCH",
        "글씨를 따라, 소리가 날 자리를 뚫어요.",
        "빈 점을 직접 누르거나 자동으로 모두 뚫어보세요.",
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
    holes = [...candidates];

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
          note(hole.y, strength, hole.x);
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

  $("save-archive").onclick = () => {
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
      title: "이름 없는 선율",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      tone: toneName,
      volume: Number($("volume").value),
      notes: holes.map(({ x, y }) => ({ x, y })),
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
    $("hint").textContent = "아카이브에 저장했어요. ARCHIVE에서 다시 확인할 수 있습니다.";
    $("save-archive").textContent = "저장됨 ✓";
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
    };
  }

  function updateArchivePlaybackCopy() {
    if (!archivePlayback) return;

    const fallback = isKorean() ? "이름 없는 선율" : "Untitled melody";
    const title = archivePlayback.title?.trim() || fallback;
    const prefix = isKorean() ? "ARCHIVE / 연주 중" : "ARCHIVE / PLAYING";

    $("stage-label").textContent = prefix;
    $("stage-title").textContent = title;
    $("stage-description").textContent = isKorean()
      ? "저장된 종이를 손잡이로 돌려, 만든 음색 그대로 들어보세요."
      : "Turn the crank to hear this saved paper in its original tone.";
    $("hint").textContent = isKorean()
      ? "아카이브에서 불러온 선율입니다. 손잡이를 시계 방향으로 돌려 연주해 보세요."
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
