(() => {
  "use strict";

  const t = (key) => window.orgoI18n?.text(key) || key;

  /* ------------------------------
     스크롤 등장 효과
     펀칭 종이에는 적용하지 않습니다.
  ------------------------------ */

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const reveals = document.querySelectorAll(".reveal");

  if (
    !reduceMotion.matches &&
    "IntersectionObserver" in window
  ) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          entry.target.classList.remove("is-pending");
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.12,
      }
    );

    for (const element of reveals) {
      element.classList.add("is-pending");
      observer.observe(element);
    }
  }

  /* ------------------------------
     메인 — 완성된 오르골에서 분해도까지
  ------------------------------ */

  const scrollProduct = document.querySelector("[data-scroll-product]");

  if (scrollProduct && !reduceMotion.matches) {
    let ticking = false;

    const updateScrollProduct = () => {
      const bounds = scrollProduct.getBoundingClientRect();
      const travel = Math.max(1, scrollProduct.offsetHeight - window.innerHeight);
      const raw = Math.min(1, Math.max(0, -bounds.top / travel));
      const progress = Math.min(1, raw / 0.72);
      const eased = progress * progress * (3 - 2 * progress);

      scrollProduct.style.setProperty("--explode", eased.toFixed(3));
      scrollProduct.style.setProperty(
        "--story-fade",
        Math.max(0, (progress - 0.42) / 0.58).toFixed(3)
      );
      scrollProduct.classList.toggle("is-exploding", progress > 0.02);
      ticking = false;
    };

    const requestScrollUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateScrollProduct);
    };

    updateScrollProduct();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);
  }

  /* ------------------------------
     Main — mechanical sound becomes an electronic signal
  ------------------------------ */

  const signalBridge = document.querySelector("[data-signal-bridge]");

  if (signalBridge && !reduceMotion.matches) {
    let bridgeCurrent = 0;
    let bridgeTarget = 0;
    let bridgeFrame = 0;

    const smoothstep = (start, end, value) => {
      const amount = Math.min(1, Math.max(0, (value - start) / (end - start)));
      return amount * amount * (3 - 2 * amount);
    };

    const readBridgeProgress = () => {
      const bounds = signalBridge.getBoundingClientRect();
      const travel = Math.max(1, signalBridge.offsetHeight - window.innerHeight);
      return Math.min(1, Math.max(0, -bounds.top / travel));
    };

    const renderSignalBridge = (raw) => {
      const motion = smoothstep(0.02, 0.78, raw);
      const wave = smoothstep(0.1, 0.76, raw);
      const recorder = smoothstep(0.25, 0.78, raw);
      const exit = smoothstep(0.88, 1, raw);

      signalBridge.style.setProperty("--bridge-progress", motion.toFixed(3));
      signalBridge.style.setProperty("--bridge-wave", wave.toFixed(3));
      signalBridge.style.setProperty("--bridge-recorder", recorder.toFixed(3));
      signalBridge.style.setProperty("--bridge-exit", exit.toFixed(3));
    };

    const animateSignalBridge = () => {
      bridgeCurrent += (bridgeTarget - bridgeCurrent) * 0.11;
      if (Math.abs(bridgeTarget - bridgeCurrent) < 0.0007) bridgeCurrent = bridgeTarget;
      renderSignalBridge(bridgeCurrent);

      if (bridgeCurrent !== bridgeTarget) {
        bridgeFrame = window.requestAnimationFrame(animateSignalBridge);
      } else {
        bridgeFrame = 0;
      }
    };

    const requestBridgeUpdate = () => {
      bridgeTarget = readBridgeProgress();
      if (!bridgeFrame) bridgeFrame = window.requestAnimationFrame(animateSignalBridge);
    };

    bridgeTarget = readBridgeProgress();
    bridgeCurrent = bridgeTarget;
    renderSignalBridge(bridgeCurrent);
    window.addEventListener("scroll", requestBridgeUpdate, { passive: true });
    window.addEventListener("resize", requestBridgeUpdate);
  }

  if (signalBridge) {
    const recorderToggle = signalBridge.querySelector("[data-recorder-toggle]");
    const recorderStatus = signalBridge.querySelector("[data-recorder-status]");
    const bridgeStage = signalBridge.querySelector(".signal-bridge-stage");

    recorderToggle?.addEventListener("click", () => {
      const isRecording = !recorderToggle.classList.contains("is-recording");
      recorderToggle.classList.toggle("is-recording", isRecording);
      recorderToggle.setAttribute("aria-pressed", String(isRecording));
      recorderToggle.setAttribute(
        "aria-label",
        t(isRecording ? "bridgeRecorderStop" : "bridgeRecorderStart")
      );
      recorderToggle.dataset.i18nAttr = isRecording
        ? "bridgeRecorderStop"
        : "bridgeRecorderStart";
      bridgeStage?.classList.toggle("is-capturing", isRecording);

      if (recorderStatus) {
        recorderStatus.dataset.i18n = isRecording
          ? "bridgeRecorderActive"
          : "bridgeRecorderIdle";
        recorderStatus.textContent = t(
          isRecording ? "bridgeRecorderActive" : "bridgeRecorderIdle"
        );
      }
    });
  }

  /* ------------------------------
     Main — electronic sound lab
  ------------------------------ */

  const soundLab = document.querySelector("[data-sound-lab]");

  if (soundLab) {
    const pad = soundLab.querySelector("[data-synth-pad]");
    const voiceButtons = [...soundLab.querySelectorAll("[data-wave]")];
    const stepButtons = [...soundLab.querySelectorAll(".lab-steps button")];
    const playButton = soundLab.querySelector("[data-lab-play]");
    const bpmInput = soundLab.querySelector("[data-lab-bpm]");
    const bpmOutput = soundLab.querySelector("[data-lab-bpm-output]");
    const labStatus = soundLab.querySelector("[data-lab-status]");
    const bassStage = soundLab.querySelector("[data-bass-stage]");
    const bassStringControls = [...soundLab.querySelectorAll("[data-bass-string]")];
    const drumStage = soundLab.querySelector("[data-drum-stage]");
    const drumPads = [...soundLab.querySelectorAll("[data-drum-part]")];
    const drumPieces = new Map(
      [...soundLab.querySelectorAll("[data-drum-piece]")]
        .map((piece) => [piece.dataset.drumPiece, piece])
    );
    const drumCursor = soundLab.querySelector(".drum-stick-cursor");

    let audioContext = null;
    let masterGain = null;
    let delayNode = null;
    let delayFeedback = null;
    let delayWet = null;
    let waveform = "sine";
    let padVoice = null;
    let loopTimer = null;
    let loopStep = 0;
    let pointerPlaying = false;
    let bassPulseTimer = null;
    let drumNoiseBuffer = null;
    let drumCursorTimer = null;
    const drumPieceTimers = new Map();
    const bassStringAnimations = new Map();

    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29];
    const sequence = [0, 3, 5, 7, 10, 7, 5, 3];
    const drumSequence = ["kick", "hihat", "snare", "hihat", "kick", "tom1", "snare", "crash"];

    function ensureAudio() {
      if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioContext = new AudioContext();

        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = .004;
        compressor.release.value = .25;

        masterGain = audioContext.createGain();
        masterGain.gain.value = .48;
        masterGain.connect(compressor);
        compressor.connect(audioContext.destination);

        delayNode = audioContext.createDelay(.8);
        delayNode.delayTime.value = .24;
        delayFeedback = audioContext.createGain();
        delayFeedback.gain.value = .26;
        delayWet = audioContext.createGain();
        delayWet.gain.value = .24;
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayNode.connect(delayWet);
        delayWet.connect(masterGain);
      }

      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    }

    function frequencyFromY(y, offset = 0) {
      const index = Math.round((1 - y) * (scale.length - 1));
      const semitone = scale[Math.max(0, Math.min(scale.length - 1, index))] + offset;
      return 82.41 * Math.pow(2, semitone / 12);
    }

    function connectVoice(filter, gain) {
      filter.connect(gain);
      gain.connect(masterGain);
      gain.connect(delayNode);
    }

    function stopPadVoice() {
      if (!padVoice || !audioContext) return;
      const now = audioContext.currentTime;
      padVoice.gain.gain.cancelScheduledValues(now);
      padVoice.gain.gain.setTargetAtTime(.0001, now, .04);
      padVoice.oscillators.forEach((oscillator) => oscillator.stop(now + .24));
      padVoice = null;
      pointerPlaying = false;
      pad.classList.remove("is-touching");
      labStatus.textContent = t("labReady");
    }

    function startPadVoice(x, y) {
      const context = ensureAudio();
      if (!context) return;
      stopPadVoice();

      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = waveform === "sawtooth" ? 7 : 2.8;

      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.2, now + .035);
      connectVoice(filter, gain);

      const primary = context.createOscillator();
      primary.type = waveform;
      primary.connect(filter);
      primary.start(now);

      const shimmer = context.createOscillator();
      shimmer.type = waveform === "square" ? "square" : "sine";
      const shimmerGain = context.createGain();
      shimmerGain.gain.value = waveform === "sine" ? .19 : .08;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(filter);
      shimmer.start(now);

      padVoice = { oscillators: [primary, shimmer], primary, shimmer, filter, gain };
      pointerPlaying = true;
      pad.classList.add("is-touching");
      updatePadVoice(x, y);
    }

    function updatePadVoice(x, y) {
      pad.style.setProperty("--pad-x", `${(x * 100).toFixed(2)}%`);
      pad.style.setProperty("--pad-y", `${(y * 100).toFixed(2)}%`);
      if (!padVoice || !audioContext) return;

      const now = audioContext.currentTime;
      const frequency = frequencyFromY(y);
      padVoice.primary.frequency.setTargetAtTime(frequency, now, .025);
      padVoice.shimmer.frequency.setTargetAtTime(frequency * 2.005, now, .03);
      padVoice.filter.frequency.setTargetAtTime(320 + x * 5200, now, .045);
      padVoice.filter.Q.setTargetAtTime(1.2 + x * 8.5, now, .05);
      labStatus.textContent = `${waveform.toUpperCase()} / ${Math.round(frequency)} HZ`;
    }

    function pointerPosition(event) {
      const bounds = pad.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
        y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
      };
    }

    function pluck(frequency) {
      const context = ensureAudio();
      if (!context) return;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(waveform === "sawtooth" ? 1450 : 2700, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + .28);
      filter.Q.value = waveform === "square" ? 4 : 2;
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.21, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .34);
      oscillator.connect(filter);
      connectVoice(filter, gain);
      oscillator.start(now);
      oscillator.stop(now + .38);
    }

    function pluckBass(frequency, intensity = .72) {
      const context = ensureAudio();
      if (!context) return;

      const now = context.currentTime;
      const filter = context.createBiquadFilter();
      const body = context.createGain();
      const fundamental = context.createOscillator();
      const sub = context.createOscillator();
      const subGain = context.createGain();
      const brightness = Math.max(.25, Math.min(1, intensity));

      filter.type = "lowpass";
      filter.Q.setValueAtTime(4.4 + brightness * 2.8, now);
      filter.frequency.setValueAtTime(1350 + brightness * 950, now);
      filter.frequency.exponentialRampToValueAtTime(190, now + .62);

      body.gain.setValueAtTime(.0001, now);
      body.gain.exponentialRampToValueAtTime(.19 + brightness * .13, now + .012);
      body.gain.exponentialRampToValueAtTime(.0001, now + 1.45);
      connectVoice(filter, body);

      fundamental.type = "sawtooth";
      fundamental.frequency.setValueAtTime(frequency * 1.018, now);
      fundamental.frequency.exponentialRampToValueAtTime(frequency, now + .075);
      fundamental.connect(filter);

      sub.type = "sine";
      sub.frequency.setValueAtTime(frequency / 2, now);
      subGain.gain.value = .32;
      sub.connect(subGain);
      subGain.connect(filter);

      fundamental.start(now);
      sub.start(now);
      fundamental.stop(now + 1.55);
      sub.stop(now + 1.55);
    }

    function getDrumNoise() {
      const context = ensureAudio();
      if (!context) return null;
      if (drumNoiseBuffer && drumNoiseBuffer.sampleRate === context.sampleRate) return drumNoiseBuffer;
      drumNoiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = drumNoiseBuffer.getChannelData(0);
      let previous = 0;
      for (let index = 0; index < data.length; index += 1) {
        const white = Math.random() * 2 - 1;
        previous = previous * .17 + white * .83;
        data[index] = previous;
      }
      return drumNoiseBuffer;
    }

    function playKick(velocity) {
      const context = ensureAudio();
      if (!context) return;
      const now = context.currentTime;
      const level = Math.max(.35, Math.min(1, velocity));
      const body = context.createOscillator();
      const bodyGain = context.createGain();
      body.type = "sine";
      body.frequency.setValueAtTime(158, now);
      body.frequency.exponentialRampToValueAtTime(46, now + .22);
      bodyGain.gain.setValueAtTime(.0001, now);
      bodyGain.gain.exponentialRampToValueAtTime(.82 * level, now + .004);
      bodyGain.gain.exponentialRampToValueAtTime(.0001, now + .52);
      body.connect(bodyGain);
      bodyGain.connect(masterGain);
      body.start(now);
      body.stop(now + .56);

      const click = context.createBufferSource();
      const clickFilter = context.createBiquadFilter();
      const clickGain = context.createGain();
      click.buffer = getDrumNoise();
      clickFilter.type = "highpass";
      clickFilter.frequency.value = 3200;
      clickGain.gain.setValueAtTime(.08 * level, now);
      clickGain.gain.exponentialRampToValueAtTime(.0001, now + .035);
      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(masterGain);
      click.start(now);
      click.stop(now + .045);
    }

    function playSnare(velocity) {
      const context = ensureAudio();
      if (!context) return;
      const now = context.currentTime;
      const level = Math.max(.35, Math.min(1, velocity));
      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      noise.buffer = getDrumNoise();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 1850;
      noiseFilter.Q.value = .65;
      noiseGain.gain.setValueAtTime(.48 * level, now);
      noiseGain.gain.exponentialRampToValueAtTime(.0001, now + .28);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseGain.connect(delayNode);
      noise.start(now);
      noise.stop(now + .3);

      const tone = context.createOscillator();
      const toneGain = context.createGain();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(196, now);
      tone.frequency.exponentialRampToValueAtTime(132, now + .16);
      toneGain.gain.setValueAtTime(.2 * level, now);
      toneGain.gain.exponentialRampToValueAtTime(.0001, now + .19);
      tone.connect(toneGain);
      toneGain.connect(masterGain);
      tone.start(now);
      tone.stop(now + .22);
    }

    function playTom(frequency, velocity) {
      const context = ensureAudio();
      if (!context) return;
      const now = context.currentTime;
      const level = Math.max(.35, Math.min(1, velocity));
      const body = context.createOscillator();
      const overtone = context.createOscillator();
      const overtoneGain = context.createGain();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      body.type = "sine";
      body.frequency.setValueAtTime(frequency * 1.3, now);
      body.frequency.exponentialRampToValueAtTime(frequency, now + .16);
      overtone.type = "triangle";
      overtone.frequency.setValueAtTime(frequency * 2.17, now);
      overtoneGain.gain.value = .12;
      filter.type = "lowpass";
      filter.frequency.value = 1500;
      filter.Q.value = 2.2;
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.5 * level, now + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .62);
      body.connect(filter);
      overtone.connect(overtoneGain);
      overtoneGain.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      gain.connect(delayNode);
      body.start(now);
      overtone.start(now);
      body.stop(now + .68);
      overtone.stop(now + .68);
    }

    function playMetal(part, velocity) {
      const context = ensureAudio();
      if (!context) return;
      const now = context.currentTime;
      const level = Math.max(.3, Math.min(1, velocity));
      const isHat = part === "hihat";
      const isRide = part === "ride";
      const duration = isHat ? .13 : isRide ? 1.25 : 1.85;
      const noise = context.createBufferSource();
      const highpass = context.createBiquadFilter();
      const bandpass = context.createBiquadFilter();
      const gain = context.createGain();
      noise.buffer = getDrumNoise();
      highpass.type = "highpass";
      highpass.frequency.value = isHat ? 6800 : 3400;
      bandpass.type = "bandpass";
      bandpass.frequency.value = isHat ? 9800 : isRide ? 6100 : 5200;
      bandpass.Q.value = isHat ? .75 : .52;
      gain.gain.setValueAtTime((isHat ? .24 : .2) * level, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      noise.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(masterGain);
      if (!isHat) gain.connect(delayNode);
      noise.start(now);
      noise.stop(now + duration + .04);

      const ratios = isHat ? [1, 1.34, 1.61, 2.05] : [1, 1.26, 1.48, 1.79, 2.13, 2.47];
      const base = isHat ? 510 : isRide ? 390 : 330;
      ratios.forEach((ratio, index) => {
        const oscillator = context.createOscillator();
        const partialGain = context.createGain();
        oscillator.type = index % 2 ? "square" : "triangle";
        oscillator.frequency.value = base * ratio;
        partialGain.gain.setValueAtTime((isHat ? .018 : .014) * level, now);
        partialGain.gain.exponentialRampToValueAtTime(.0001, now + duration * .7);
        oscillator.connect(partialGain);
        partialGain.connect(highpass);
        oscillator.start(now);
        oscillator.stop(now + duration);
      });
    }

    function playHiHatPedal(velocity) {
      const context = ensureAudio();
      if (!context) return;
      const now = context.currentTime;
      const level = Math.max(.35, Math.min(1, velocity));

      [0, .072].forEach((offset, hitIndex) => {
        const start = now + offset;
        const noise = context.createBufferSource();
        const highpass = context.createBiquadFilter();
        const bandpass = context.createBiquadFilter();
        const gain = context.createGain();
        noise.buffer = getDrumNoise();
        highpass.type = "highpass";
        highpass.frequency.value = 7200;
        bandpass.type = "bandpass";
        bandpass.frequency.value = hitIndex ? 9600 : 10400;
        bandpass.Q.value = .9;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime((hitIndex ? .19 : .28) * level, start + .003);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .17);
        noise.connect(highpass);
        highpass.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(masterGain);
        noise.start(start);
        noise.stop(start + .19);

        [3180, 4720].forEach((frequency, partialIndex) => {
          const partial = context.createOscillator();
          const partialGain = context.createGain();
          partial.type = partialIndex ? "triangle" : "square";
          partial.frequency.value = frequency * (hitIndex ? 1.035 : 1);
          partialGain.gain.setValueAtTime(.012 * level, start);
          partialGain.gain.exponentialRampToValueAtTime(.0001, start + .12);
          partial.connect(partialGain);
          partialGain.connect(masterGain);
          partial.start(start);
          partial.stop(start + .14);
        });
      });
    }

    function playDrum(part, velocity = .82) {
      if (part === "hihat-pedal") playHiHatPedal(velocity);
      else if (part === "kick") playKick(velocity);
      else if (part === "snare") playSnare(velocity);
      else if (part === "tom1") playTom(166, velocity);
      else if (part === "tom2") playTom(128, velocity);
      else if (part === "floor") playTom(86, velocity);
      else playMetal(part, velocity);
    }

    function setBassPath(control, bend = 0, bendX = 460) {
      const y = Number(control.dataset.y);
      const path = control.querySelector(".bass-string");
      const startX = 70;
      const endX = 850;
      const pluckX = Math.max(startX + 36, Math.min(endX - 36, bendX));

      if (Math.abs(bend) < .01) {
        path.setAttribute("d", `M${startX} ${y} L${endX} ${y}`);
        return;
      }

      const leftHandle = Math.max(28, (pluckX - startX) * .42);
      const rightHandle = Math.max(28, (endX - pluckX) * .42);
      path.setAttribute(
        "d",
        `M${startX} ${y} C${(startX + leftHandle).toFixed(1)} ${y} ${(pluckX - leftHandle * .34).toFixed(1)} ${(y + bend).toFixed(1)} ${pluckX.toFixed(1)} ${(y + bend).toFixed(1)} C${(pluckX + rightHandle * .34).toFixed(1)} ${(y + bend).toFixed(1)} ${(endX - rightHandle).toFixed(1)} ${y} ${endX} ${y}`
      );
    }

    function setBassVibrationPath(control, amplitude, phase, bendX) {
      const y = Number(control.dataset.y);
      const path = control.querySelector(".bass-string");
      const startX = 70;
      const endX = 850;
      const pointCount = 42;
      const pluckRatio = Math.max(.08, Math.min(.92, (bendX - startX) / (endX - startX)));
      let d = `M${startX} ${y.toFixed(2)}`;

      for (let index = 1; index <= pointCount; index += 1) {
        const ratio = index / pointCount;
        const x = startX + (endX - startX) * ratio;
        const fundamental = .82 * Math.sin(Math.PI * ratio) * Math.cos(phase);
        const second = .13 * Math.sin(Math.PI * 2 * ratio) * Math.cos(phase * 1.93 + .24);
        const third = .05 * Math.sin(Math.PI * 3 * ratio) * Math.cos(phase * 2.81 + .62);
        const pluckFocus = .84 + .16 * Math.exp(-Math.pow((ratio - pluckRatio) / .22, 2));
        const offset = amplitude * pluckFocus * (fundamental + second + third);
        d += ` L${x.toFixed(1)} ${(y + offset).toFixed(2)}`;
      }

      path.setAttribute("d", d);
    }

    function stopBassAnimation(control) {
      const frame = bassStringAnimations.get(control);
      if (frame) window.cancelAnimationFrame(frame);
      bassStringAnimations.delete(control);
    }

    function vibrateBassString(control, bend, bendX) {
      stopBassAnimation(control);
      const startedAt = performance.now();
      const initialBend = Math.max(9, Math.min(34, (Math.abs(bend) || 17) * .62));
      const direction = bend < 0 ? -1 : 1;
      const stringIndex = Number(control.dataset.bassString);
      const angularSpeed = .034 + stringIndex * .0035;

      control.classList.remove("is-grabbed");
      bassStage.classList.add("is-resonating");
      window.clearTimeout(bassPulseTimer);
      bassPulseTimer = window.setTimeout(() => bassStage.classList.remove("is-resonating"), 440);

      const animate = (time) => {
        const elapsed = time - startedAt;
        const amplitude = initialBend * Math.exp(-elapsed / 480) * direction;
        const phase = elapsed * angularSpeed;
        setBassVibrationPath(control, amplitude, phase, bendX);

        if (elapsed < 1700 && Math.abs(amplitude) > .45) {
          bassStringAnimations.set(control, window.requestAnimationFrame(animate));
        } else {
          setBassPath(control);
          bassStringAnimations.delete(control);
        }
      };

      bassStringAnimations.set(control, window.requestAnimationFrame(animate));
    }

    function bassPoint(event) {
      const bounds = bassStage.querySelector(".bass-strings").getBoundingClientRect();
      return {
        x: Math.max(70, Math.min(850, ((event.clientX - bounds.left) / bounds.width) * 1000)),
        y: ((event.clientY - bounds.top) / bounds.height) * 420,
      };
    }

    function readyText() {
      if (waveform === "drum") return t("labDrumReady");
      if (waveform === "sawtooth") return t("labBassReady");
      return t("labReady");
    }

    function strikeDrumPad(drumPad, velocity = .84) {
      if (!drumPad) return;
      const part = drumPad.dataset.drumPart;
      playDrum(part, velocity);
      drumPad.classList.remove("is-hit");
      void drumPad.getBoundingClientRect();
      drumPad.classList.add("is-hit");
      window.setTimeout(() => drumPad.classList.remove("is-hit"), 430);

      const piece = drumPieces.get(part);
      if (piece) {
        window.clearTimeout(drumPieceTimers.get(piece));
        piece.classList.remove("is-hit");
        void piece.getBoundingClientRect();
        piece.classList.add("is-hit");
        const duration = ["crash", "ride"].includes(part) ? 700 : 460;
        const timer = window.setTimeout(() => {
          piece.classList.remove("is-hit");
          drumPieceTimers.delete(piece);
        }, duration);
        drumPieceTimers.set(piece, timer);
      }

      if (drumCursor) {
        drumCursor.classList.remove("is-striking");
        void drumCursor.offsetWidth;
        drumCursor.classList.add("is-striking");
        window.clearTimeout(drumCursorTimer);
        drumCursorTimer = window.setTimeout(() => drumCursor.classList.remove("is-striking"), 210);
      }

      labStatus.textContent = `${drumPad.dataset.drumLabel} / HIT`;
    }

    function stopLoop() {
      if (loopTimer) window.clearInterval(loopTimer);
      loopTimer = null;
      stepButtons.forEach((step) => step.classList.remove("is-current"));
      playButton.classList.remove("is-playing");
      playButton.textContent = t("labStart");
      labStatus.textContent = readyText();
    }

    function tickLoop() {
      stepButtons.forEach((step, index) => step.classList.toggle("is-current", index === loopStep));
      if (stepButtons[loopStep].classList.contains("is-on")) {
        const frequency = 110 * Math.pow(2, sequence[loopStep] / 12);
        if (waveform === "drum") {
          const drumPart = drumSequence[loopStep];
          const drumPad = drumPads.find((item) => item.dataset.drumPart === drumPart);
          strikeDrumPad(drumPad, .65);
        } else if (waveform === "sawtooth") pluckBass(frequency / 2, .48);
        else pluck(frequency);
      }
      loopStep = (loopStep + 1) % stepButtons.length;
    }

    function startLoop() {
      ensureAudio();
      stopLoop();
      loopStep = 0;
      playButton.classList.add("is-playing");
      playButton.textContent = t("labStop");
      labStatus.textContent = t("labPlaying");
      tickLoop();
      const interval = (60000 / Number(bpmInput.value)) / 2;
      loopTimer = window.setInterval(tickLoop, interval);
    }

    voiceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        waveform = button.dataset.wave || "sine";
        const bassMode = waveform === "sawtooth";
        const drumMode = waveform === "drum";
        voiceButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        if (pointerPlaying) stopPadVoice();
        soundLab.classList.toggle("is-bass-mode", bassMode);
        soundLab.classList.toggle("is-drum-mode", drumMode);
        pad.setAttribute(
          "aria-label",
          bassMode
            ? "Pull and release a bass string"
            : drumMode
              ? "Strike the acoustic drum kit"
              : "Drag to play pitch and texture"
        );

        if (bassMode) {
          labStatus.textContent = t("labBassReady");
          pluckBass(55, .42);
        } else if (drumMode) {
          bassStringControls.forEach((control) => {
            stopBassAnimation(control);
            setBassPath(control);
          });
          labStatus.textContent = t("labDrumReady");
          const kick = drumPads.find((item) => item.dataset.drumPart === "kick");
          strikeDrumPad(kick, .52);
        } else {
          bassStringControls.forEach((control) => {
            stopBassAnimation(control);
            setBassPath(control);
          });
          labStatus.textContent = `${button.querySelector("strong").textContent} / READY`;
          pluck(frequencyFromY(.52));
        }
      });
    });

    bassStringControls.forEach((control) => {
      let dragState = null;
      const frequency = Number(control.dataset.frequency);

      control.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        stopBassAnimation(control);
        control.setPointerCapture(event.pointerId);
        const point = bassPoint(event);
        dragState = { pointerId: event.pointerId, bend: 0, x: point.x };
        control.classList.add("is-grabbed");
      });

      control.addEventListener("pointermove", (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const point = bassPoint(event);
        const baseY = Number(control.dataset.y);
        dragState.x = point.x;
        dragState.bend = Math.max(-68, Math.min(68, point.y - baseY));
        setBassPath(control, dragState.bend, dragState.x);
      });

      const releaseString = (event) => {
        if (!dragState || (event.pointerId !== undefined && event.pointerId !== dragState.pointerId)) return;
        event.preventDefault();
        event.stopPropagation();
        const { bend, x } = dragState;
        const strength = Math.max(.28, Math.min(1, Math.abs(bend) / 58));
        dragState = null;
        control.classList.remove("is-grabbed");
        pluckBass(frequency, strength);
        vibrateBassString(control, bend || 17, x);
        labStatus.textContent = `${control.getAttribute("aria-label").toUpperCase()} / ${frequency.toFixed(1)} HZ`;
      };

      ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
        control.addEventListener(eventName, releaseString);
      });

      control.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key) || event.repeat) return;
        event.preventDefault();
        event.stopPropagation();
        stopBassAnimation(control);
        control.classList.add("is-grabbed");
        setBassPath(control, 28, 460);
      });

      control.addEventListener("keyup", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        control.classList.remove("is-grabbed");
        pluckBass(frequency, .68);
        vibrateBassString(control, 28, 460);
        labStatus.textContent = `${control.getAttribute("aria-label").toUpperCase()} / ${frequency.toFixed(1)} HZ`;
      });
    });

    if (drumStage) {
      drumStage.addEventListener("pointerenter", () => drumStage.classList.add("is-pointer-inside"));
      drumStage.addEventListener("pointerleave", () => drumStage.classList.remove("is-pointer-inside"));
      drumStage.addEventListener("pointermove", (event) => {
        const bounds = drumStage.getBoundingClientRect();
        drumStage.style.setProperty("--drum-x", `${event.clientX - bounds.left}px`);
        drumStage.style.setProperty("--drum-y", `${event.clientY - bounds.top}px`);
      });

      drumPads.forEach((drumPad) => {
        drumPad.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const velocity = event.pressure ? .5 + event.pressure * .5 : .82;
          strikeDrumPad(drumPad, velocity);
        });

        drumPad.addEventListener("keydown", (event) => {
          if (!["Enter", " "].includes(event.key) || event.repeat) return;
          event.preventDefault();
          event.stopPropagation();
          strikeDrumPad(drumPad, .82);
        });
      });
    }

    pad.addEventListener("pointerdown", (event) => {
      if (soundLab.classList.contains("is-bass-mode") || soundLab.classList.contains("is-drum-mode")) return;
      event.preventDefault();
      pad.setPointerCapture(event.pointerId);
      const position = pointerPosition(event);
      startPadVoice(position.x, position.y);
    });

    pad.addEventListener("pointermove", (event) => {
      if (soundLab.classList.contains("is-bass-mode") || soundLab.classList.contains("is-drum-mode")) return;
      const position = pointerPosition(event);
      if (pointerPlaying) updatePadVoice(position.x, position.y);
      else {
        pad.style.setProperty("--pad-x", `${(position.x * 100).toFixed(2)}%`);
        pad.style.setProperty("--pad-y", `${(position.y * 100).toFixed(2)}%`);
      }
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
      pad.addEventListener(eventName, stopPadVoice);
    });

    pad.addEventListener("keydown", (event) => {
      if (soundLab.classList.contains("is-bass-mode") || soundLab.classList.contains("is-drum-mode")) return;
      if (!["Enter", " "].includes(event.key) || pointerPlaying) return;
      event.preventDefault();
      startPadVoice(.5, .5);
    });

    pad.addEventListener("keyup", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      stopPadVoice();
    });

    stepButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const active = !button.classList.contains("is-on");
        button.classList.toggle("is-on", active);
        button.setAttribute("aria-pressed", String(active));
        if (active) {
          const index = stepButtons.indexOf(button);
          const frequency = 110 * Math.pow(2, sequence[index] / 12);
          if (waveform === "drum") {
            const drumPart = drumSequence[index];
            strikeDrumPad(drumPads.find((item) => item.dataset.drumPart === drumPart), .68);
          } else if (waveform === "sawtooth") pluckBass(frequency / 2, .5);
          else pluck(frequency);
        }
      });
    });

    playButton.addEventListener("click", () => {
      if (loopTimer) stopLoop();
      else startLoop();
    });

    bpmInput.addEventListener("input", () => {
      bpmOutput.value = String(bpmInput.value).padStart(3, "0");
      if (loopTimer) startLoop();
    });

    document.addEventListener("orgo-languagechange", () => {
      playButton.textContent = loopTimer ? t("labStop") : t("labStart");
      if (!pointerPlaying) {
        labStatus.textContent = loopTimer
          ? t("labPlaying")
          : readyText();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPadVoice();
        stopLoop();
        bassStringControls.forEach((control) => {
          stopBassAnimation(control);
          setBassPath(control);
        });
      }
    });
  }

  /* ------------------------------
     Object 페이지
  ------------------------------ */

  /* ------------------------------
     Archive 페이지
  ------------------------------ */

  const archiveList = document.getElementById("archive-list");

  if (archiveList) {
    const archiveEmpty = document.getElementById("archive-empty");
    const archiveKey = "orgo-archive";
    let archiveScrollHandler = null;

    function readArchive() {
      try {
        const items = JSON.parse(localStorage.getItem(archiveKey) || "[]");
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    }

    function formatDate(value) {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? t("noDate")
        : new Intl.DateTimeFormat(document.documentElement.lang === "ko" ? "ko-KR" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(date);
    }

    function writeArchive(items) {
      localStorage.setItem(archiveKey, JSON.stringify(items));
    }

    function renderHandwritingPreview(preview, item, height) {
      const strokes = Array.isArray(item.strokes) ? item.strokes : [];
      const validStrokes = strokes.filter(
        (stroke) => Array.isArray(stroke.points) && stroke.points.length > 0
      );

      if (!validStrokes.length) return false;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("archive-handwriting");
      svg.setAttribute("viewBox", `0 0 ${item.width || 1200} ${height}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("aria-hidden", "true");

      validStrokes.forEach((stroke) => {
        const points = stroke.points.filter(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
        );
        if (!points.length) return;

        if (points.length === 1) {
          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", points[0].x);
          dot.setAttribute("cy", points[0].y);
          dot.setAttribute("r", Math.max(2.5, (Number(stroke.width) || 3) / 2));
          dot.setAttribute("fill", stroke.ink || "#252720");
          svg.appendChild(dot);
          return;
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const d = points.reduce(
          (result, point, index) =>
            `${result}${index ? " L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
          ""
        );
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", stroke.ink || "#252720");
        path.setAttribute("stroke-width", Math.max(5, Number(stroke.width) || 3));
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
      });

      preview.appendChild(svg);
      return true;
    }

    function paperScoreWeight(item) {
      const notes = Array.isArray(item.notes) ? item.notes : [];
      const sourceWidth = Number(item.width) || 1200;
      const positions = notes.map((note) => Number(note.x)).filter(Number.isFinite);
      const range = positions.length > 1 ? Math.max(...positions) - Math.min(...positions) : 0;
      const coverage = Math.max(.2, Math.min(1, range / sourceWidth));
      return 30 + coverage * 34 + Math.min(14, Math.sqrt(notes.length || 1) * 2.5);
    }

    function renderArchivePaperScore(container, items) {
      container.replaceChildren();
      const weights = items.map(paperScoreWeight);
      const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
      let offset = 0;

      items.forEach((item, itemIndex) => {
        const notes = Array.isArray(item.notes) ? item.notes : [];
        const segment = document.createElement("div");
        segment.className = "archive-score-segment";
        segment.dataset.index = String(itemIndex);
        segment.style.top = `${(offset / totalWeight) * 100}%`;
        segment.style.height = `${(weights[itemIndex] / totalWeight) * 100}%`;
        offset += weights[itemIndex];

        const sourceWidth = Number(item.width) || 1200;
        const sourceHeight = Number(item.height) || 760;
        const displayNotes = notes.length
          ? notes.slice(0, 180)
          : Array.from({ length: 8 }, (_, index) => ({ x: index * 140, y: 340 + (index % 3) * 65 }));

        const noteTimes = displayNotes.map((note) => Number(note.x)).filter(Number.isFinite);
        const startTime = noteTimes.length ? Math.min(...noteTimes) : 0;
        const endTime = noteTimes.length ? Math.max(...noteTimes) : sourceWidth;
        const timeRange = Math.max(1, endTime - startTime);

        displayNotes.forEach((note, noteIndex) => {
          const x = Number(note.x);
          const y = Number(note.y);
          const time = Number.isFinite(x)
            ? Math.max(10, Math.min(90, ((x - startTime) / timeRange) * 80 + 10))
            : 6 + (noteIndex / Math.max(1, displayNotes.length - 1)) * 88;
          const pitch = Number.isFinite(y)
            ? Math.max(10, Math.min(90, 90 - (y / sourceHeight) * 80))
            : 18 + (noteIndex % 5) * 16;
          const hole = document.createElement("i");
          hole.className = "archive-score-hole";
          hole.style.setProperty("--hole-x", `${pitch}%`);
          hole.style.setProperty("--hole-y", `${time}%`);
          hole.style.setProperty("--hole-delay", `${(noteIndex % 32) * 24}ms`);
          segment.appendChild(hole);
        });

        const marker = document.createElement("span");
        marker.className = "archive-score-marker";
        marker.textContent = String(itemIndex + 1).padStart(2, "0");
        segment.appendChild(marker);
        container.appendChild(segment);
      });
    }

    function renderArchive() {
      const items = readArchive();
      if (archiveScrollHandler) window.removeEventListener("scroll", archiveScrollHandler);
      archiveScrollHandler = null;
      archiveList.replaceChildren();
      archiveEmpty.hidden = items.length > 0;
      archiveList.hidden = items.length === 0;

      if (!items.length) return;

      const experience = document.createElement("div");
      experience.className = "archive-scroll-experience";
      const noteTotal = items.reduce((total, item) => total + (Array.isArray(item.notes) ? item.notes.length : 0), 0);
      const paperLength = Math.round(20 + items.reduce((total, item) => total + paperScoreWeight(item), 0));
      // The score is a passing scene: it enters, feeds through the mechanism,
      // then clears before the saved melody list begins.
      experience.style.setProperty(
        "--archive-min-height",
        `${Math.max(1160, 930 + items.length * 205 + Math.min(noteTotal, 480) * .26)}px`
      );

      const stage = document.createElement("div");
      stage.className = "archive-scroll-stage";
      stage.setAttribute("aria-hidden", "true");

      const stageLabel = document.createElement("span");
      stageLabel.className = "archive-stage-label";
      stageLabel.textContent = "ORGO / PAPER SCORE";
      const stageCount = document.createElement("span");
      stageCount.className = "archive-stage-count";
      stageCount.textContent = `01 / ${String(items.length).padStart(2, "0")}`;
      const paper = document.createElement("div");
      paper.className = "archive-paper-feed";
      paper.style.setProperty("--archive-paper-length", `${Math.max(84, paperLength)}vh`);
      const paperHoles = document.createElement("div");
      paperHoles.className = "archive-paper-holes";
      renderArchivePaperScore(paperHoles, items);
      paper.appendChild(paperHoles);
      const boxFrame = document.createElement("div");
      boxFrame.className = "archive-music-box-frame";
      const boxSource = "archive-music-box-mechanism-cutout.png?v=archive-box-3";
      const box = document.createElement("img");
      box.className = "archive-music-box";
      box.src = boxSource;
      box.alt = "ORGO music box mechanism";
      box.addEventListener("error", () => {
        box.src = "image/archive-music-box-mechanism-cutout.png?v=archive-box-3";
      }, { once: true });
      const gear = document.createElement("img");
      gear.className = "archive-music-box-gear";
      gear.src = boxSource;
      gear.alt = "";
      gear.setAttribute("aria-hidden", "true");
      const crank = document.createElement("img");
      crank.className = "archive-music-box-crank";
      crank.src = boxSource;
      crank.alt = "";
      crank.setAttribute("aria-hidden", "true");
      boxFrame.append(box, gear, crank);
      stage.append(stageLabel, stageCount, paper, boxFrame);

      const tracks = document.createElement("div");
      tracks.className = "archive-track-list";
      experience.append(stage, tracks);

      items.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "archive-track";
        card.dataset.index = String(index);

        const preview = document.createElement("div");
        preview.className = "archive-score-preview";
        const height = item.height || 420;
        const hasHandwriting = renderHandwritingPreview(preview, item, height);

        if (!hasHandwriting) {
          preview.classList.add("archive-score-preview--legacy");
          const legacy = document.createElement("span");
          legacy.className = "archive-score-preview-legacy";
          legacy.textContent = "WRITING PREVIEW";
          preview.appendChild(legacy);
        }

        const body = document.createElement("div");
        body.className = "archive-track-main";
        const meta = document.createElement("div");
        meta.className = "archive-track-meta";
        meta.textContent = `${String(index + 1).padStart(2, "0")} / ${item.kind === "HAND" ? "HAND" : "MOUSE"} / ${(item.notes || []).length} NOTES`;

        const title = document.createElement("input");
        title.className = "archive-title-input";
        title.type = "text";
        title.maxLength = 32;
        title.value = item.title || `${t("archiveUntitled")} ${String(items.length - index).padStart(2, "0")}`;
        title.setAttribute("aria-label", t("archiveName"));
        title.addEventListener("change", () => {
          const next = readArchive();
          const found = next.find((saved) => saved.id === item.id);
          if (!found) return;
          found.title = title.value.trim() || t("archiveUntitled");
          title.value = found.title;
          writeArchive(next);
        });
        const details = document.createElement("p");
        details.textContent = item.kind === "HAND" ? "CAMERA COMPOSITION" : "MOUSE COMPOSITION";
        const actions = document.createElement("div");
        actions.className = "archive-track-actions";
        const play = document.createElement("a");
        play.className = "archive-play";
        play.href = `player.html?archive=${encodeURIComponent(item.id)}`;
        play.textContent = t("archiveOpenPlayer");
        const makeObject = document.createElement("a");
        makeObject.className = "archive-make-object";
        makeObject.href = `object.html?melody=${encodeURIComponent(item.id)}`;
        makeObject.textContent = t("archiveMakeObject");
        const remove = document.createElement("button");
        remove.className = "archive-delete";
        remove.type = "button";
        remove.textContent = t("archiveDelete");
        remove.addEventListener("click", () => {
          const next = readArchive().filter((saved) => saved.id !== item.id);
          writeArchive(next);
          renderArchive();
        });

        const date = document.createElement("time");
        date.className = "archive-track-date";
        date.dateTime = item.createdAt || "";
        date.textContent = formatDate(item.createdAt);

        actions.append(play, makeObject, remove);
        body.append(meta, title, details, actions);
        card.append(preview, body, date);
        tracks.appendChild(card);
      });

      archiveList.appendChild(experience);

      const trackNodes = [...tracks.querySelectorAll(".archive-track")];
      const scoreSegments = [...paperHoles.querySelectorAll(".archive-score-segment")];
      const updateScrollMotion = () => {
        const stageBounds = stage.getBoundingClientRect();
        const range = Math.max(1, stage.offsetHeight + window.innerHeight * .42);
        const rawProgress = Math.max(0, Math.min(1, (window.innerHeight * .72 - stageBounds.top) / range));
        const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
        const enter = Math.max(0, Math.min(1, progress / .3));
        const exit = Math.max(0, Math.min(1, (progress - .78) / .22));
        const sceneOpacity = Math.max(0, Math.min(1, enter * 1.12)) * (1 - exit);
        const paperReveal = Math.max(.025, Math.min(1, enter * (1 - exit * .92)));
        experience.style.setProperty("--archive-progress", progress.toFixed(3));
        experience.style.setProperty("--archive-paper-offset", `${(-progress * (78 + items.length * 9)).toFixed(1)}px`);
        experience.style.setProperty("--archive-paper-reveal", paperReveal.toFixed(3));
        experience.style.setProperty("--archive-scene-opacity", sceneOpacity.toFixed(3));
        // The scene leaves with the document itself, so the mechanism travels
        // upward on scroll instead of sliding sideways out of view.
        experience.style.setProperty("--archive-box-x", `${((1 - enter) * 130).toFixed(1)}px`);
        experience.style.setProperty("--archive-box-y", `${((1 - enter) * 68).toFixed(1)}px`);
        experience.style.setProperty("--archive-crank-angle", `${(progress * 135).toFixed(1)}deg`);
        experience.style.setProperty("--archive-orbit-one", `${(-13 + progress * 9).toFixed(1)}deg`);
        experience.style.setProperty("--archive-orbit-two", `${(12 - progress * 8).toFixed(1)}deg`);
        experience.style.setProperty("--archive-box-angle", `${(-.9 + progress * 1.8).toFixed(1)}deg`);
      };
      let scrollTicking = false;
      const onScroll = () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          updateScrollMotion();
          scrollTicking = false;
        });
      };
      updateScrollMotion();
      window.addEventListener("scroll", onScroll, { passive: true });
      archiveScrollHandler = onScroll;

      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            trackNodes.forEach((node) => node.classList.toggle("is-active", node === entry.target));
            const activeIndex = Number(entry.target.dataset.index || 0);
            stageCount.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
            scoreSegments.forEach((segment, index) => segment.classList.toggle("is-current", index === activeIndex));
            stage.classList.remove("is-turning");
            requestAnimationFrame(() => stage.classList.add("is-turning"));
          });
        }, { rootMargin: "-42% 0px -42% 0px", threshold: 0 });
        trackNodes.forEach((node) => observer.observe(node));
      } else {
        trackNodes[0]?.classList.add("is-active");
      }
    }

    renderArchive();
    document.addEventListener("orgo-languagechange", renderArchive);
  }

  const engraving = document.getElementById("engraving");

  if (!engraving) return;

  const engravingPreview = document.getElementById(
    "engraving-preview"
  );

  const engravingCount = document.getElementById(
    "engraving-count"
  );

  const summary = document.getElementById(
    "configuration-summary"
  );

  const saveButton = document.getElementById(
    "save-configuration"
  );

  const status = document.getElementById(
    "configuration-status"
  );

  const objectImage = document.getElementById(
    "object-preview-image"
  );

  const photoInput = document.getElementById("photo-print");
  const photoPreview = document.getElementById("print-preview");
  const photoPreviewImage = document.getElementById(
    "print-preview-image"
  );
  const photoName = document.getElementById("photo-print-name");
  const melodySelect = document.getElementById("melody-select");
  const selectedMelodyCard = document.getElementById("selected-melody-card");
  const selectedMelodyKind = document.getElementById("selected-melody-kind");
  const selectedMelodyTitle = document.getElementById("selected-melody-title");
  const selectedMelodyPreview = document.getElementById("selected-melody-preview");
  const selectedMelodyNotes = document.getElementById("selected-melody-notes");
  const selectedMelodyPlay = document.getElementById("selected-melody-play");
  const melodyEmpty = document.getElementById("object-melody-empty");
  const melodyBadge = document.getElementById("object-melody-badge");
  const melodyBadgeTitle = document.getElementById("object-melody-badge-title");
  const purchaseButton = document.getElementById("purchase-object");
  const orderDialog = document.getElementById("order-dialog");
  const orderDetails = document.getElementById("order-dialog-details");
  const confirmOrder = document.getElementById("confirm-order");
  const archiveKey = "orgo-archive";
  const selectedMelodyKey = "orgo-selected-melody";
  let archiveMelodies = [];
  let selectedMelody = null;

  function selectedValue(name) {
    const selected = document.querySelector(
      `input[name="${name}"]:checked`
    );

    return selected ? selected.value : "";
  }

  function readSavedMelodies() {
    try {
      const items = JSON.parse(localStorage.getItem(archiveKey) || "[]");
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function melodyName(item, index = 0) {
    return item?.title?.trim() || `${t("archiveUntitled")} ${String(index + 1).padStart(2, "0")}`;
  }

  function renderMelodyPreview(item) {
    if (!selectedMelodyPreview) return;
    selectedMelodyPreview.replaceChildren();

    const strokes = Array.isArray(item?.strokes) ? item.strokes : [];
    const validStrokes = strokes.filter(
      (stroke) => Array.isArray(stroke.points) && stroke.points.length > 0
    );

    if (!validStrokes.length) {
      const fallback = document.createElement("span");
      fallback.textContent = "MUSIC BOX STRIP";
      selectedMelodyPreview.appendChild(fallback);
      return;
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${item.width || 1200} ${item.height || 600}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    validStrokes.forEach((stroke) => {
      const points = stroke.points.filter(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
      );
      if (!points.length) return;

      if (points.length === 1) {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", points[0].x);
        dot.setAttribute("cy", points[0].y);
        dot.setAttribute("r", Math.max(3, (Number(stroke.width) || 4) / 2));
        dot.setAttribute("fill", stroke.ink || "#34362f");
        svg.appendChild(dot);
        return;
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = points.reduce(
        (result, point, index) =>
          `${result}${index ? " L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
        ""
      );
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", stroke.ink || "#34362f");
      path.setAttribute("stroke-width", Math.max(5, Number(stroke.width) || 3));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });

    selectedMelodyPreview.appendChild(svg);
  }

  function updateSelectedMelody(id, updateUrl = false) {
    selectedMelody = archiveMelodies.find((item) => item.id === id) || null;

    if (selectedMelody) {
      localStorage.setItem(selectedMelodyKey, selectedMelody.id);
    } else {
      localStorage.removeItem(selectedMelodyKey);
    }

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (selectedMelody) url.searchParams.set("melody", selectedMelody.id);
      else url.searchParams.delete("melody");
      window.history.replaceState({}, "", url);
    }

    if (melodySelect) melodySelect.value = selectedMelody?.id || "";
    if (selectedMelodyCard) selectedMelodyCard.hidden = !selectedMelody;
    if (melodyEmpty) melodyEmpty.hidden = Boolean(selectedMelody);
    if (selectedMelodyPlay) selectedMelodyPlay.hidden = !selectedMelody;
    if (melodyBadge) melodyBadge.hidden = !selectedMelody;
    if (purchaseButton) purchaseButton.disabled = !selectedMelody;

    if (selectedMelody) {
      const index = archiveMelodies.findIndex((item) => item.id === selectedMelody.id);
      const title = melodyName(selectedMelody, Math.max(index, 0));
      const noteTotal = Array.isArray(selectedMelody.notes) ? selectedMelody.notes.length : 0;
      if (selectedMelodyKind) selectedMelodyKind.textContent = selectedMelody.kind === "HAND" ? "HAND / CAMERA" : "MOUSE / COMPOSE";
      if (selectedMelodyTitle) selectedMelodyTitle.textContent = title;
      if (selectedMelodyNotes) selectedMelodyNotes.textContent = `${noteTotal} NOTES`;
      if (selectedMelodyPlay) selectedMelodyPlay.href = `player.html?archive=${encodeURIComponent(selectedMelody.id)}`;
      if (melodyBadgeTitle) melodyBadgeTitle.textContent = title;
      renderMelodyPreview(selectedMelody);
    } else if (selectedMelodyPreview) {
      selectedMelodyPreview.replaceChildren();
    }

    updatePreview();
  }

  function populateMelodySelect() {
    if (!melodySelect) return;

    archiveMelodies = readSavedMelodies();
    melodySelect.replaceChildren();
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = archiveMelodies.length
      ? t("objectMelodyLabel")
      : t("objectMelodyEmpty");
    melodySelect.appendChild(prompt);

    archiveMelodies.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${melodyName(item, index)} · ${(item.notes || []).length} NOTES`;
      melodySelect.appendChild(option);
    });

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("melody");
    const remembered = localStorage.getItem(selectedMelodyKey);
    const initialId = archiveMelodies.some((item) => item.id === requested)
      ? requested
      : archiveMelodies.some((item) => item.id === remembered)
        ? remembered
        : "";

    updateSelectedMelody(initialId, false);
  }

  function getConfiguration() {
    return {
      material: selectedValue("material"),
      packaging: selectedValue("packaging"),
      engraving: engraving.value.trim(),
      melody: selectedMelody
        ? {
          id: selectedMelody.id,
          title: melodyName(selectedMelody, Math.max(0, archiveMelodies.findIndex((item) => item.id === selectedMelody.id))),
          notes: Array.isArray(selectedMelody.notes) ? selectedMelody.notes.length : 0,
        }
        : null,
      photo: photoInput && photoInput.files[0]
        ? photoInput.files[0].name
        : "",
    };
  }

  function updatePreview() {
    const configuration = getConfiguration();

    engravingPreview.textContent =
      configuration.engraving ||
      "A little music, for you.";

    engravingCount.textContent =
      `${engraving.value.length} / 32`;

    summary.textContent = [
      configuration.melody ? `MELODY · ${configuration.melody.title}` : null,
      configuration.material,
      configuration.packaging,
      configuration.photo ? "사진 프린팅" : null,
    ].filter(Boolean).join(" / ");
  }

  function updateObjectImage() {
    if (!objectImage) return;

    const isSilver = selectedValue("material") === "실버 메탈";
    const nextSource = isSilver ? "image/orgom" : "image/orgo.png";
    const nextAlt = isSilver
      ? "실버 메탈 케이스 안에 금속 장치가 보이는 수동 오르골"
      : "투명 아크릴 케이스 안에 금속 장치가 보이는 수동 오르골";

    if (objectImage.getAttribute("src") === nextSource) return;

    objectImage.classList.remove("is-entering");
    objectImage.classList.add("is-switching");

    window.setTimeout(() => {
      objectImage.src = nextSource;
      objectImage.alt = nextAlt;
      objectImage.onload = () => {
        objectImage.classList.remove("is-switching");
        objectImage.classList.add("is-entering");
        window.setTimeout(
          () => objectImage.classList.remove("is-entering"),
          440
        );
      };
    }, 180);
  }

  engraving.addEventListener("input", updatePreview);

  if (melodySelect) {
    melodySelect.addEventListener("change", (event) => {
      updateSelectedMelody(event.target.value, true);
    });
  }

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file = photoInput.files[0];

      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        photoPreviewImage.src = reader.result;
        photoPreview.hidden = false;
      };
      reader.readAsDataURL(file);
      photoName.textContent = file.name;
      updatePreview();
    });
  }

  document
    .querySelectorAll(
      'input[name="material"], input[name="packaging"]'
    )
    .forEach((input) => {
      input.addEventListener("change", () => {
        updatePreview();
        if (input.name === "material") updateObjectImage();
      });
    });

  function showOrderPreview() {
    const configuration = getConfiguration();
    if (!configuration.melody) {
      status.textContent = t("objectSelectFirst");
      melodySelect?.focus();
      return;
    }

    const rows = [
      ["MELODY", `${configuration.melody.title} · ${configuration.melody.notes} NOTES`],
      ["MATERIAL", configuration.material],
      ["PACKAGING", configuration.packaging],
      ["PHOTO PRINT", configuration.photo || "—"],
      ["ENGRAVING", configuration.engraving || "—"],
      ["TOTAL", "₩68,000"],
    ];

    orderDetails.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement("p");
        const key = document.createElement("span");
        const text = document.createElement("strong");
        key.textContent = label;
        text.textContent = value;
        row.append(key, text);
        return row;
      })
    );
    orderDialog.showModal();
  }

  purchaseButton?.addEventListener("click", showOrderPreview);

  confirmOrder?.addEventListener("click", () => {
    const configuration = getConfiguration();
    if (!configuration.melody) {
      orderDialog.close();
      status.textContent = t("objectSelectFirst");
      return;
    }

    localStorage.setItem("orgo-order-draft", JSON.stringify({
      ...configuration,
      createdAt: new Date().toISOString(),
      price: 68000,
    }));
    orderDialog.close();
    status.textContent = t("objectOrderReady");
  });

  saveButton.addEventListener("click", () => {
    const configuration = getConfiguration();

    const contents = [
      "ORGO — 나의 오르골 구성",
      "",
      `소재: ${configuration.material}`,
      `패키지: ${configuration.packaging}`,
      `선율: ${configuration.melody ? `${configuration.melody.title} (${configuration.melody.notes} NOTES)` : "선택 안 함"}`,
      `사진 프린팅: ${configuration.photo || "없음"}`,
      `각인 문구: ${configuration.engraving || "없음"}`,
      "",
      "이 파일은 구성 메모입니다.",
      "주문이나 결제가 완료된 상태가 아닙니다.",
    ].join("\n");

    const blob = new Blob(
      ["\uFEFF", contents],
      { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "orgo-my-object.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    status.textContent =
      "구성 메모를 저장했습니다. 실제 주문 및 결제 기능은 준비 중입니다.";
  });

  populateMelodySelect();
  updatePreview();
})();
