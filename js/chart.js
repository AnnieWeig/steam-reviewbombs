import { CSS2DObject } from "./css2d.js";
import { scene } from "./scene.js";
import { state, MAX_BAR_HEIGHT, getBarColor } from "./state.js";

// ── Row selection ────────────────────────────────────────────────
const _allGroups = [];

export function selectRow(targetGroup) {
  _allGroups.forEach((g) => {
    const isSelected = g === targetGroup;
    (g.userData.detailLabels ?? []).forEach((div) => {
      div.style.visibility = isSelected ? "visible" : "hidden";
    });
    if (g.userData.nameLabelEl) {
      g.userData.nameLabelEl.style.opacity = isSelected ? "1" : "0.4";
      g.userData.nameLabelEl.style.fontWeight = isSelected ? "bold" : "normal";
    }
  });
}

export function clearRowSelection() {
  _allGroups.forEach((g) => {
    (g.userData.detailLabels ?? []).forEach((div) => {
      div.style.visibility = "hidden";
    });
    if (g.userData.nameLabelEl) {
      g.userData.nameLabelEl.style.opacity = "1";
      g.userData.nameLabelEl.style.fontWeight = "normal";
    }
  });
}

export function buildChart(json, zOffset = 0, globalT0 = null, scale = 0.01) {
  const dataPoints = [...json.data].sort((a, b) => new Date(a.time) - new Date(b.time));
  const keys = ["cusumPositiv", "cusumNegativ"];
  const GROUP_SPACING = 0.44;
  const BAR_W = 0.36;
  const t0 = globalT0 ?? new Date(dataPoints[0].time).getTime();

  const group = new THREE.Group();
  group.position.z = zOffset;
  group.userData.zOffset = zOffset;
  group.userData.gameName = json.name;
  group.userData.gameId = json.id;
  group.userData.detailLabels = []; // ← required for selectRow/clearRowSelection

  _allGroups.push(group);

  // Game name label — always visible
  const nameDiv = document.createElement("div");
  nameDiv.className = "label-z";
  nameDiv.textContent = json.name ?? "Dataset";
  const nameLbl = new CSS2DObject(nameDiv);
  nameLbl.position.set(-2, 0.5, 0);
  group.add(nameLbl);
  group.userData.nameLabelEl = nameDiv; // ← ref for opacity highlight

  // Helper: create a detail label hidden by default
  const addDetail = (text, x, y, cssClass, extraStyle = {}) => {
    const div = document.createElement("div");
    div.className = cssClass;
    div.textContent = text;
    Object.assign(div.style, { visibility: "hidden", ...extraStyle }); // ← visibility not display
    const lbl = new CSS2DObject(div);
    lbl.position.set(x, y, 0);
    group.add(lbl);
    group.userData.detailLabels.push(div); // ← store the div
  };

  dataPoints.forEach((d, di) => {
    const t = new Date(d.time).getTime();
    const x = ((t - t0) / (1000 * 60 * 60 * 24 * 30.44)) * GROUP_SPACING;
    const ea = !!d.earlyAccess;

    keys.forEach((key, j) => {
      const value = d.values[key];
      const height = Math.abs(value) * scale;
      const color = getBarColor(j, ea, d.reviewBombed);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(BAR_W, height, BAR_W),
        new THREE.MeshLambertMaterial({
          color,
          transparent: true,
          opacity: d.reviewBombed ? 0.82 : ea ? 0.58 : 1.0
        })
      );
      bar.position.set(x, value >= 0 ? height / 2 : -height / 2, 0);
      group.add(bar);
      // value label — shown only when row is selected
      const valDiv = document.createElement("div");
      valDiv.className = "label-value";
      valDiv.textContent = Math.round(value).toLocaleString();
      Object.assign(valDiv.style, { visibility: "hidden" });
      const valLbl = new CSS2DObject(valDiv);
      valLbl.position.set(x, value > 0 ? height + 0.15 : -height - 0.15, 0);
      group.add(valLbl);
      group.userData.detailLabels.push(valDiv);
      state.allBars.push({
        mesh: bar,
        date: new Date(d.time),
        group,
        reviewBombed: !!d.reviewBombed,
        earlyAccess: ea,
        wordClouds: d.wordClouds ?? [],
        gameName: json.name,
        gameId: json.id,
        values: d.values
      });
    });

    // ── Early Access span labels ─────────────────────────────
    if (ea && (di === 0 || !dataPoints[di - 1].earlyAccess))
      addDetail("▶ Early Access", x, MAX_BAR_HEIGHT + 0.25, "label-ea", { color: "#aaffaa" });

    if (!ea && di > 0 && !!dataPoints[di - 1].earlyAccess)
      addDetail("◀ EA ended", x, MAX_BAR_HEIGHT + 0.25, "label-ea", { color: "#aaffaa" });

    // ── Review bomb span labels ───────────────────────────────
    const prevBombed = di > 0 && !!dataPoints[di - 1].reviewBombed;
    const nextBombed = di < dataPoints.length - 1 && !!dataPoints[di + 1].reviewBombed;

    if (d.reviewBombed && !prevBombed) {
      // Start of a bomb span
      addDetail("⚠ Review bomb", x, MAX_BAR_HEIGHT + 0.6, "label-bomb");
    }

    if (d.reviewBombed && !nextBombed && prevBombed) {
      // End of a multi-bar span — add closing marker
      addDetail("◀ RB ended", x, MAX_BAR_HEIGHT + 0.6, "label-bomb", { color: "#ff4422" });
    }
  });

  scene.add(group);

  const times = dataPoints.map((d) => new Date(d.time).getTime());
  const span = (Math.max(...times) - t0) / (1000 * 60 * 60 * 24 * 30.44);
  const totalWidth = span * GROUP_SPACING;
  const maxValue = Math.max(...dataPoints.flatMap((d) => Object.values(d.values).map(Math.abs))) * scale;

  return { group, totalWidth, maxValue };
}

