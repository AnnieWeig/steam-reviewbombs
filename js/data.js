import { state, MAX_BAR_HEIGHT } from "./state.js";
import { scene } from "./scene.js";
import { buildChart, addYLabels, disposeCSS2D } from "./chart.js";
import { spherical, target, updateCamera } from "./camera.js";

let _index = [];

export async function loadIndex() {
  try {
    _index = await fetch("./data/index.json").then((r) => r.json());
  } catch {
    _index = [];
    console.warn("data/index.json not found — game search will be unavailable.");
  }
  return _index;
}

export function getIndex() {
  return _index;
}

// ── Initial load ─────────────────────────────────────────────────
export async function loadData() {
  await loadIndex();

  const [json1, json2] = await Promise.all([
    fetch("./data/data.json").then((r) => r.json()),
    fetch("./data/data2.json").then((r) => r.json())
  ]);

  state.loadedJsons = [];
  state.rowGroups = [];
  state.allBars = [];

  _initChart([json1, json2]);
}

function _initChart(jsons) {
  const allDates = jsons.flatMap((j) => j.data.map((d) => new Date(d.time)));
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const toMonth = (d) => d.toISOString().slice(0, 7);
  document.getElementById("filterFrom").value = toMonth(minDate);
  document.getElementById("filterTo").value = toMonth(maxDate);

  state.globalChartT0 = Math.min(...allDates);
  state.globalChartScale =
    MAX_BAR_HEIGHT / Math.max(...jsons.flatMap((j) => j.data.flatMap((d) => Object.values(d.values).map(Math.abs))));
  state.globalTotalWidth = 0;
  state.loadedJsons = [];

  jsons.forEach((json, i) => {
    const { group, totalWidth } = buildChart(json, i * 1.5, state.globalChartT0, state.globalChartScale);
    state.loadedJsons.push(json);
    state.rowGroups.push(group);
    state.globalTotalWidth = Math.max(state.globalTotalWidth, totalWidth);
  });

  _addInitialGrid();
  _addYLabels(state.loadedJsons);

  target.set(state.globalTotalWidth / 2, 0, 0.75);
  spherical.radius = Math.max(state.globalTotalWidth, 1.5) * 0.8;
  updateCamera();

  _refreshActiveGamesList();
  _setEmptyState(false);
}

// ── Dynamic add ──────────────────────────────────────────────────
export async function loadGameDynamic(idOrName) {
  const query = String(idOrName).trim().toLowerCase();
  if (!query) return { ok: false, msg: "Please enter a name or ID." };

  const alreadyLoaded = state.loadedJsons.find(
    (j) => String(j.id).toLowerCase() === query || (j.name ?? "").toLowerCase() === query
  );
  if (alreadyLoaded) return { ok: false, msg: `"${alreadyLoaded.name}" is already shown.` };

  const entry = _index.find((e) => String(e.id).toLowerCase() === query || (e.name ?? "").toLowerCase() === query);
  if (!entry) return { ok: false, msg: `No game found for "${idOrName}".` };

  let json;
  try {
    const url = entry.file ?? `./data/${entry.id}.json`;
    json = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  } catch (e) {
    return { ok: false, msg: `Failed to load data for "${entry.name}": ${e.message}` };
  }

  // First game after a full clear — reinitialise t0 + date inputs
  if (state.loadedJsons.length === 0) {
    const allDates = json.data.map((d) => new Date(d.time).getTime());
    state.globalChartT0 = Math.min(...allDates);
    const toMonth = (ms) => new Date(ms).toISOString().slice(0, 7);
    document.getElementById("filterFrom").value = toMonth(Math.min(...allDates));
    document.getElementById("filterTo").value = toMonth(Math.max(...allDates));
  }

  state.loadedJsons.push(json);
  _recalcScale();
  _rebuildAllRows();

  target.set(state.globalTotalWidth / 2, 0, 0.75);
  spherical.radius = Math.max(state.globalTotalWidth, 1.5) * 0.8;
  updateCamera();

  _refreshActiveGamesList();
  _setEmptyState(false);

  return { ok: true, msg: `"${json.name}" added.` };
}

