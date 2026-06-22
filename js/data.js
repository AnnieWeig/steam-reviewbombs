import { state, MAX_BAR_HEIGHT } from "./state.js";
import { scene } from "./scene.js";
import { buildChart, disposeCSS2D } from "./chart.js";
import { spherical, target, updateCamera } from "./camera.js";

let _index = [];
let _visibleIndexCount = 0;

const INITIAL_GAME_LIMIT = 10;
const LOAD_MORE_STEP = 10;
const MAX_LOADED_GAMES = 20;

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

  if (!_index.length) {
    state.loadedJsons = [];
    state.rowGroups = [];
    state.allBars = [];
    _setEmptyState(true);
    _refreshLoadMoreButton();
    return;
  }

  _visibleIndexCount = Math.min(INITIAL_GAME_LIMIT, _index.length);

  const jsons = await Promise.all(
    _index.slice(0, _visibleIndexCount).map((entry) => {
      const url = entry.file ?? `./data/${entry.id}.json`;
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${url}`);
        return r.json();
      });
    })
  );

  state.loadedJsons = [];
  state.rowGroups = [];
  state.allBars = [];

  _initChart(jsons);
  _refreshLoadMoreButton();
}

export async function loadMoreGames() {
  if (_visibleIndexCount >= _index.length) return;

  const slotsAvailable = MAX_LOADED_GAMES - state.loadedJsons.length;
  if (slotsAvailable <= 0) {
    _refreshLoadMoreButton();
    return;
  }

  const nextCount = Math.min(_visibleIndexCount + Math.min(LOAD_MORE_STEP, slotsAvailable), _index.length);
  const nextEntries = _index.slice(_visibleIndexCount, nextCount);

  try {
    const newJsons = await Promise.all(
      nextEntries.map((entry) => {
        const url = entry.file ?? `./data/${entry.id}.json`;
        return fetch(url).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${url}`);
          return r.json();
        });
      })
    );

    if (state.loadedJsons.length === 0) {
      state.loadedJsons = [...newJsons];
      _initChart(state.loadedJsons);
    } else {
      state.loadedJsons.push(...newJsons);
      _recalcScale();
      _rebuildAllRows();
      _refreshActiveGamesList();
      _setEmptyState(false);
    }

    _visibleIndexCount = nextCount;
    _refreshLoadMoreButton();
  } catch (e) {
    console.error("Failed to load more games:", e);
  }
}

function _refreshLoadMoreButton() {
  const btn = document.getElementById("btn-load-more-games");
  if (!btn) return;

  if (state.loadedJsons.length >= MAX_LOADED_GAMES) {
    btn.style.display = "inline-flex";
    btn.disabled = true;
    btn.textContent = `Max ${MAX_LOADED_GAMES} games reached`;
    return;
  }

  const remaining = Math.max(_index.length - _visibleIndexCount, 0);

  if (remaining <= 0) {
    btn.style.display = "none";
    return;
  }

  btn.style.display = "inline-flex";
  btn.disabled = false;
  btn.textContent = `Load more games (${remaining} left)`;
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
    MAX_BAR_HEIGHT /
    Math.max(
      ...jsons.flatMap((j) =>
        j.data.flatMap((d) => [Math.abs(d.values.cusumPositiv ?? 0), Math.abs(d.values.cusumNegativ ?? 0)])
      )
    );
  state.globalTotalWidth = 0;
  state.loadedJsons = [];

  jsons.forEach((json, i) => {
    const { group, totalWidth } = buildChart(json, i * 1.5, state.globalChartT0, state.globalChartScale);
    state.loadedJsons.push(json);
    state.rowGroups.push(group);
    state.globalTotalWidth = Math.max(state.globalTotalWidth, totalWidth);
  });

  _addInitialGrid();

  target.set(state.globalTotalWidth / 2, 0, 0.75);
  spherical.radius = Math.max(state.globalTotalWidth, 1.5) * 0.5;
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

  // Max games loaded reached
  if (state.loadedJsons.length >= MAX_LOADED_GAMES) {
    return {
      ok: false,
      msg: `Maximum of ${MAX_LOADED_GAMES} games reached. Remove a game before adding another.`
    };
  }

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

export function setupLoadMoreButton() {
  const btn = document.getElementById("btn-load-more-games");
  if (!btn) return;
  btn.addEventListener("click", loadMoreGames);
  _refreshLoadMoreButton();
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
  _refreshLoadMoreButton();
}

// ── Helpers ──────────────────────────────────────────────────────

/** Recalculate globalChartScale from all currently loaded games. */
function _recalcScale() {
  const globalMax = Math.max(
    ...state.loadedJsons.flatMap((j) =>
      j.data.flatMap((d) => [Math.abs(d.values.cusumPositiv ?? 0), Math.abs(d.values.cusumNegativ ?? 0)])
    )
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
}

/** Added once on boot — never recreated. */
function _addInitialGrid() {
  const gridSize = Math.ceil(Math.max(state.globalTotalWidth ?? 10, 10) + 4);
  const grid = new THREE.GridHelper(gridSize, gridSize);
  grid.position.set((state.globalTotalWidth ?? 0) / 2, 0, 0.75);
  scene.add(grid);
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
      enterBtn.style.display = "none";
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
      <div class="game-actions">
        <button class="btn-ar" data-ar-id="${json.id}" title="Enter AR with this game">AR</button>
        <button class="btn-danger" data-remove-id="${json.id}" title="Remove">X</button>
      </div>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => removeGame(btn.dataset.removeId));
  });

  container.querySelectorAll("[data-ar-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.arId;
      const json = state.loadedJsons.find((j) => String(j.id) === String(id));
      if (!json) return;
      import("./ar-aframe.js").then(({ enterAFrameARWithGame }) => {
        enterAFrameARWithGame(json);
      });
    });
  });

  if (enterBtn) {
    enterBtn.style.display = "none";
  }
}
