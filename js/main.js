import { scene, renderer, labelRenderer, camera } from "./scene.js";
import { updateCamera } from "./camera.js";
import { setupInteractions } from "./interactions.js"; // ← was missing
import { applyFilter, resetFilter, applyReviewBombFilter } from "./filter.js";
import { closePopup } from "./popup.js";
import { enterAFrameAR, updateAFrameScale } from "./ar-aframe.js";
import { loadData, loadGameDynamic, removeGame, loadMoreGames, setupLoadMoreButton } from "./data.js";
import { state } from "./state.js";

// ── Inject DOM ──────────────────────────────────────────────────
document.body.insertAdjacentHTML(
  "beforeend",
  `

  <!-- Burger button -->
  <button id="burger-btn" title="Filters &amp; Games">☰</button>

  <!-- Click-outside overlay -->
  <div id="menu-overlay"></div>

  <!-- Slide-in panel -->
  <div id="menu-panel">
    <div class="menu-header">
      <span>🎮 Setup &amp; Filters</span>
      <button id="menu-close-btn">✕</button>
    </div>

    <!-- 1 — Add game -->
    <div class="menu-section">
      <h3>➕ Add game by ID or name</h3>
      <div class="filter-row">
        <input type="text" id="game-search-input"
               placeholder="e.g. 965200 or Walking Zombie 2">
      </div>
      <div class="filter-actions">
        <button class="btn-primary" id="btn-game-search">Add game</button>
      </div>
      <div id="search-status" class="search-status"></div>
      <button id="btn-load-more-games" class="btn-secondary" style="display:none; margin-top: 10px; width: 100%;">
        Load more games
      </button>
    </div>

    <!-- 2 — Active games + Enter AR CTA -->
    <div class="menu-section">
      <h3>📊 Active games</h3>
      <div id="active-games-list">
        <div class="no-games-hint">No games loaded yet.</div>
      </div>
      <button id="btn-enter-ar" disabled>🔮 Enter AR</button>
      <p class="panel-hint">
        Add the games you want to compare, set a date range, then tap Enter AR.
      </p>
    </div>

    <!-- 3 — Date range -->
    <div class="menu-section">
      <h3>📅 Date range</h3>
      <div class="filter-row">
        <label>From</label>
        <input type="month" id="filterFrom">
      </div>
      <div class="filter-row">
        <label>To</label>
        <input type="month" id="filterTo">
      </div>
      <div class="filter-actions">
        <button class="btn-primary"   id="btn-apply">Apply</button>
        <button class="btn-secondary" id="btn-reset">Reset</button>
      </div>
    </div>

    <!-- 4 — Review-bomb filter -->
    <div class="menu-section">
      <h3>⚠️ Review bomb filter</h3>
      <div class="toggle-row">
        <span>Show only review-bombed games</span>
        <label class="toggle">
          <input type="checkbox" id="review-bomb-toggle">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 5 — AR chart scale -->
    <div class="menu-section">
      <h3>🔍 AR chart scale</h3>
      <div class="scale-row">
        <input id="aframe-scale-slider" type="range" min="1" max="10" value="5">
        <span id="aframe-scale-val">5</span>
      </div>
      <p class="panel-hint">Adjust if bars appear too small on the Hiro marker.</p>
    </div>

    <!-- 6 — Hiro marker link -->
    <div class="menu-section">
      <a href="https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png"
         target="_blank" class="marker-link">📄 Open / print Hiro marker</a>
    </div>
  </div>

 <!-- Legend toggle button -->
  <button id="legend-btn" title="Show legend">🎨</button>

  <!-- Legend panel (hidden by default) -->
  <div id="color-legend">
    <div class="legend-header">
      <span>Legend</span>
      <button id="legend-close-btn">✕</button>
    </div>
    <div class="legend-row">
      <div class="legend-swatch" style="background:#00dd00"></div>
      <span>Positive reviews</span>
    </div>
    <div class="legend-row">
      <div class="legend-swatch" style="background:#00aaff"></div>
      <span>Negative reviews</span>
    </div>
    <div class="legend-row">
      <div class="legend-swatch"
           style="background:#88dd88;opacity:.6;border:1px dashed #aaa"></div>
      <span>Early Access (positive)</span>
    </div>
    <div class="legend-row">
      <div class="legend-swatch"
           style="background:#88ccff;opacity:.6;border:1px dashed #aaa"></div>
      <span>Early Access (negative)</span>
    </div>
    <div class="legend-row">
      <div class="legend-swatch" style="background:#ff2200;opacity:.85"></div>
      <span>Review bombed</span>
    </div>
  </div>

  <!-- Bar detail popup -->
  <div id="popup">
    <div style="display:flex;justify-content:space-between;
                align-items:center;margin-bottom:16px">
      <span id="popup-title"
            style="font-size:15px;font-weight:500;color:#00aaff"></span>
      <button id="popup-close"
        style="background:none;border:none;color:white;font-size:20px;
               cursor:pointer;padding:0 0 0 16px">✕</button>
    </div>
    <div id="popup-content"
         style="font-size:13px;line-height:1.7;color:#ccc"></div>
  </div>

  <!-- Touch hint -->
  <div id="touch-hint">
    1 finger: pan &nbsp;|&nbsp; 2 fingers: zoom &nbsp;|&nbsp;
    long-press: drag row &nbsp;|&nbsp; tap: details
  </div>
`
);