// ── Dynamic remove ───────────────────────────────────────────────
export function removeGame(gameId) {
  const idx = state.loadedJsons.findIndex((j) => String(j.id) === String(gameId));
  if (idx === -1) return;

  state.loadedJsons.splice(idx, 1);

  if (state.loadedJsons.length === 0) {
    _clearAll();
    return;
  }

  _recalcScale();
  _rebuildAllRows();
  _refreshActiveGamesList();
}

// ── Helpers ──────────────────────────────────────────────────────

/** Recalculate globalChartScale from all currently loaded games. */
function _recalcScale() {
  const globalMax = Math.max(
    ...state.loadedJsons.flatMap((j) => j.data.flatMap((d) => Object.values(d.values).map(Math.abs)))
  );
  state.globalChartScale = MAX_BAR_HEIGHT / globalMax;
}

/** Dispose all current row groups and rebuild them at the current scale. */
function _rebuildAllRows() {
  // Dispose all existing groups + their DOM labels
  for (const group of state.rowGroups) {
    disposeCSS2D(group);
    scene.remove(group);
  }
  state.rowGroups = [];
  state.allBars = [];
  state.globalTotalWidth = 0;

  // Rebuild
  state.loadedJsons.forEach((json, i) => {
    const { group, totalWidth } = buildChart(json, i * 1.5, state.globalChartT0, state.globalChartScale);
    state.rowGroups.push(group);
    state.globalTotalWidth = Math.max(state.globalTotalWidth, totalWidth);
  });

  _addYLabels(state.loadedJsons);
}

/** Added once on boot — never recreated. */
function _addInitialGrid() {
  const gridSize = Math.ceil(Math.max(state.globalTotalWidth ?? 10, 10) + 4);
  const grid = new THREE.GridHelper(gridSize, gridSize);
  grid.position.set((state.globalTotalWidth ?? 0) / 2, 0, 0.75);
  scene.add(grid);
}

function _addYLabels(jsons) {
  if (state.yLabelGroup) {
    disposeCSS2D(state.yLabelGroup);
    scene.remove(state.yLabelGroup);
    state.yLabelGroup = null;
  }
  state.yLabelGroup = addYLabels(jsons, -1.5, 0.75, state.globalChartScale);
}

function _clearAll() {
  // Dispose all row groups + their labels
  for (const group of state.rowGroups) {
    disposeCSS2D(group);
    scene.remove(group);
  }
  state.rowGroups = [];

  // Dispose Y labels
  if (state.yLabelGroup) {
    disposeCSS2D(state.yLabelGroup);
    scene.remove(state.yLabelGroup);
    state.yLabelGroup = null;
  }

  state.allBars = [];
  state.globalTotalWidth = 0;
  state.globalChartT0 = 0;
  state.globalChartScale = 1;

  document.getElementById("filterFrom").value = "";
  document.getElementById("filterTo").value = "";

  _refreshActiveGamesList();
  _setEmptyState(true);
}

function _setEmptyState(empty) {
  let el = document.getElementById("empty-state");
  if (!el) {
    el = document.createElement("div");
    el.id = "empty-state";
    el.innerHTML = `<div class="empty-icon">📊</div>
                    <div class="empty-msg">No games loaded</div>
                    <div class="empty-hint">Open ☰ and add a game to get started</div>`;
    document.body.appendChild(el);
  }
  el.style.display = empty ? "flex" : "none";
}

export function _refreshActiveGamesList() {
  const container = document.getElementById("active-games-list");
  const enterBtn = document.getElementById("btn-enter-ar");
  if (!container) return;

  if (!state.loadedJsons.length) {
    container.innerHTML = `<div class="no-games-hint">No games loaded yet.</div>`;
    if (enterBtn) {
      enterBtn.disabled = true;
      enterBtn.textContent = "🔮 Enter AR";
    }
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
    btn.addEventListener("click", () => removeGame(btn.dataset.removeId));
  });

  const n = state.loadedJsons.length;
  if (enterBtn) {
    enterBtn.disabled = false;
    enterBtn.textContent = `🔮 Enter AR with ${n} game${n !== 1 ? "s" : ""}`;
  }
}
