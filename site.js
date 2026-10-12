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
      experience.style.setProperty("--archive-min-height", `${Math.max(items.length, 5) * 142}px`);

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
      const paperHoles = document.createElement("div");
      paperHoles.className = "archive-paper-holes";
      paper.appendChild(paperHoles);
      const box = document.createElement("img");
      box.className = "archive-music-box";
      box.src = "archive-music-box-mechanism-cutout.png";
      box.alt = "";
      stage.append(stageLabel, stageCount, paper, box);

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
      const updateScrollMotion = () => {
        const range = Math.max(1, experience.offsetHeight - window.innerHeight);
        const progress = Math.max(0, Math.min(1, -experience.getBoundingClientRect().top / range));
        experience.style.setProperty("--archive-progress", progress.toFixed(3));
        experience.style.setProperty("--archive-paper-offset", `${(-progress * 170).toFixed(1)}px`);
        experience.style.setProperty("--archive-orbit-one", `${(-13 + progress * 28).toFixed(1)}deg`);
        experience.style.setProperty("--archive-orbit-two", `${(12 - progress * 24).toFixed(1)}deg`);
        experience.style.setProperty("--archive-box-angle", `${(-2 + progress * 4).toFixed(1)}deg`);
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