// ── Burger menu ─────────────────────────────────────────────────
const openMenu = () => {
  document.getElementById("menu-panel").classList.add("open");
  document.getElementById("menu-overlay").classList.add("open");
};
const closeMenu = () => {
  document.getElementById("menu-panel").classList.remove("open");
  document.getElementById("menu-overlay").classList.remove("open");
};
document.getElementById("burger-btn").addEventListener("click", openMenu);
document.getElementById("menu-close-btn").addEventListener("click", closeMenu);
document.getElementById("menu-overlay").addEventListener("click", closeMenu);

// ── Legend toggle ───────────────────────────────────────────────
const legendPanel = document.getElementById("color-legend");
document.getElementById("legend-btn").addEventListener("click", () => {
  legendPanel.classList.toggle("open");
});
document.getElementById("legend-close-btn").addEventListener("click", () => {
  legendPanel.classList.remove("open");
});

// ── Active games list ───────────────────────────────────────────
export function refreshActiveGamesList() {
  const container = document.getElementById("active-games-list");
  const enterBtn = document.getElementById("btn-enter-ar");
  const n = state.loadedJsons.length;

  if (!n) {
    container.innerHTML = `<div class="no-games-hint">No games loaded yet.</div>`;
    enterBtn.disabled = true;
    enterBtn.textContent = "🔮 Enter AR";
    return;
  }

  container.innerHTML = state.loadedJsons
    .map(
      (json) => `
    <div class="active-game-entry">
      <div class="game-info">
        <div class="g-name">${json.name ?? "Unknown"}</div>
        <div class="g-id">ID: ${json.id ?? "—"}</div>
      </div>
      <button class="btn-danger" data-remove-id="${json.id}">✕</button>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeGame(btn.dataset.removeId);
      refreshActiveGamesList();
    });
  });

  enterBtn.disabled = false;
  enterBtn.textContent = `🔮 Enter AR with ${n} game${n !== 1 ? "s" : ""}`;
}

document.getElementById("btn-enter-ar").addEventListener("click", () => {
  closeMenu();
  enterAFrameAR();
});

// ── Game search ─────────────────────────────────────────────────
async function doGameSearch() {
  const input = document.getElementById("game-search-input");
  const status = document.getElementById("search-status");
  const query = input.value.trim();
  if (!query) {
    status.className = "search-status error";
    status.textContent = "Please enter a name or ID.";
    return;
  }
  status.className = "search-status info";
  status.textContent = "⏳ Searching…";
  const result = await loadGameDynamic(query);
  status.className = "search-status " + (result.ok ? "ok" : "error");
  status.textContent = result.msg;
  if (result.ok) {
    input.value = "";
    refreshActiveGamesList();
  }
}
document.getElementById("btn-game-search").addEventListener("click", doGameSearch);
document.getElementById("game-search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doGameSearch();
});

// ── Filters ─────────────────────────────────────────────────────
document.getElementById("btn-apply").addEventListener("click", applyFilter);
document.getElementById("btn-reset").addEventListener("click", () => {
  resetFilter();
  applyReviewBombFilter(false);
  document.getElementById("review-bomb-toggle").checked = false;
});
document
  .getElementById("review-bomb-toggle")
  .addEventListener("change", (e) => applyReviewBombFilter(e.target.checked));

// ── AR scale ────────────────────────────────────────────────────
document.getElementById("aframe-scale-slider").addEventListener("input", (e) => updateAFrameScale(e.target.value));

// ── Other UI ─────────────────────────────────────────────────────
document.getElementById("popup-close").addEventListener("click", closePopup);

if (matchMedia("(pointer: coarse)").matches) document.getElementById("touch-hint").style.display = "block";

// Landscape mode
function updateOrientationHint() {
  let el = document.getElementById("rotate-device-hint");
  if (!el) {
    el = document.createElement("div");
    el.id = "rotate-device-hint";
    el.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.92);
      color: white;
      font: 600 18px sans-serif;
      text-align: center;
      padding: 24px;
    `;
    el.innerHTML = `📱 Please rotate your device to landscape`;
    document.body.appendChild(el);
  }

  const isMobile = matchMedia("(pointer: coarse)").matches;
  const isPortrait = innerHeight > innerWidth;
  el.style.display = isMobile && isPortrait ? "flex" : "none";
}

window.addEventListener("resize", updateOrientationHint);
window.addEventListener("orientationchange", updateOrientationHint);
updateOrientationHint();

// ── Resize ───────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);
  labelRenderer.setSize(innerWidth, innerHeight);
  updateCamera();
});

// ── Interactions ─────────────────────────────────────────────────
setupInteractions(); // ← was missing — restores camera pan/zoom + bar drag

// ── Render loop ──────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();

// ── Boot ─────────────────────────────────────────────────────────
setupLoadMoreButton();
loadData().then(() => refreshActiveGamesList());
