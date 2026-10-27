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

  const composePrimer = document.querySelector("[data-compose-primer-motion]");

  if (composePrimer && !reduceMotion.matches) {
    const primerSteps = [
      ...composePrimer.querySelectorAll(".compose-primer-motion-step"),
    ];
    let primerTicking = false;

    const clamp = (value) => Math.min(1, Math.max(0, value));
    const smoothstep = (value) => value * value * (3 - 2 * value);

    const updateComposePrimerMotion = () => {
      const bounds = composePrimer.getBoundingClientRect();
      const viewportHeight = Math.max(1, window.innerHeight);
      const start = viewportHeight * .78;
      const travel = Math.max(420, viewportHeight * .56);
      const progress = clamp((start - bounds.top) / travel);
      const titleProgress = smoothstep(clamp(progress / .74));

      composePrimer.style.setProperty(
        "--primer-title-x",
        `${(-190 * (1 - titleProgress)).toFixed(2)}px`
      );
      composePrimer.style.setProperty(
        "--primer-title-opacity",
        titleProgress.toFixed(4)
      );
      composePrimer.style.setProperty(
        "--primer-title-clip",
        `${(100 * (1 - titleProgress)).toFixed(2)}%`
      );
      composePrimer.style.setProperty(
        "--primer-title-blur",
        `${(7 * (1 - titleProgress)).toFixed(2)}px`
      );

      const stepStarts = [.16, .3, .44];
      primerSteps.forEach((step, index) => {
        const stepProgress = smoothstep(
          clamp((progress - stepStarts[index]) / .42)
        );
        step.style.setProperty(
          "--primer-step-y",
          `${(76 * (1 - stepProgress)).toFixed(2)}px`
        );
        step.style.setProperty(
          "--primer-step-opacity",
          stepProgress.toFixed(4)
        );
        step.style.setProperty(
          "--primer-step-blur",
          `${(4 * (1 - stepProgress)).toFixed(2)}px`
        );
      });

      primerTicking = false;
    };

    const requestComposePrimerMotion = () => {
      if (primerTicking) return;
      primerTicking = true;
      requestAnimationFrame(updateComposePrimerMotion);
    };

    composePrimer.classList.add("is-scroll-responsive");
    updateComposePrimerMotion();
    window.addEventListener("scroll", requestComposePrimerMotion, { passive: true });
    window.addEventListener("resize", requestComposePrimerMotion);
  }

  const storyNarrative = document.querySelector("[data-story-narrative]");

  if (storyNarrative && !reduceMotion.matches) {
    const storyChapters = [
      ...storyNarrative.querySelectorAll("[data-story-chapter]"),
    ];
    const storyTrack = storyNarrative.querySelector("[data-story-track]");
    const storySticky = storyNarrative.querySelector(".story-sticky");
    const storyCurrent = storyNarrative.querySelector("[data-story-current]");
    let storyTicking = false;

    const clampStory = (value) => Math.min(1, Math.max(0, value));
    const easeStory = (value) => value * value * (3 - 2 * value);

    const updateStoryNarrative = () => {
      if (!storyTrack || !storySticky || storyChapters.length === 0) return;

      const bounds = storyTrack.getBoundingClientRect();
      const travel = Math.max(1, storyTrack.offsetHeight - storySticky.offsetHeight);
      const progress = clampStory(-bounds.top / travel);
      const scenePosition = progress * (storyChapters.length - 1);
      const activeIndex = Math.min(
        storyChapters.length - 1,
        Math.max(0, Math.round(scenePosition))
      );

      storyNarrative.style.setProperty("--story-sequence-progress", progress.toFixed(4));
      if (storyCurrent) {
        storyCurrent.textContent = String(activeIndex + 1).padStart(2, "0");
      }

      storyChapters.forEach((chapter, index) => {
        const distance = index - scenePosition;
        const visibility = easeStory(clampStory(1 - Math.abs(distance)));
        const direction = Math.min(1, Math.max(-1, distance));

        chapter.style.setProperty("--story-chapter-opacity", visibility.toFixed(4));
        chapter.style.setProperty("--story-chapter-blur", `${(4 * (1 - visibility)).toFixed(2)}px`);
        chapter.style.setProperty("--story-heading-x", `${(-72 * direction).toFixed(2)}px`);
        chapter.style.setProperty("--story-copy-x", `${(72 * direction).toFixed(2)}px`);
        chapter.style.setProperty("--story-media-y", `${(52 * direction).toFixed(2)}px`);
        chapter.style.setProperty("--story-media-scale", (.955 + visibility * .045).toFixed(4));
        chapter.style.setProperty("--story-draw-offset", `${(760 * (1 - visibility)).toFixed(1)}px`);
        chapter.style.setProperty("--story-object-rotate", `${(direction * 2.4).toFixed(2)}deg`);
        chapter.style.zIndex = String(Math.max(0, Math.round(visibility * 100)));
        chapter.style.pointerEvents = index === activeIndex ? "auto" : "none";
        chapter.setAttribute("aria-hidden", index === activeIndex ? "false" : "true");
      });

      storyTicking = false;
    };

    const requestStoryNarrative = () => {
      if (storyTicking) return;
      storyTicking = true;
      requestAnimationFrame(updateStoryNarrative);
    };

    storyNarrative.classList.add("is-scroll-reactive");
    updateStoryNarrative();
    window.addEventListener("scroll", requestStoryNarrative, { passive: true });
    window.addEventListener("resize", requestStoryNarrative);
  }

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
  const recorderRoot = signalBridge?.querySelector("[data-recorder]");
  const recorderStatus = signalBridge?.querySelector("[data-recorder-status]");
  const recorderControls = [...(signalBridge?.querySelectorAll("[data-recorder-action]") || [])];
  const bridgeStage = signalBridge?.querySelector(".signal-bridge-stage");
  let recorderIsFront = false;
  let recorderDeactivate = () => {};

  const setRecorderStatus = (key) => {
    if (!recorderStatus) return;
    recorderStatus.dataset.i18n = key;
    recorderStatus.textContent = t(key);
  };

  const setRecorderFront = (isFront) => {
    if (!recorderRoot) return;
    const changed = recorderIsFront !== isFront;
    recorderIsFront = isFront;
    recorderRoot.classList.toggle("is-front-view", isFront);
    recorderControls.forEach((control) => { control.disabled = !isFront; });
    if (changed && !isFront) {
      recorderDeactivate();
      recorderRoot.classList.remove("is-recording", "is-playing");
      bridgeStage?.classList.remove("is-capturing");
      setRecorderStatus("bridgeRecorderWaiting");
    } else if (changed && isFront) {
      setRecorderStatus("bridgeRecorderIdle");
    }
  };

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
      const recorder = smoothstep(0.03, 0.76, raw);
      const exit = smoothstep(0.84, 1, raw);
      const recorderBack = 1 - smoothstep(.1, .25, recorder);
      const recorderSide = smoothstep(.12, .27, recorder) * (1 - smoothstep(.34, .48, recorder));
      const recorderAngle = smoothstep(.33, .48, recorder) * (1 - smoothstep(.62, .78, recorder));
      const recorderFront = smoothstep(.63, .82, recorder);
      const compact = window.innerWidth <= 650;
      const recorderX = (compact ? 18 : 12) + recorder * (compact ? 52 : 60);

      signalBridge.style.setProperty("--bridge-progress", motion.toFixed(3));
      signalBridge.style.setProperty("--bridge-wave", wave.toFixed(3));
      signalBridge.style.setProperty("--bridge-recorder", recorder.toFixed(3));
      signalBridge.style.setProperty("--bridge-recorder-x", `${recorderX.toFixed(2)}%`);
      signalBridge.style.setProperty("--bridge-exit", exit.toFixed(3));
      signalBridge.style.setProperty("--recorder-back", recorderBack.toFixed(3));
      signalBridge.style.setProperty("--recorder-side", recorderSide.toFixed(3));
      signalBridge.style.setProperty("--recorder-angle", recorderAngle.toFixed(3));
      signalBridge.style.setProperty("--recorder-front", recorderFront.toFixed(3));
      setRecorderFront(recorderFront > .88 && exit < .35);
    };

    const animateSignalBridge = () => {
      bridgeCurrent += (bridgeTarget - bridgeCurrent) * 0.16;
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

  if (signalBridge && recorderRoot) {
    const recordingLimit = 6000;
    let recordingTimer = 0;
    let recorderMedia = null;
    let recorderStream = null;
    let recorderChunks = [];
    let recorderClipUrl = "";
    let recorderPlayer = null;

    const releaseRecorderStream = () => {
      recorderStream?.getTracks?.().forEach((track) => track.stop());
      recorderStream = null;
    };

    const stopRecorderPlayback = () => {
      if (recorderPlayer) {
        recorderPlayer.pause();
        recorderPlayer.currentTime = 0;
        recorderPlayer = null;
      }
      recorderRoot.classList.remove("is-playing");
      if (!recorderRoot.classList.contains("is-recording")) {
        bridgeStage?.classList.remove("is-capturing");
      }
    };

    const stopVoiceRecording = () => {
      window.clearTimeout(recordingTimer);
      if (recorderMedia?.state === "recording") recorderMedia.stop();
      else releaseRecorderStream();
    };

    const preferredRecordingType = () => {
      if (!window.MediaRecorder?.isTypeSupported) return "";
      return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
    };

    const playVoiceRecording = async () => {
      if (!recorderClipUrl) {
        setRecorderStatus("bridgeRecorderNoClip");
        return;
      }
      stopRecorderPlayback();
      recorderPlayer = new Audio(recorderClipUrl);
      recorderPlayer.preload = "auto";
      recorderPlayer.addEventListener("ended", () => {
        recorderRoot.classList.remove("is-playing");
        bridgeStage?.classList.remove("is-capturing");
        setRecorderStatus("bridgeRecorderSaved");
        recorderPlayer = null;
      }, { once: true });
      recorderRoot.classList.add("is-playing");
      bridgeStage?.classList.add("is-capturing");
      setRecorderStatus("bridgeRecorderPlaying");
      try {
        await recorderPlayer.play();
      } catch (error) {
        console.error(error);
        stopRecorderPlayback();
        setRecorderStatus("bridgeRecorderPlaybackError");
      }
    };

    const startVoiceRecording = async () => {
      if (recorderMedia?.state === "recording") {
        stopVoiceRecording();
        return;
      }
      stopRecorderPlayback();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setRecorderStatus("bridgeRecorderMicError");
        return;
      }
      setRecorderStatus("bridgeRecorderRequesting");
      try {
        recorderStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });
        recorderChunks = [];
        const mimeType = preferredRecordingType();
        recorderMedia = mimeType
          ? new MediaRecorder(recorderStream, { mimeType })
          : new MediaRecorder(recorderStream);
        recorderMedia.addEventListener("dataavailable", (event) => {
          if (event.data?.size) recorderChunks.push(event.data);
        });
        recorderMedia.addEventListener("stop", () => {
          window.clearTimeout(recordingTimer);
          releaseRecorderStream();
          recorderRoot.classList.remove("is-recording");
          bridgeStage?.classList.remove("is-capturing");
          const blob = new Blob(recorderChunks, { type: recorderMedia?.mimeType || mimeType || "audio/webm" });
          recorderMedia = null;
          if (blob.size) {
            if (recorderClipUrl) URL.revokeObjectURL(recorderClipUrl);
            recorderClipUrl = URL.createObjectURL(blob);
            setRecorderStatus(recorderIsFront ? "bridgeRecorderSaved" : "bridgeRecorderWaiting");
          } else {
            setRecorderStatus(recorderIsFront ? "bridgeRecorderMicError" : "bridgeRecorderWaiting");
          }
        }, { once: true });
        recorderMedia.start(120);
        recorderRoot.classList.add("is-recording");
        bridgeStage?.classList.add("is-capturing");
        setRecorderStatus("bridgeRecorderActive");
        recordingTimer = window.setTimeout(stopVoiceRecording, recordingLimit);
      } catch (error) {
        console.error(error);
        recorderMedia = null;
        releaseRecorderStream();
        recorderRoot.classList.remove("is-recording");
        bridgeStage?.classList.remove("is-capturing");
        setRecorderStatus("bridgeRecorderMicError");
      }
    };

    const stopRecorder = () => {
      stopRecorderPlayback();
      if (recorderMedia?.state === "recording") stopVoiceRecording();
      else {
        recorderRoot.classList.remove("is-recording");
        bridgeStage?.classList.remove("is-capturing");
        setRecorderStatus(recorderClipUrl ? "bridgeRecorderSaved" : "bridgeRecorderIdle");
      }
    };

    recorderDeactivate = () => {
      stopRecorderPlayback();
      if (recorderMedia?.state === "recording") stopVoiceRecording();
      else releaseRecorderStream();
    };

    recorderControls.forEach((control) => {
      control.addEventListener("click", async () => {
        if (!recorderIsFront) return;
        const action = control.dataset.recorderAction;

        if (action === "stop") {
          stopRecorder();
          return;
        }

        if (action === "record") {
          await startVoiceRecording();
          return;
        }

        if (action === "play") {
          if (recorderMedia?.state === "recording") {
            stopVoiceRecording();
            return;
          }
          await playVoiceRecording();
        }
      });
    });

    window.addEventListener("beforeunload", () => {
      recorderDeactivate();
      if (recorderClipUrl) URL.revokeObjectURL(recorderClipUrl);
    }, { once: true });

    if (reduceMotion.matches) setRecorderFront(true);
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
    const stopButton = soundLab.querySelector("[data-lab-stop]");
    const bpmInput = soundLab.querySelector("[data-lab-bpm]");
    const bpmOutput = soundLab.querySelector("[data-lab-bpm-output]");
    const labStatus = soundLab.querySelector("[data-lab-status]");
    const wrapStage = soundLab.querySelector("[data-wrap-stage]");
    const wrapObject = soundLab.querySelector("[data-wrap-object]");
    const wrapDents = soundLab.querySelector("[data-wrap-dents]");
    const wrapCount = soundLab.querySelector("[data-wrap-count]");
    const bassStage = soundLab.querySelector("[data-bass-stage]");
    const bassStringControls = [...soundLab.querySelectorAll("[data-bass-string]")];
    const drumStage = soundLab.querySelector("[data-drum-stage]");
    const drumPads = [...soundLab.querySelectorAll("[data-drum-part]")];
    const drumPieces = new Map(
      [...soundLab.querySelectorAll("[data-drum-piece]")]
        .map((piece) => [piece.dataset.drumPiece, piece])
    );
    const drumCursor = soundLab.querySelector(".drum-stick-cursor");
    const pianoStage = soundLab.querySelector("[data-piano-stage]");
    const pianoVideo = soundLab.querySelector("[data-piano-video]");
    const pianoOverlay = soundLab.querySelector("[data-piano-overlay]");
    const pianoOverlayContext = pianoOverlay?.getContext("2d");
    const pianoStartButton = soundLab.querySelector("[data-piano-start]");
    const pianoPlaceholder = soundLab.querySelector("[data-piano-placeholder]");
    const pianoStatus = soundLab.querySelector("[data-piano-status]");
    const pianoKeys = [...soundLab.querySelectorAll("[data-piano-key]")];
    const pianoWhiteKeys = [...soundLab.querySelectorAll(".piano-white-key")];
    const pianoBlackKeys = [...soundLab.querySelectorAll(".piano-black-key")];

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
    let wrapDrag = null;
    let wrapDentCount = 0;
    let wrapLastSoundAt = 0;
    let bassPulseTimer = null;
    let drumNoiseBuffer = null;
    let drumCursorTimer = null;
    let pianoHands = null;
    let pianoCamera = null;
    let pianoStream = null;
    let pianoStarting = false;
    let pianoLastNoteAt = 0;
    let pianoFrameBusy = false;
    let pianoLastInferenceAt = 0;
    const drumPieceTimers = new Map();
    const bassStringAnimations = new Map();
    const pianoKeyTimers = new Map();
    const pianoFingerStates = new Map();
    const pianoHandHistory = new Map();

    const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29];
    const sequence = [0, 3, 5, 7, 10, 7, 5, 3];
    const drumSequence = ["kick", "hihat", "snare", "hihat", "kick", "tom1", "snare", "crash"];
    const pianoTipIndices = [4, 8, 12, 16, 20];
    const pianoPipIndices = [3, 6, 10, 14, 18];
    const pianoFingerNames = ["THUMB", "INDEX", "MIDDLE", "RING", "PINKY"];
    const pianoBlackCenters = [1, 2, 4, 5, 6, 8, 9, 11, 12, 13].map((gap) => gap / 14);

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

    function playWrapCrinkle(intensity = .66, position = .5) {
      const context = ensureAudio();
      if (!context) return;

      const level = Math.max(.22, Math.min(1, intensity));
      const horizontal = Math.max(0, Math.min(1, position));
      const now = context.currentTime;
      const burstCount = 2 + Math.round(level * 3);

      for (let index = 0; index < burstCount; index += 1) {
        const source = context.createBufferSource();
        const highpass = context.createBiquadFilter();
        const bandpass = context.createBiquadFilter();
        const envelope = context.createGain();
        const startAt = now + index * (.009 + Math.random() * .012);
        const duration = .035 + Math.random() * .065;

        source.buffer = getDrumNoise();
        source.playbackRate.value = 1.25 + Math.random() * 1.15;
        highpass.type = "highpass";
        highpass.frequency.value = 620 + level * 580;
        highpass.Q.value = .6;
        bandpass.type = "bandpass";
        bandpass.frequency.value = 1450 + horizontal * 3300 + Math.random() * 900;
        bandpass.Q.value = .65 + Math.random() * 1.1;
        envelope.gain.setValueAtTime(.0001, startAt);
        envelope.gain.linearRampToValueAtTime((.045 + Math.random() * .055) * level, startAt + .004);
        envelope.gain.exponentialRampToValueAtTime(.0001, startAt + duration);

        source.connect(highpass).connect(bandpass).connect(envelope).connect(masterGain);
        source.start(startAt, Math.random() * 1.35, duration + .02);
        source.stop(startAt + duration + .035);
      }
    }

    function wrapPoint(event) {
      const bounds = wrapObject.getBoundingClientRect();
      return {
        x: Math.max(.04, Math.min(.96, (event.clientX - bounds.left) / bounds.width)),
        y: Math.max(.05, Math.min(.95, (event.clientY - bounds.top) / bounds.height)),
      };
    }

    function setWrapPose(x, y, intensity = .55) {
      if (!wrapObject) return;
      const pressure = Math.max(.15, Math.min(1, intensity));
      wrapObject.style.setProperty("--wrap-x", `${(x * 100).toFixed(2)}%`);
      wrapObject.style.setProperty("--wrap-y", `${(y * 100).toFixed(2)}%`);
      wrapObject.style.setProperty("--wrap-rx", `${((.5 - y) * 6.5 * pressure).toFixed(2)}deg`);
      wrapObject.style.setProperty("--wrap-ry", `${((x - .5) * 7.5 * pressure).toFixed(2)}deg`);
      wrapObject.style.setProperty("--wrap-scale", (1 - pressure * .016).toFixed(4));
    }

    function relaxWrapPose() {
      if (!wrapObject) return;
      wrapObject.classList.remove("is-pressed");
      wrapObject.style.setProperty("--wrap-rx", "0deg");
      wrapObject.style.setProperty("--wrap-ry", "0deg");
      wrapObject.style.setProperty("--wrap-scale", "1");
    }

    function addWrapDent(x, y, intensity = .55) {
      if (!wrapDents) return;
      const dent = document.createElement("span");
      const size = 96 + intensity * 116 + Math.random() * 34;
      dent.className = "wrap-dent";
      dent.style.setProperty("--dent-x", `${(x * 100).toFixed(2)}%`);
      dent.style.setProperty("--dent-y", `${(y * 100).toFixed(2)}%`);
      dent.style.setProperty("--dent-size", `${size.toFixed(1)}px`);
      dent.style.setProperty("--dent-rotate", `${(-38 + Math.random() * 76).toFixed(1)}deg`);
      dent.style.setProperty("--dent-opacity", (.1 + intensity * .17).toFixed(2));
      wrapDents.appendChild(dent);
      while (wrapDents.children.length > 12) wrapDents.firstElementChild.remove();
      wrapDentCount += 1;
      if (wrapCount) wrapCount.value = String(Math.min(99, wrapDentCount)).padStart(2, "0");
    }

    function resetWrapSurface() {
      if (wrapDents) wrapDents.replaceChildren();
      wrapDentCount = 0;
      if (wrapCount) wrapCount.value = "00";
      relaxWrapPose();
    }

    function pulseWrap(x, y, intensity = .58, leaveDent = true) {
      if (!wrapObject) return;
      wrapObject.classList.add("is-pressed");
      setWrapPose(x, y, intensity);
      if (leaveDent) addWrapDent(x, y, intensity);
      playWrapCrinkle(intensity, x);
      window.setTimeout(relaxWrapPose, 190);
    }

    function playPianoNote(frequency, velocity = .78) {
      const context = ensureAudio();
      if (!context) return;

      const now = context.currentTime;
      const level = Math.max(.35, Math.min(1, velocity));
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      const roomSend = context.createGain();
      const partials = [
        { ratio: 1, gain: .72, duration: 2.4 },
        { ratio: 2.006, gain: .23, duration: 1.65 },
        { ratio: 3.018, gain: .085, duration: 1.05 },
        { ratio: 4.03, gain: .035, duration: .72 },
      ];

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(5400 - (frequency / 1000) * 1250, now);
      filter.Q.value = .42;
      envelope.gain.setValueAtTime(.0001, now);
      envelope.gain.exponentialRampToValueAtTime(.17 * level, now + .006);
      envelope.gain.exponentialRampToValueAtTime(.085 * level, now + .095);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + 2.15);
      filter.connect(envelope);
      envelope.connect(masterGain);
      roomSend.gain.value = .075;
      envelope.connect(roomSend);
      roomSend.connect(delayNode);

      partials.forEach((partial, index) => {
        const oscillator = context.createOscillator();
        const partialGain = context.createGain();
        oscillator.type = index === 0 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency * partial.ratio, now);
        oscillator.detune.value = index % 2 ? 1.8 : -1.2;
        partialGain.gain.setValueAtTime(partial.gain, now);
        partialGain.gain.exponentialRampToValueAtTime(.0001, now + partial.duration);
        oscillator.connect(partialGain);
        partialGain.connect(filter);
        oscillator.start(now);
        oscillator.stop(now + partial.duration + .08);
      });

      const hammer = context.createBufferSource();
      const hammerFilter = context.createBiquadFilter();
      const hammerGain = context.createGain();
      hammer.buffer = getDrumNoise();
      hammerFilter.type = "bandpass";
      hammerFilter.frequency.value = Math.min(4800, 1750 + frequency * 2.25);
      hammerFilter.Q.value = 1.15;
      hammerGain.gain.setValueAtTime(.022 * level, now);
      hammerGain.gain.exponentialRampToValueAtTime(.0001, now + .028);
      hammer.connect(hammerFilter);
      hammerFilter.connect(hammerGain);
      hammerGain.connect(masterGain);
      hammer.start(now);
      hammer.stop(now + .035);
    }

    function triggerPianoKey(key, velocity = .78, fingerLabel = "") {
      if (!key) return;
      playPianoNote(Number(key.dataset.frequency), velocity);
      window.clearTimeout(pianoKeyTimers.get(key));
      key.classList.remove("is-pressed");
      void key.offsetWidth;
      key.classList.add("is-pressed");
      pianoKeyTimers.set(key, window.setTimeout(() => {
        key.classList.remove("is-pressed");
        pianoKeyTimers.delete(key);
      }, 190));
      pianoLastNoteAt = performance.now();
      pianoStatus.textContent = `${key.dataset.note}${fingerLabel ? ` / ${fingerLabel}` : ""}`;
      labStatus.textContent = `PIANO / ${key.dataset.note}`;
    }

    function pianoKeyAtPoint(x, y) {
      if (y < .82) {
        let closestIndex = -1;
        let closestDistance = Infinity;
        pianoBlackCenters.forEach((center, index) => {
          const distance = Math.abs(x - center);
          if (distance < closestDistance) {
            closestIndex = index;
            closestDistance = distance;
          }
        });
        if (closestDistance <= .024) return pianoBlackKeys[closestIndex];
      }
      const whiteIndex = Math.max(0, Math.min(pianoWhiteKeys.length - 1, Math.floor(x * pianoWhiteKeys.length)));
      return pianoWhiteKeys[whiteIndex];
    }

    function sizePianoOverlay() {
      if (!pianoOverlay || !pianoVideo) return;
      const width = pianoVideo.videoWidth || 1280;
      const height = pianoVideo.videoHeight || 720;
      if (pianoOverlay.width !== width) pianoOverlay.width = width;
      if (pianoOverlay.height !== height) pianoOverlay.height = height;
    }

    function clearPianoTracking() {
      pianoFingerStates.clear();
      pianoHandHistory.clear();
      if (pianoOverlayContext && pianoOverlay) {
        pianoOverlayContext.clearRect(0, 0, pianoOverlay.width, pianoOverlay.height);
      }
    }

    function smoothPianoLandmarks(handedness, landmarks) {
      const previous = pianoHandHistory.get(handedness);
      const smoothed = landmarks.map((point, index) => {
        const oldPoint = previous?.[index];
        if (!oldPoint) return { ...point };

        const distance = Math.hypot(point.x - oldPoint.x, point.y - oldPoint.y);
        const alpha = distance > .035 ? .74 : distance > .012 ? .56 : .42;
        return {
          x: oldPoint.x + (point.x - oldPoint.x) * alpha,
          y: oldPoint.y + (point.y - oldPoint.y) * alpha,
          z: oldPoint.z + (point.z - oldPoint.z) * alpha,
        };
      });
      pianoHandHistory.set(handedness, smoothed);
      return smoothed;
    }

    function onPianoHands(results) {
      if (!pianoOverlayContext || !pianoOverlay) return;
      sizePianoOverlay();
      pianoOverlayContext.clearRect(0, 0, pianoOverlay.width, pianoOverlay.height);

      const hands = results.multiHandLandmarks || [];
      const seenFingers = new Set();

      hands.forEach((rawLandmarks, handIndex) => {
        const handedness = results.multiHandedness?.[handIndex]?.label || `HAND ${handIndex + 1}`;
        const landmarks = smoothPianoLandmarks(handedness, rawLandmarks);
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          window.drawConnectors(pianoOverlayContext, landmarks, window.HAND_CONNECTIONS, {
            color: "rgba(220, 220, 222, .54)",
            lineWidth: 2,
          });
        }
        if (window.drawLandmarks) {
          window.drawLandmarks(pianoOverlayContext, landmarks, {
            color: "rgba(248, 248, 250, .9)",
            fillColor: "rgba(30, 30, 32, .8)",
            lineWidth: 1,
            radius: 2.2,
          });
        }

        pianoTipIndices.forEach((tipIndex, fingerIndex) => {
          const tip = landmarks[tipIndex];
          const pip = landmarks[pianoPipIndices[fingerIndex]];
          const fingerId = `${handedness}-${tipIndex}`;
          const previous = pianoFingerStates.get(fingerId);
          const screenX = Math.max(0, Math.min(1, 1 - tip.x));
          const y = Math.max(0, Math.min(1, tip.y));
          const relativeY = y - Math.max(0, Math.min(1, pip.y));
          const deltaY = previous ? y - previous.y : 0;
          const relativeDelta = previous ? relativeY - previous.relativeY : 0;
          const inPressZone = y >= .56;
          const crossedPressLine = previous?.y < .56 && inPressZone;
          const pressed = previous && !previous.down && inPressZone && (
            crossedPressLine || deltaY > .0065 || relativeDelta > .0075
          );
          let down = previous?.down || false;

          if (pressed) {
            const key = pianoKeyAtPoint(screenX, y);
            const pressSpeed = Math.max(deltaY, relativeDelta, .004);
            const velocity = Math.max(.5, Math.min(1, .56 + pressSpeed * 20));
            triggerPianoKey(key, velocity, `${handedness.toUpperCase()} ${pianoFingerNames[fingerIndex]}`);
            down = true;
          }
          if (y < .515 || relativeDelta < -.01 || deltaY < -.012) down = false;

          pianoFingerStates.set(fingerId, { y, x: screenX, relativeY, down });
          seenFingers.add(fingerId);

          pianoOverlayContext.save();
          pianoOverlayContext.beginPath();
          pianoOverlayContext.arc(
            tip.x * pianoOverlay.width,
            tip.y * pianoOverlay.height,
            down ? 11 : 7,
            0,
            Math.PI * 2
          );
          pianoOverlayContext.fillStyle = down ? "rgba(255,255,255,.92)" : "rgba(210,210,212,.72)";
          pianoOverlayContext.fill();
          pianoOverlayContext.restore();
        });
      });

      [...pianoFingerStates.keys()].forEach((fingerId) => {
        if (!seenFingers.has(fingerId)) pianoFingerStates.delete(fingerId);
      });

      const seenHands = new Set(hands.map((_, index) => results.multiHandedness?.[index]?.label || `HAND ${index + 1}`));
      [...pianoHandHistory.keys()].forEach((handedness) => {
        if (!seenHands.has(handedness)) pianoHandHistory.delete(handedness);
      });

      if (!hands.length) pianoStatus.textContent = t("labPianoNoHands");
      else if (performance.now() - pianoLastNoteAt > 650) {
        pianoStatus.textContent = hands.length > 1 ? t("labPianoTrackingBoth") : t("labPianoTrackingOne");
      }
    }

    async function startPianoCamera() {
      if (pianoStarting || pianoStream) return;
      ensureAudio();
      pianoStarting = true;
      pianoStartButton.disabled = true;
      pianoStatus.textContent = t("labPianoStarting");

      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.Hands || !window.Camera) {
          throw new Error("Camera hand tracking is unavailable");
        }
        pianoHands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        pianoHands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: .55,
          minTrackingConfidence: .5,
        });
        pianoHands.onResults(onPianoHands);
        pianoCamera = new window.Camera(pianoVideo, {
          onFrame: async () => {
            const now = performance.now();
            if (!pianoHands || pianoFrameBusy || now - pianoLastInferenceAt < 30) return;
            pianoFrameBusy = true;
            pianoLastInferenceAt = now;
            try {
              await pianoHands.send({ image: pianoVideo });
            } finally {
              pianoFrameBusy = false;
            }
          },
          width: 960,
          height: 540,
        });
        await pianoCamera.start();
        pianoStream = pianoVideo.srcObject;
        pianoPlaceholder.hidden = true;
        pianoStatus.textContent = t("labPianoNoHands");
      } catch (error) {
        console.error(error);
        pianoStatus.textContent = t("labPianoError");
        stopPianoCamera();
      } finally {
        pianoStarting = false;
        pianoStartButton.disabled = false;
        pianoStartButton.textContent = t("labPianoStart");
      }
    }

    function stopPianoCamera() {
      if (pianoCamera?.stop) pianoCamera.stop();
      if (pianoStream?.getTracks) pianoStream.getTracks().forEach((track) => track.stop());
      if (pianoVideo?.srcObject?.getTracks) pianoVideo.srcObject.getTracks().forEach((track) => track.stop());
      if (pianoHands?.close) Promise.resolve(pianoHands.close()).catch(() => {});
      pianoCamera = null;
      pianoStream = null;
      pianoHands = null;
      pianoFrameBusy = false;
      pianoLastInferenceAt = 0;
      clearPianoTracking();
      if (pianoPlaceholder) pianoPlaceholder.hidden = false;
    }

    function pluckBass(frequency, intensity = .72) {
      const context = ensureAudio();
      if (!context) return;

      const now = context.currentTime;
      const filter = context.createBiquadFilter();
      const body = context.createGain();
      const fundamental = context.createOscillator();
      const roundBody = context.createOscillator();
      const roundGain = context.createGain();
      const harmonic = context.createOscillator();
      const harmonicGain = context.createGain();
      const presence = context.createOscillator();
      const presenceGain = context.createGain();
      const finger = context.createBufferSource();
      const fingerFilter = context.createBiquadFilter();
      const fingerGain = context.createGain();
      const roomSend = context.createGain();
      const bassTone = context.createBiquadFilter();
      const bassPunch = context.createBiquadFilter();
      const bassCompressor = context.createDynamicsCompressor();
      const bassBus = context.createGain();
      const impact = context.createOscillator();
      const impactGain = context.createGain();
      const level = Math.max(.45, Math.min(1, intensity));

      filter.type = "lowpass";
      filter.Q.setValueAtTime(.58, now);
      filter.frequency.setValueAtTime(780 + level * 420, now);
      filter.frequency.exponentialRampToValueAtTime(210, now + 1.35);

      bassTone.type = "lowshelf";
      bassTone.frequency.value = 170;
      bassTone.gain.value = 8.5;
      bassPunch.type = "peaking";
      bassPunch.frequency.value = 105;
      bassPunch.Q.value = .72;
      bassPunch.gain.value = 4.5;
      bassCompressor.threshold.value = -22;
      bassCompressor.knee.value = 18;
      bassCompressor.ratio.value = 3.2;
      bassCompressor.attack.value = .012;
      bassCompressor.release.value = .32;
      bassBus.gain.value = 2.35;

      body.gain.setValueAtTime(.0001, now);
      body.gain.exponentialRampToValueAtTime(.48 + level * .22, now + .014);
      body.gain.exponentialRampToValueAtTime(.24 + level * .11, now + .24);
      body.gain.exponentialRampToValueAtTime(.0001, now + 2.2);
      filter.connect(body);
      body.connect(bassTone);
      bassTone.connect(bassPunch);
      bassPunch.connect(bassCompressor);
      bassCompressor.connect(bassBus);
      bassBus.connect(masterGain);
      roomSend.gain.value = .018;
      body.connect(roomSend);
      roomSend.connect(delayNode);

      fundamental.type = "triangle";
      fundamental.frequency.setValueAtTime(frequency * 1.035, now);
      fundamental.frequency.exponentialRampToValueAtTime(frequency, now + .075);
      fundamental.connect(filter);

      roundBody.type = "sine";
      roundBody.frequency.setValueAtTime(frequency, now);
      roundGain.gain.value = .92;
      roundBody.connect(roundGain);
      roundGain.connect(filter);

      harmonic.type = "sine";
      harmonic.frequency.setValueAtTime(frequency * 2.006, now);
      harmonicGain.gain.setValueAtTime(.3 + level * .1, now);
      harmonicGain.gain.exponentialRampToValueAtTime(.065, now + .9);
      harmonicGain.gain.exponentialRampToValueAtTime(.0001, now + 1.8);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(filter);

      // Keep only a soft upper edge so the body stays round instead of synthetic.
      presence.type = "triangle";
      presence.frequency.setValueAtTime(frequency * 3.01, now);
      presenceGain.gain.setValueAtTime(.06 + level * .04, now);
      presenceGain.gain.exponentialRampToValueAtTime(.0001, now + .55);
      presence.connect(presenceGain);
      presenceGain.connect(filter);

      // A short pitch fall gives the pluck a physical, speaker-like "thump".
      impact.type = "sine";
      impact.frequency.setValueAtTime(frequency * 1.18, now);
      impact.frequency.exponentialRampToValueAtTime(frequency, now + .11);
      impactGain.gain.setValueAtTime(.22 + level * .12, now);
      impactGain.gain.exponentialRampToValueAtTime(.0001, now + .42);
      impact.connect(impactGain);
      impactGain.connect(filter);

      finger.buffer = getDrumNoise();
      fingerFilter.type = "bandpass";
      fingerFilter.frequency.value = 620 + level * 360;
      fingerFilter.Q.value = .65;
      fingerGain.gain.setValueAtTime(.012 + level * .014, now);
      fingerGain.gain.exponentialRampToValueAtTime(.0001, now + .032);
      finger.connect(fingerFilter);
      fingerFilter.connect(fingerGain);
      fingerGain.connect(masterGain);

      fundamental.start(now);
      roundBody.start(now);
      harmonic.start(now);
      presence.start(now);
      impact.start(now);
      finger.start(now);
      finger.stop(now + .04);
      fundamental.stop(now + 2.3);
      roundBody.stop(now + 2.3);
      harmonic.stop(now + 1.9);
      presence.stop(now + .62);
      impact.stop(now + .48);
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
      if (waveform === "piano") return t("labPianoReady");
      if (waveform === "drum") return t("labDrumReady");
      if (waveform === "sawtooth") return t("labBassReady");
      if (waveform === "wrap") return t("labWrapReady");
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
      if (loopTimer) window.clearTimeout(loopTimer);
      loopTimer = null;
      stepButtons.forEach((step) => step.classList.remove("is-current"));
      playButton.classList.remove("is-playing");
      playButton.setAttribute("aria-pressed", "false");
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
        } else if (waveform === "piano") playPianoNote(frequency * 2, .62);
        else if (waveform === "sawtooth") pluckBass(frequency / 2, .48);
        else if (waveform === "wrap") pulseWrap(.16 + loopStep * .095, .34 + (loopStep % 3) * .16, .48 + (loopStep % 2) * .16);
        else pluck(frequency);
      }
      loopStep = (loopStep + 1) % stepButtons.length;
    }

    function advanceLoop() {
      tickLoop();
      const interval = (60000 / Number(bpmInput.value)) / 2;
      loopTimer = window.setTimeout(advanceLoop, interval);
    }

    function startLoop() {
      ensureAudio();
      stopLoop();
      loopStep = 0;
      playButton.classList.add("is-playing");
      playButton.setAttribute("aria-pressed", "true");
      labStatus.textContent = t("labPlaying");
      advanceLoop();
    }

    voiceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        waveform = button.dataset.wave || "sine";
        const bassMode = waveform === "sawtooth";
        const drumMode = waveform === "drum";
        const pianoMode = waveform === "piano";
        const wrapMode = waveform === "wrap";
        voiceButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        if (pointerPlaying) stopPadVoice();
        if (!pianoMode) stopPianoCamera();
        soundLab.classList.toggle("is-bass-mode", bassMode);
        soundLab.classList.toggle("is-drum-mode", drumMode);
        soundLab.classList.toggle("is-piano-mode", pianoMode);
        soundLab.classList.toggle("is-wrap-mode", wrapMode);
        pad.setAttribute(
          "aria-label",
          bassMode
            ? "Pull and release a bass string"
            : drumMode
              ? "Strike the acoustic drum kit"
              : pianoMode
                ? "Play piano with both hands on camera"
                : wrapMode
                  ? "Touch and crumple the package"
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
        } else if (pianoMode) {
          bassStringControls.forEach((control) => {
            stopBassAnimation(control);
            setBassPath(control);
          });
          labStatus.textContent = t("labPianoReady");
          pianoStatus.textContent = t("labPianoReady");
          playPianoNote(261.63, .5);
        } else if (wrapMode) {
          bassStringControls.forEach((control) => {
            stopBassAnimation(control);
            setBassPath(control);
          });
          resetWrapSurface();
          labStatus.textContent = t("labWrapReady");
          playWrapCrinkle(.4, .5);
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

    if (wrapStage && wrapObject) {
      wrapStage.addEventListener("pointerdown", (event) => {
        if (waveform !== "wrap") return;
        event.preventDefault();
        event.stopPropagation();
        wrapStage.setPointerCapture(event.pointerId);
        const point = wrapPoint(event);
        const pressure = event.pressure ? .48 + event.pressure * .52 : .68;
        wrapDrag = {
          pointerId: event.pointerId,
          x: point.x,
          y: point.y,
          dentAt: performance.now(),
        };
        wrapObject.classList.add("is-pressed");
        setWrapPose(point.x, point.y, pressure);
        addWrapDent(point.x, point.y, pressure);
        playWrapCrinkle(pressure, point.x);
        wrapLastSoundAt = performance.now();
        labStatus.textContent = `WRAP / ${String(wrapDentCount).padStart(2, "0")} TOUCHES`;
      });

      wrapStage.addEventListener("pointermove", (event) => {
        if (!wrapDrag || wrapDrag.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const point = wrapPoint(event);
        const distance = Math.hypot(point.x - wrapDrag.x, point.y - wrapDrag.y);
        const now = performance.now();
        const pressure = Math.max(.38, Math.min(1, (event.pressure || .48) + distance * 4.6));
        setWrapPose(point.x, point.y, pressure);

        if (distance > .012 && now - wrapDrag.dentAt > 58) {
          addWrapDent(point.x, point.y, pressure);
          wrapDrag.dentAt = now;
          labStatus.textContent = `WRAP / ${String(wrapDentCount).padStart(2, "0")} TOUCHES`;
        }
        if (distance > .007 && now - wrapLastSoundAt > 42) {
          playWrapCrinkle(pressure, point.x);
          wrapLastSoundAt = now;
        }
        wrapDrag.x = point.x;
        wrapDrag.y = point.y;
      });

      const finishWrapGesture = (event) => {
        if (!wrapDrag || (event.pointerId != null && wrapDrag.pointerId !== event.pointerId)) return;
        event.preventDefault();
        event.stopPropagation();
        wrapDrag = null;
        relaxWrapPose();
        labStatus.textContent = `WRAP / ${String(wrapDentCount).padStart(2, "0")} TOUCHES`;
      };

      ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
        wrapStage.addEventListener(eventName, finishWrapGesture);
      });

      wrapStage.addEventListener("keydown", (event) => {
        if (!['Enter', ' '].includes(event.key) || event.repeat || waveform !== "wrap") return;
        event.preventDefault();
        event.stopPropagation();
        const x = .32 + Math.random() * .36;
        const y = .3 + Math.random() * .42;
        pulseWrap(x, y, .68);
        labStatus.textContent = `WRAP / ${String(wrapDentCount).padStart(2, "0")} TOUCHES`;
      });
    }

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

    if (pianoStage) {
      pianoStartButton.addEventListener("click", startPianoCamera);
      pianoKeys.forEach((key) => {
        key.setAttribute("aria-label", key.dataset.note);
        key.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          triggerPianoKey(key, event.pressure ? .55 + event.pressure * .45 : .8);
        });
        key.addEventListener("keydown", (event) => {
          if (!["Enter", " "].includes(event.key) || event.repeat) return;
          event.preventDefault();
          event.stopPropagation();
          triggerPianoKey(key, .78);
        });
      });
    }

    pad.addEventListener("pointerdown", (event) => {
      if (soundLab.classList.contains("is-bass-mode") || soundLab.classList.contains("is-drum-mode") || soundLab.classList.contains("is-piano-mode") || soundLab.classList.contains("is-wrap-mode")) return;
      event.preventDefault();
      pad.setPointerCapture(event.pointerId);
      const position = pointerPosition(event);
      startPadVoice(position.x, position.y);
    });

    pad.addEventListener("pointermove", (event) => {
      if (soundLab.classList.contains("is-bass-mode") || soundLab.classList.contains("is-drum-mode") || soundLab.classList.contains("is-piano-mode") || soundLab.classList.contains("is-wrap-mode")) return;
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
      if (soundLab.classList.contains("is-bass-mode") || soundLab.classList.contains("is-drum-mode") || soundLab.classList.contains("is-piano-mode") || soundLab.classList.contains("is-wrap-mode")) return;
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
          } else if (waveform === "piano") playPianoNote(frequency * 2, .68);
          else if (waveform === "sawtooth") pluckBass(frequency / 2, .5);
          else if (waveform === "wrap") pulseWrap(.16 + index * .095, .34 + (index % 3) * .16, .58);
          else pluck(frequency);
        }
      });
    });

    playButton.addEventListener("click", () => {
      if (!loopTimer) startLoop();
    });

    stopButton.addEventListener("click", stopLoop);

    bpmInput.addEventListener("input", () => {
      bpmOutput.value = String(bpmInput.value).padStart(3, "0");
      if (loopTimer) startLoop();
    });

    document.addEventListener("orgo-languagechange", () => {
      [
        [playButton, "labPlay"],
        [stopButton, "labStop"],
      ].forEach(([button, key]) => {
        button.setAttribute("aria-label", t(key));
        button.setAttribute("title", t(key));
      });
      if (!pointerPlaying) {
        labStatus.textContent = loopTimer
          ? t("labPlaying")
          : readyText();
      }
      if (!pianoStream && pianoStatus) pianoStatus.textContent = t("labPianoReady");
    });

    [
      [playButton, "labPlay"],
      [stopButton, "labStop"],
    ].forEach(([button, key]) => {
      button.setAttribute("aria-label", t(key));
      button.setAttribute("title", t(key));
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPadVoice();
        stopLoop();
        stopPianoCamera();
        bassStringControls.forEach((control) => {
          stopBassAnimation(control);
          setBassPath(control);
        });
      }
    });
    window.addEventListener("pagehide", stopPianoCamera);
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

    function renderHandwritingPreview(preview, item, height, cropToInk = false) {
      const strokes = Array.isArray(item.strokes) ? item.strokes : [];
      const validStrokes = strokes.filter(
        (stroke) => Array.isArray(stroke.points) && stroke.points.length > 0
      );

      if (!validStrokes.length) return false;

      const allPoints = validStrokes.flatMap((stroke) =>
        stroke.points.filter(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
        )
      );
      if (!allPoints.length) return false;

      const sourceWidth = Number(item.width) || 1200;
      const sourceHeight = Number(height) || Number(item.height) || 760;
      let viewBox = `0 0 ${sourceWidth} ${sourceHeight}`;
      if (cropToInk) {
        const xs = allPoints.map((point) => point.x);
        const ys = allPoints.map((point) => point.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const inkWidth = Math.max(24, maxX - minX);
        const inkHeight = Math.max(24, maxY - minY);
        const padding = Math.max(18, Math.min(70, Math.max(inkWidth, inkHeight) * .1));
        viewBox = `${minX - padding} ${minY - padding} ${inkWidth + padding * 2} ${inkHeight + padding * 2}`;
      }

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("archive-handwriting");
      if (cropToInk) svg.classList.add("archive-handwriting--cutout");
      svg.setAttribute("viewBox", viewBox);
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

    let archivePreviewTimer = 0;
    let archiveAudioContext = null;
    let archivePreviewVoices = [];
    let archivePreviewStage = null;
    let archivePreviewButton = null;
    let archiveCollisionFrame = 0;

    // Keep archive playback in the same music-box family as COMPOSE.
    // Older archive previews used a soft two-oscillator synth, which made a
    // saved handwriting piece sound unrelated to the melody that was made.
    const archiveMusicBoxPitches = [
      523.25, 587.33, 659.25, 783.99, 880,
      1046.5, 1174.66, 1318.51, 1567.98,
    ];
    const archiveMusicBoxProfiles = {
      bright: {
        filter: 8800,
        detune: 8,
        partials: [
          { ratio: 1, gain: .165, decay: 1.85 },
          { ratio: 2.02, gain: .115, decay: 1.2 },
          { ratio: 2.78, gain: .075, decay: .9 },
          { ratio: 5.42, gain: .035, decay: .55 },
        ],
      },
      warm: {
        filter: 5600,
        detune: 5,
        partials: [
          { ratio: .5, gain: .035, decay: 1.45 },
          { ratio: 1, gain: .18, decay: 2.5 },
          { ratio: 2.01, gain: .072, decay: 1.55 },
          { ratio: 2.76, gain: .035, decay: 1.1 },
          { ratio: 5.4, gain: .009, decay: .62 },
        ],
      },
      soft: {
        filter: 4100,
        detune: 3,
        partials: [
          { ratio: .5, gain: .052, decay: 1.7 },
          { ratio: 1, gain: .16, decay: 2.8 },
          { ratio: 2, gain: .045, decay: 1.7 },
          { ratio: 2.72, gain: .016, decay: 1.12 },
        ],
      },
    };

    function stopArchivePreview(stage, button) {
      window.clearTimeout(archivePreviewTimer);
      archivePreviewTimer = 0;
      archivePreviewVoices.forEach(({ gain, oscillator }) => {
        try {
          const now = archiveAudioContext?.currentTime || 0;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(0, now, .02);
          oscillator.stop(now + .08);
        } catch {}
      });
      archivePreviewVoices = [];
      const activeStage = stage || archivePreviewStage;
      const activeButton = button || archivePreviewButton;
      activeStage?.classList.remove("is-playing");
      if (activeButton) {
        activeButton.classList.remove("is-playing");
        if (!activeButton.classList.contains("archive-float-piece")) {
          activeButton.textContent = "FEED + LISTEN";
        }
        activeButton.setAttribute("aria-pressed", "false");
      }
      archivePreviewStage = null;
      archivePreviewButton = null;
    }

    function playArchivePreview(item, stage, button) {
      stopArchivePreview();
      archivePreviewStage = stage;
      archivePreviewButton = button;
      const sourceNotes = Array.isArray(item.notes)
        ? [...item.notes].sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0))
        : [];
      const noteStride = Math.max(1, Math.ceil(sourceNotes.length / 18));
      const notes = sourceNotes.filter((_, index) => index % noteStride === 0).slice(0, 18);
      stage.classList.add("is-playing");
      button.classList.add("is-playing");
      if (!button.classList.contains("archive-float-piece")) {
        button.textContent = "STOP FEED ■";
      }
      button.setAttribute("aria-pressed", "true");

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && notes.length) {
        archiveAudioContext ||= new AudioContextClass();
        archiveAudioContext.resume?.();
        const start = archiveAudioContext.currentTime + .06;
        const xs = notes.map((note) => Number(note.x)).filter(Number.isFinite);
        const minX = xs.length ? Math.min(...xs) : 0;
        const maxX = xs.length ? Math.max(...xs) : 1;
        const rangeX = Math.max(1, maxX - minX);
        const sourceHeight = Number(item.height) || 760;
        const profile = archiveMusicBoxProfiles[item.tone] || archiveMusicBoxProfiles.warm;
        const dryBus = archiveAudioContext.createGain();
        const echo = archiveAudioContext.createDelay(.4);
        const echoGain = archiveAudioContext.createGain();
        const toneFilter = archiveAudioContext.createBiquadFilter();
        dryBus.gain.value = .72;
        echo.delayTime.value = .14;
        echoGain.gain.value = .1;
        toneFilter.type = "lowpass";
        toneFilter.frequency.value = profile.filter;
        toneFilter.Q.value = .35;
        dryBus.connect(toneFilter).connect(archiveAudioContext.destination);
        dryBus.connect(echo).connect(echoGain).connect(toneFilter);
        const usedSteps = new Set();

        notes.forEach((note, index) => {
          const x = Number.isFinite(Number(note.x)) ? Number(note.x) : index * 60;
          const y = Number.isFinite(Number(note.y)) ? Number(note.y) : sourceHeight * .5;
          const timeline = Math.max(0, Math.min(1, (x - minX) / rangeX));
          const step = Math.round(timeline * 18);
          if (usedSteps.has(step)) return;
          usedSteps.add(step);
          const when = start + (step / 18) * 4.8;
          const pitchIndex = Math.max(
            0,
            Math.min(
              archiveMusicBoxPitches.length - 1,
              8 - Math.round((y / sourceHeight) * 8)
            )
          );
          const frequency = archiveMusicBoxPitches[pitchIndex];
          const pitchDecay = Math.max(.78, Math.min(1.2, 920 / frequency));

          profile.partials.forEach((partial) => {
            const oscillator = archiveAudioContext.createOscillator();
            const gain = archiveAudioContext.createGain();
            const partialTone = archiveAudioContext.createBiquadFilter();
            const panner = archiveAudioContext.createStereoPanner
              ? archiveAudioContext.createStereoPanner()
              : null;
            const decay = partial.decay * pitchDecay;

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency * partial.ratio, when);
            oscillator.detune.setValueAtTime(
              (Math.random() - .5) * profile.detune,
              when
            );
            partialTone.type = "lowpass";
            partialTone.frequency.value = profile.filter;
            partialTone.Q.value = .35;
            gain.gain.setValueAtTime(.0001, when);
            gain.gain.exponentialRampToValueAtTime(partial.gain * .82, when + .005);
            gain.gain.exponentialRampToValueAtTime(.0001, when + decay);
            oscillator.connect(gain).connect(partialTone);

            if (panner) {
              panner.pan.value = ((pitchIndex / 8) * 2 - 1) * .12;
              partialTone.connect(panner).connect(dryBus);
            } else {
              partialTone.connect(dryBus);
            }

            oscillator.start(when);
            oscillator.stop(when + decay + .05);
            archivePreviewVoices.push({ oscillator, gain });
          });
        });
      }

      archivePreviewTimer = window.setTimeout(() => stopArchivePreview(), 6100);
    }

    function unlockArchiveCollisionAudio() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      archiveAudioContext ||= new AudioContextClass();
      archiveAudioContext.resume?.();
    }

    function playArchiveCollisionChime(pairIndex) {
      if (!archiveAudioContext || archiveAudioContext.state !== "running") return;
      const now = archiveAudioContext.currentTime;
      const master = archiveAudioContext.createGain();
      const filter = archiveAudioContext.createBiquadFilter();
      const delay = archiveAudioContext.createDelay(.35);
      const echo = archiveAudioContext.createGain();
      master.gain.setValueAtTime(.0001, now);
      master.gain.exponentialRampToValueAtTime(.1, now + .018);
      master.gain.exponentialRampToValueAtTime(.0001, now + .58);
      filter.type = "highpass";
      filter.frequency.value = 640;
      filter.Q.value = .35;
      delay.delayTime.value = .11;
      echo.gain.value = .18;
      master.connect(filter).connect(archiveAudioContext.destination);
      filter.connect(delay).connect(echo).connect(archiveAudioContext.destination);

      const roots = [659.25, 739.99, 783.99, 880];
      const root = roots[pairIndex % roots.length];
      [1, 1.5, 2, 2.5].forEach((ratio, noteIndex) => {
        const oscillator = archiveAudioContext.createOscillator();
        const gain = archiveAudioContext.createGain();
        const start = now + noteIndex * .055;
        oscillator.type = noteIndex % 2 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(root * ratio, start);
        oscillator.detune.setValueAtTime((noteIndex - 1.5) * 3, start);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.028 - noteIndex * .0035, start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .42 + noteIndex * .045);
        oscillator.connect(gain).connect(master);
        oscillator.start(start);
        oscillator.stop(start + .54 + noteIndex * .05);
      });

      window.setTimeout(() => {
        try { master.disconnect(); filter.disconnect(); delay.disconnect(); echo.disconnect(); } catch {}
      }, 1100);
    }

    function showArchiveCollision(stage, first, second, pairIndex) {
      const stageBox = stage.getBoundingClientRect();
      const firstBox = first.getBoundingClientRect();
      const secondBox = second.getBoundingClientRect();
      const spark = document.createElement("span");
      spark.className = "archive-collision-spark";
      spark.style.left = `${((firstBox.left + firstBox.right + secondBox.left + secondBox.right) / 4) - stageBox.left}px`;
      spark.style.top = `${((firstBox.top + firstBox.bottom + secondBox.top + secondBox.bottom) / 4) - stageBox.top}px`;
      for (let sparkIndex = 0; sparkIndex < 9; sparkIndex++) {
        const ray = document.createElement("i");
        ray.style.setProperty("--spark-angle", `${sparkIndex * 40 + (pairIndex % 3) * 7}deg`);
        ray.style.setProperty("--spark-distance", `${16 + (sparkIndex % 4) * 7}px`);
        ray.style.setProperty("--spark-delay", `${(sparkIndex % 3) * 22}ms`);
        spark.appendChild(ray);
      }
      stage.appendChild(spark);
      window.setTimeout(() => spark.remove(), 760);
      playArchiveCollisionChime(pairIndex);
    }

    function startArchivePhysics(stage) {
      if (archiveCollisionFrame) cancelAnimationFrame(archiveCollisionFrame);
      archiveCollisionFrame = 0;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const anchors = [...stage.querySelectorAll(".archive-float-anchor")];
      if (anchors.length < 1) return;
      const bounds = stage.getBoundingClientRect();
      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;
      const states = anchors.map((anchor, index) => {
        const piece = anchor.querySelector(".archive-float-piece");
        const pieceBox = piece.getBoundingClientRect();
        const x = (Number.parseFloat(anchor.style.left) / 100) * bounds.width;
        const y = (Number.parseFloat(anchor.style.top) / 100) * bounds.height;
        const towardCenter = Math.atan2(centerY - y, centerX - x);
        const spread = ((index % 3) - 1) * .28;
        const speed = (28 + (index % 5) * 5.5) * (window.innerWidth <= 650 ? .72 : 1);
        anchor.classList.add("is-physics");
        anchor.style.left = "0px";
        anchor.style.top = "0px";
        const state = {
          anchor,
          piece,
          x,
          y,
          width: pieceBox.width,
          height: pieceBox.height,
          vx: Math.cos(towardCenter + spread) * speed,
          vy: Math.sin(towardCenter + spread) * speed,
          rotation: (index % 2 ? -1 : 1) * (index % 4),
          rotationSpeed: (index % 2 ? -1 : 1) * (.55 + (index % 3) * .18),
          held: false,
        };
        piece.addEventListener("pointerenter", () => { state.held = true; });
        piece.addEventListener("pointerleave", () => { state.held = false; });
        return state;
      });

      const activePairs = new Set();
      let previousTime = performance.now();

      function frame(now) {
        const delta = Math.min(.032, Math.max(.001, (now - previousTime) / 1000));
        previousTime = now;
        const stageWidth = stage.clientWidth;
        const stageHeight = stage.clientHeight;

        states.forEach((state) => {
          if (!state.held) {
            state.x += state.vx * delta;
            state.y += state.vy * delta;
            state.rotation += state.rotationSpeed * delta;
          }
          const halfWidth = state.width * .45;
          const halfHeight = state.height * .45;
          if (state.x < halfWidth) { state.x = halfWidth; state.vx = Math.abs(state.vx); }
          if (state.x > stageWidth - halfWidth) { state.x = stageWidth - halfWidth; state.vx = -Math.abs(state.vx); }
          if (state.y < halfHeight) { state.y = halfHeight; state.vy = Math.abs(state.vy); }
          if (state.y > stageHeight - halfHeight) { state.y = stageHeight - halfHeight; state.vy = -Math.abs(state.vy); }
        });

        const touchingNow = new Set();
        for (let firstIndex = 0; firstIndex < states.length; firstIndex++) {
          for (let secondIndex = firstIndex + 1; secondIndex < states.length; secondIndex++) {
            const first = states[firstIndex];
            const second = states[secondIndex];
            const pairKey = `${firstIndex}:${secondIndex}`;
            const dx = second.x - first.x;
            const dy = second.y - first.y;
            const overlapX = (first.width + second.width) * .39 - Math.abs(dx);
            const overlapY = (first.height + second.height) * .39 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            touchingNow.add(pairKey);

            if (overlapX < overlapY) {
              const direction = dx >= 0 ? 1 : -1;
              if (!first.held) first.x -= overlapX * .5 * direction;
              if (!second.held) second.x += overlapX * .5 * direction;
              if (first.held) second.vx = Math.abs(second.vx) * direction;
              else if (second.held) first.vx = -Math.abs(first.vx) * direction;
              else [first.vx, second.vx] = [second.vx, first.vx];
            } else {
              const direction = dy >= 0 ? 1 : -1;
              if (!first.held) first.y -= overlapY * .5 * direction;
              if (!second.held) second.y += overlapY * .5 * direction;
              if (first.held) second.vy = Math.abs(second.vy) * direction;
              else if (second.held) first.vy = -Math.abs(first.vy) * direction;
              else [first.vy, second.vy] = [second.vy, first.vy];
            }

            if (!activePairs.has(pairKey)) {
              showArchiveCollision(stage, first.piece, second.piece, firstIndex + secondIndex);
            }
          }
        }
        activePairs.clear();
        touchingNow.forEach((key) => activePairs.add(key));

        states.forEach((state) => {
          state.anchor.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) translate(-50%, -50%) rotate(${state.rotation.toFixed(2)}deg)`;
        });
        archiveCollisionFrame = requestAnimationFrame(frame);
      }

      stage.addEventListener("pointerdown", unlockArchiveCollisionAudio, { once: true });
      archiveCollisionFrame = requestAnimationFrame(frame);
    }

    function renderFeedNotes(container, item) {
      container.replaceChildren();
      const notes = Array.isArray(item.notes) && item.notes.length
        ? item.notes.slice(0, 90)
        : Array.from({ length: 16 }, (_, index) => ({ x: index * 70, y: 150 + (index % 5) * 78 }));
      const sourceWidth = Number(item.width) || 1200;
      const sourceHeight = Number(item.height) || 760;

      [0, 1].forEach((copy) => {
        const stream = document.createElement("div");
        stream.className = "archive-note-stream";
        stream.style.left = `${copy * 100}%`;
        notes.forEach((note, index) => {
          const hole = document.createElement("i");
          const shape = ["circle", "star", "heart"].includes(note.shape) ? note.shape : "circle";
          const noteX = Number(note.x);
          const noteY = Number(note.y);
          hole.className = `archive-feed-hole archive-feed-hole--${shape}`;
          hole.style.left = `${Number.isFinite(noteX) ? Math.max(2, Math.min(98, (noteX / sourceWidth) * 96 + 2)) : 4 + (index / Math.max(1, notes.length - 1)) * 92}%`;
          hole.style.top = `${Number.isFinite(noteY) ? Math.max(15, Math.min(85, (noteY / sourceHeight) * 70 + 15)) : 20 + (index % 5) * 15}%`;
          hole.style.setProperty("--hole-size", `${4 + (index % 4)}px`);
          stream.appendChild(hole);
        });
        container.appendChild(stream);
      });
    }

    function renderArchive() {
      stopArchivePreview();
      if (archiveCollisionFrame) cancelAnimationFrame(archiveCollisionFrame);
      archiveCollisionFrame = 0;
      const items = readArchive();
      if (archiveScrollHandler) window.removeEventListener("scroll", archiveScrollHandler);
      archiveScrollHandler = null;
      archiveList.replaceChildren();
      archiveEmpty.hidden = items.length > 0;
      archiveList.hidden = items.length === 0;
      if (!items.length) return;

      const library = document.createElement("div");
      library.className = "archive-library archive-floating-library";

      const stage = document.createElement("div");
      stage.className = "archive-float-stage";
      stage.setAttribute("aria-label", document.documentElement.lang === "ko" ? "떠다니는 손글씨 음악" : "Floating handwriting melodies");

      const intro = document.createElement("div");
      intro.className = "archive-float-intro";
      const introTitle = document.createElement("h1");
      introTitle.innerHTML = t("archiveExploreTitle");
      intro.appendChild(introTitle);
      stage.appendChild(intro);

      const dock = document.createElement("div");
      dock.className = "archive-float-dock";
      dock.hidden = true;
      const dockIndex = document.createElement("span");
      dockIndex.className = "archive-float-dock-index";
      const dockTitle = document.createElement("input");
      dockTitle.className = "archive-float-title";
      dockTitle.type = "text";
      dockTitle.maxLength = 32;
      dockTitle.setAttribute("aria-label", t("archiveName"));
      const dockStatus = document.createElement("span");
      dockStatus.className = "archive-float-status";
      const dockPlayer = document.createElement("a");
      dockPlayer.className = "archive-float-link";
      dockPlayer.textContent = t("archiveOpenPlayer");
      const dockObject = document.createElement("a");
      dockObject.className = "archive-float-link";
      dockObject.textContent = t("archiveMakeObject");
      const dockDelete = document.createElement("button");
      dockDelete.className = "archive-float-delete";
      dockDelete.type = "button";
      dockDelete.textContent = t("archiveDelete");
      dock.append(dockIndex, dockTitle, dockStatus, dockPlayer, dockObject, dockDelete);

      const compactArchive = window.matchMedia("(max-width: 650px)").matches;
      const slots = compactArchive
        ? [[28, 34], [72, 44], [30, 57], [70, 67], [28, 78], [68, 84]]
        : [[66, 20], [38, 34], [77, 48], [14, 55], [53, 63], [27, 76], [80, 74], [8, 35], [57, 43], [37, 57], [86, 31], [44, 82]];
      const archiveGroups = Math.max(1, Math.ceil(items.length / slots.length));
      const archiveViewportHeight = Math.max(compactArchive ? 620 : 680, window.innerHeight - (compactArchive ? 64 : 68));
      stage.style.minHeight = `${archiveGroups * archiveViewportHeight}px`;
      let selectedItem = null;

      function selectItem(item, index, piece) {
        selectedItem = item;
        stage.querySelectorAll(".archive-float-piece.is-selected").forEach((node) => node.classList.remove("is-selected"));
        piece.classList.add("is-selected");
        dock.hidden = false;
        dockIndex.textContent = `${String(index + 1).padStart(2, "0")} / ${item.kind === "HAND" ? "HAND" : "MOUSE"} / ${(item.notes || []).length} NOTES`;
        dockTitle.value = item.title || `${t("archiveUntitled")} ${String(index + 1).padStart(2, "0")}`;
        dockStatus.textContent = t("archivePlaying");
        dockPlayer.href = `player.html?archive=${encodeURIComponent(item.id)}`;
        dockObject.href = `object.html?melody=${encodeURIComponent(item.id)}`;
      }

      items.forEach((item, index) => {
        const slot = slots[index % slots.length];
        const round = Math.floor(index / slots.length);
        const anchor = document.createElement("div");
        anchor.className = "archive-float-anchor";
        anchor.style.left = `${slot[0]}%`;
        anchor.style.top = `${((round * 100 + slot[1]) / archiveGroups).toFixed(3)}%`;
        const motionScale = compactArchive ? .68 : 1;
        const horizontalRange = (34 + (index % 5) * 9) * motionScale;
        const verticalRange = (26 + (index % 4) * 8) * motionScale;
        const direction = index % 2 ? -1 : 1;
        const xPath = slot[0] <= 10
          ? [.42, .92, .58, 1]
          : slot[0] >= 80
            ? [-.42, -.92, -.58, -1]
            : [.82 * direction, -.58 * direction, .44 * direction, -.9 * direction];
        const yPath = slot[1] <= 18
          ? [.35, .82, 1, .55]
          : slot[1] >= 72
            ? [-.35, -.82, -1, -.55]
            : [-.72 * direction, .92 * direction, .48 * direction, -.86 * direction];
        anchor.style.setProperty("--float-duration", `${14 + (index % 5) * 2.15}s`);
        anchor.style.setProperty("--float-delay", `${-(index % 8) * 1.9}s`);
        xPath.forEach((amount, pathIndex) => {
          anchor.style.setProperty(`--float-x${pathIndex + 1}`, `${(horizontalRange * amount).toFixed(1)}px`);
        });
        yPath.forEach((amount, pathIndex) => {
          anchor.style.setProperty(`--float-y${pathIndex + 1}`, `${(verticalRange * amount).toFixed(1)}px`);
        });
        const rotation = (1.8 + (index % 4) * .7) * direction;
        anchor.style.setProperty("--float-r1", `${(-rotation * .55).toFixed(2)}deg`);
        anchor.style.setProperty("--float-r2", `${(rotation * .9).toFixed(2)}deg`);
        anchor.style.setProperty("--float-r3", `${(-rotation).toFixed(2)}deg`);
        anchor.style.setProperty("--float-r4", `${(rotation * .6).toFixed(2)}deg`);

        const piece = document.createElement("button");
        piece.className = "archive-float-piece";
        piece.type = "button";
        piece.dataset.index = String(index);
        piece.setAttribute("aria-pressed", "false");
        const itemTitle = item.title || `${t("archiveUntitled")} ${String(index + 1).padStart(2, "0")}`;
        piece.setAttribute("aria-label", `${itemTitle} · ${t("archivePlay")}`);
        piece.style.setProperty("--piece-size", `${150 + (index % 4) * 28}px`);
        piece.style.setProperty("--piece-tilt", `${(index % 2 ? -1 : 1) * (index % 3) * .8}deg`);

        const ink = document.createElement("span");
        ink.className = "archive-float-ink";
        const hasHandwriting = renderHandwritingPreview(ink, item, item.height || 420, true);
        if (!hasHandwriting) {
          ink.classList.add("archive-float-ink--legacy");
          ink.textContent = itemTitle;
        }
        const caption = document.createElement("span");
        caption.className = "archive-float-caption";
        caption.textContent = itemTitle;
        piece.append(ink, caption);

        piece.addEventListener("pointermove", (event) => {
          const bounds = piece.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / Math.max(1, bounds.width) - .5;
          const y = (event.clientY - bounds.top) / Math.max(1, bounds.height) - .5;
          piece.style.setProperty("--touch-x", `${(x * 9).toFixed(2)}px`);
          piece.style.setProperty("--touch-y", `${(y * 7).toFixed(2)}px`);
          piece.style.setProperty("--touch-r", `${(x * 3.2).toFixed(2)}deg`);
        });
        piece.addEventListener("pointerleave", () => {
          piece.style.removeProperty("--touch-x");
          piece.style.removeProperty("--touch-y");
          piece.style.removeProperty("--touch-r");
        });
        piece.addEventListener("click", () => {
          const wasPlaying = piece.classList.contains("is-playing");
          if (wasPlaying) {
            stopArchivePreview();
            dockStatus.textContent = document.documentElement.lang === "ko" ? "다시 누르면 재생됩니다" : "CLICK AGAIN TO LISTEN";
            return;
          }
          playArchivePreview(item, piece, piece);
          selectItem(item, index, piece);
        });

        anchor.appendChild(piece);
        stage.appendChild(anchor);
      });

      const discoveryPiece = stage.querySelector(".archive-float-piece");
      if (discoveryPiece) {
        discoveryPiece.classList.add("is-discovering");
        const finishDiscovery = () => discoveryPiece.classList.remove("is-discovering");
        window.setTimeout(finishDiscovery, 6200);
        stage.addEventListener("pointerover", (event) => {
          if (event.target.closest?.(".archive-float-piece")) finishDiscovery();
        }, { once: true });
      }

      dockTitle.addEventListener("change", () => {
        if (!selectedItem) return;
        const next = readArchive();
        const found = next.find((saved) => saved.id === selectedItem.id);
        if (!found) return;
        found.title = dockTitle.value.trim() || t("archiveUntitled");
        writeArchive(next);
        renderArchive();
      });
      dockDelete.addEventListener("click", () => {
        if (!selectedItem) return;
        stopArchivePreview();
        writeArchive(readArchive().filter((saved) => saved.id !== selectedItem.id));
        renderArchive();
      });

      stage.appendChild(dock);
      library.appendChild(stage);
      archiveList.appendChild(library);
      requestAnimationFrame(() => startArchivePhysics(stage));
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
      "ORGO — 오르골 구성",
      "",
      `소재: ${configuration.material}`,
      `패키지: ${configuration.packaging}`,
      `곡: ${configuration.melody ? `${configuration.melody.title} (${configuration.melody.notes} NOTES)` : "선택 안 함"}`,
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
