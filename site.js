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
      archiveList.replaceChildren();
      archiveEmpty.hidden = items.length > 0;
      archiveList.hidden = items.length === 0;

      items.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "archive-card";

        const preview = document.createElement("div");
        preview.className = "archive-preview";
        const height = item.height || 420;
        const hasHandwriting = renderHandwritingPreview(preview, item, height);

        if (!hasHandwriting) {
          preview.classList.add("archive-preview--legacy");
          const legacy = document.createElement("span");
          legacy.className = "archive-preview-legacy";
          legacy.textContent = "WRITING PREVIEW";
          preview.appendChild(legacy);
        }

        const body = document.createElement("div");
        body.className = "archive-card-body";
        const meta = document.createElement("div");
        meta.className = "archive-card-meta";
        meta.textContent = `${item.kind === "HAND" ? "HAND" : "MOUSE"} / ${formatDate(item.createdAt)}`;

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
        details.textContent = `${(item.notes || []).length} NOTES`;
        const actions = document.createElement("div");
        actions.className = "archive-card-actions";
        const play = document.createElement("a");
        play.className = "archive-play";
        play.href = `compose.html?archive=${encodeURIComponent(item.id)}`;
        play.textContent = t("archiveOpenPlayer");
        const remove = document.createElement("button");
        remove.className = "archive-delete";
        remove.type = "button";
        remove.textContent = t("archiveDelete");
        remove.addEventListener("click", () => {
          const next = readArchive().filter((saved) => saved.id !== item.id);
          writeArchive(next);
          renderArchive();
        });

        actions.append(play, remove);
        body.append(meta, title, details, actions);
        card.append(preview, body);
        archiveList.appendChild(card);
      });
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

  function selectedValue(name) {
    const selected = document.querySelector(
      `input[name="${name}"]:checked`
    );

    return selected ? selected.value : "";
  }

  function getConfiguration() {
    return {
      material: selectedValue("material"),
      packaging: selectedValue("packaging"),
      engraving: engraving.value.trim(),
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

  saveButton.addEventListener("click", () => {
    const configuration = getConfiguration();

    const contents = [
      "ORGO — 나의 오르골 구성",
      "",
      `소재: ${configuration.material}`,
      `패키지: ${configuration.packaging}`,
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

  updatePreview();
})();