// ── Y-axis labels ────────────────────────────────────────────────
export function addYLabels(allJson, axisX, axisZ, scale) {
  const group = new THREE.Group();
  const maxVal = Math.max(...allJson.flatMap((j) => j.data.flatMap((d) => Object.values(d.values).map(Math.abs))));
  const step = Math.ceil(maxVal / 5 / 100) * 100;

  // How wide to draw the lines — cover the full chart
  const totalWidth =
    Math.max(
      ...allJson.flatMap((j) => {
        const times = j.data.map((d) => new Date(d.time).getTime());
        return [((Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60 * 24 * 30.44)) * 1.2];
      })
    ) + 4;

  for (let v = -maxVal; v <= maxVal; v += step) {
    if (v === 0) continue;
    const y = v * scale;

    // ── Gridline ──────────────────────────────────────────────
    const mat = new THREE.LineBasicMaterial({
      color: v > 0 ? 0x224422 : 0x442222,
      transparent: true,
      opacity: 0.5
    });
    const points = [new THREE.Vector3(axisX, y, axisZ), new THREE.Vector3(axisX + totalWidth, y, axisZ)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
    group.add(line);

    // ── Label at left end of line ─────────────────────────────
    const div = document.createElement("div");
    div.className = "label-y";
    div.textContent = Math.round(v).toLocaleString();
    const lbl = new CSS2DObject(div);
    lbl.position.set(axisX - 0.2, y, axisZ);
    group.add(lbl);
  }

  scene.add(group);
  return group;
}

export function makeLabel(text, pos, cssClass = "label") {
  const div = document.createElement("div");
  div.className = cssClass;
  div.textContent = text;
  const lbl = new CSS2DObject(div);
  lbl.position.set(pos.x, pos.y, pos.z);
  scene.add(lbl);
  return lbl;
}

// ── Dispose helpers ──────────────────────────────────────────────
export function disposeCSS2D(object) {
  object.traverse((child) => {
    if (child instanceof CSS2DObject && child.element?.parentNode) {
      child.element.parentNode.removeChild(child.element);
    }
  });
}

export function disposeGroup(group) {
  const idx = _allGroups.indexOf(group);
  if (idx !== -1) _allGroups.splice(idx, 1); // ← remove from tracking

  state.allBars = state.allBars.filter((b) => {
    if (b.group !== group) return true;
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
    return false;
  });
  disposeCSS2D(group);
  scene.remove(group);
}
