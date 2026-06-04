import { state } from "./state.js";
import { camera, raycaster, mouse } from "./scene.js";
import { enterWordCloudAR } from "./ar-aframe.js";

// ── 2D word cloud canvas ────────────────────────────────────────
function renderWordCloud(canvas, wordMap) {
  const entries = Object.entries(wordMap).sort((a, b) => b[1] - a[1]);
  const W = (canvas.width = canvas.offsetWidth * devicePixelRatio);
  const H = (canvas.height = canvas.offsetHeight * devicePixelRatio);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  const maxProb = entries[0]?.[1] ?? 1;
  const MAX_FONT = W * 0.09;
  const MIN_FONT = W * 0.022;
  const MARGIN = W * 0.02;
  const placed = [];

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  function overlaps(x, y, w, h) {
    const pad = 2;
    for (const r of placed) {
      if (x - pad < r.x + r.w && x + w + pad > r.x && y - pad < r.y + r.h && y + h + pad > r.y) {
        return true;
      }
    }
    return false;
  }

  const cx = W / 2;
  const cy = H / 2;

  for (const [word, prob] of entries) {
    const norm = prob / maxProb;
    const fontSize = MIN_FONT + (MAX_FONT - MIN_FONT) * norm;

    const idx = entries.findIndex(([w]) => w === word);
    const t = idx / Math.max(entries.length - 1, 1);
    const hue = Math.round(t * 220);
    const lum = Math.round(55 - t * 15);

    ctx.font = `${norm > 0.6 ? 700 : 400} ${fontSize.toFixed(1)}px sans-serif`;
    ctx.fillStyle = `hsl(${hue}, 100%, ${lum}%)`;

    const tw = ctx.measureText(word).width;
    const th = fontSize * 1.25;
    let placed_ = false;

    outer: for (let r = 0; r < Math.max(W, H); r += 1.5) {
      const angleStep = Math.max(0.05, 0.4 / (1 + r * 0.012));
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        const x = cx + r * Math.cos(angle) - tw / 2;
        const y = cy + r * Math.sin(angle) - th / 2;

        if (x < MARGIN || y < MARGIN || x + tw > W - MARGIN || y + th > H - MARGIN) continue;

        if (!overlaps(x, y, tw, th)) {
          ctx.fillText(word, x, y + th / 2);
          placed.push({ x, y, w: tw, h: th });
          placed_ = true;
          break outer;
        }
      }
    }

    if (!placed_) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const x = MARGIN + Math.random() * (W - tw - MARGIN * 2);
        const y = MARGIN + Math.random() * (H - th - MARGIN * 2);
        if (!overlaps(x, y, tw, th)) {
          ctx.fillText(word, x, y + th / 2);
          placed.push({ x, y, w: tw, h: th });
          break;
        }
      }
    }
  }
}

let _currentBarData = null;

function applyMobilePopupLayout() {
  const popup = document.getElementById("popup");
  const content = document.getElementById("popup-content");
  if (!popup || !content) return;

  const isMobileLandscape =
    matchMedia("(pointer: coarse)").matches && window.innerWidth > window.innerHeight;

  if (isMobileLandscape) {
    popup.classList.add("popup-mobile-landscape");
    content.style.overflowY = "auto";
    content.style.overflowX = "hidden";
    content.style.webkitOverflowScrolling = "touch";
  } else {
    popup.classList.remove("popup-mobile-landscape");
    content.style.removeProperty("overflow-y");
    content.style.removeProperty("overflow-x");
    content.style.removeProperty("-webkit-overflow-scrolling");
  }
}

window.addEventListener("resize", applyMobilePopupLayout);
window.addEventListener("orientationchange", applyMobilePopupLayout);

export function openBarPopup(barData) {
  _currentBarData = barData;

  const dateStr = barData.date.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });

  const wordMap =
    barData.wordClouds && !Array.isArray(barData.wordClouds)
      ? barData.wordClouds
      : Object.fromEntries(
          (barData.wordClouds ?? []).map((w) =>
            typeof w === "string" ? [w, 1] : [w.word ?? w, w.probability ?? 1]
          )
        );

  const hasWords = Object.keys(wordMap).length > 0;

  const badges = [];
  if (barData.earlyAccess) badges.push(`<span class="badge badge-ea">⚡ Early Access</span>`);
  if (barData.reviewBombed) badges.push(`<span class="badge badge-bomb">⚠ Review Bomb</span>`);

  const arBtn = hasWords
    ? `
      <div id="popup-actions" class="popup-actions">
        <button id="popup-wc-ar-btn" class="btn-enter-wordcloud">
          🔮 View word cloud in AR
        </button>
      </div>
    `
    : "";

  const wcSection = hasWords
    ? `
      <div class="popup-wc-label">
        ${barData.reviewBombed ? "⚠ Review bomb" : "Top review"} keywords
      </div>
      <div class="popup-wc-wrap">
        <canvas id="wc-canvas"></canvas>
      </div>
      ${arBtn}
    `
    : `<div class="popup-no-wc">No word cloud data for this month.</div>`;

  document.getElementById("popup-title").textContent = `${barData.gameName} — ${dateStr}`;

  document.getElementById("popup-content").innerHTML = `
    <div class="popup-badges">
      ${badges.join("") || `<span class="popup-no-flags">No special flags</span>`}
    </div>
    <div class="popup-values">
      <div class="popup-value-card popup-positive">
        <div class="popup-value-num">${(barData.values?.positiv ?? 0).toLocaleString()}</div>
        <div class="popup-value-lbl">Positive</div>
      </div>
      <div class="popup-value-card popup-negative">
        <div class="popup-value-num">${Math.abs(barData.values?.negativ ?? 0).toLocaleString()}</div>
        <div class="popup-value-lbl">Negative</div>
      </div>
    </div>
    ${wcSection}
  `;

  const popup = document.getElementById("popup");
  popup.style.display = "flex";
  popup.style.pointerEvents = "all";

  applyMobilePopupLayout();

  if (hasWords) {
    requestAnimationFrame(() => {
      const canvas = document.getElementById("wc-canvas");
      if (canvas) renderWordCloud(canvas, wordMap);

      document.getElementById("popup-wc-ar-btn")?.addEventListener("click", () => {
        closePopup();
        enterWordCloudAR(wordMap, {
          gameName: barData.gameName,
          date: barData.date.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
          reviewBombed: barData.reviewBombed,
          earlyAccess: barData.earlyAccess,
          positiv: barData.values?.positiv ?? 0,
          negativ: barData.values?.negativ ?? 0
        });
      });
    });
  }
}

export function handleBarClick(e) {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  for (const group of state.rowGroups) {
    const hits = raycaster.intersectObjects(group.children, true);
    if (!hits.length) continue;
    const barData = state.allBars.find((b) => b.mesh === hits[0].object);
    if (barData) {
      openBarPopup(barData);
      return;
    }
  }
}

export function closePopup() {
  const popup = document.getElementById("popup");
  popup.style.display = "none";
  popup.style.pointerEvents = "none";
  popup.classList.remove("popup-mobile-landscape");
  _currentBarData = null;
}
