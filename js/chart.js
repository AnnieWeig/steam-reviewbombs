import { CSS2DObject } from "./css2d.js";
import { scene } from "./scene.js";
import { state, MAX_BAR_HEIGHT, getBarColor } from "./state.js";

export function buildChart(json, zOffset = 0, globalT0 = null, scale = 0.01) {
  const dataPoints = [...json.data].sort((a, b) => new Date(a.time) - new Date(b.time));
  const keys = Object.keys(dataPoints[0].values);
  const GROUP_SPACING = 1.2;
  const BAR_W = 0.8;
  const t0 = globalT0 ?? new Date(dataPoints[0].time).getTime();

  const group = new THREE.Group();
  group.position.z = zOffset;
  group.userData.zOffset = zOffset;
  group.userData.gameName = json.name;
  group.userData.gameId = json.id;

  const nameDiv = document.createElement("div");
  nameDiv.className = "label-z";
  nameDiv.textContent = json.name ?? "Dataset";
  const nameLbl = new CSS2DObject(nameDiv);
  nameLbl.position.set(-2, 0.5, 0);
  group.add(nameLbl);

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

    if (d.reviewBombed) {
      const div = document.createElement("div");
      div.className = "label-bomb";
      div.textContent = "⚠ bombed";
      const lbl = new CSS2DObject(div);
      lbl.position.set(x, MAX_BAR_HEIGHT + 0.6, 0);
      group.add(lbl);
    }

    if (ea && (di === 0 || !dataPoints[di - 1].earlyAccess)) {
      const div = document.createElement("div");
      div.className = "label-ea";
      div.textContent = "▶ Early Access";
      const lbl = new CSS2DObject(div);
      lbl.position.set(x, MAX_BAR_HEIGHT + 0.25, 0);
      group.add(lbl);
    }

    if (!ea && di > 0 && !!dataPoints[di - 1].earlyAccess) {
      const div = document.createElement("div");
      div.className = "label-ea";
      div.textContent = "◀ EA ended";
      div.style.color = "#aaffaa";
      const lbl = new CSS2DObject(div);
      lbl.position.set(x, MAX_BAR_HEIGHT + 0.25, 0);
      group.add(lbl);
    }

    const div = document.createElement("div");
    div.className = "label-x";
    div.textContent = new Date(d.time).toLocaleDateString("de-DE", {
      month: "short",
      year: "2-digit"
    });
    Object.assign(div.style, {
      transform: "rotate(-90deg)",
      transformOrigin: "center",
      fontSize: "10px",
      background: "transparent",
      padding: "0"
    });
    const lbl = new CSS2DObject(div);
    lbl.position.set(x, 0.2, 0);
    group.add(lbl);
  });

  scene.add(group);

  const times = dataPoints.map((d) => new Date(d.time).getTime());
  const span = (Math.max(...times) - t0) / (1000 * 60 * 60 * 24 * 30.44);
  const totalWidth = span * GROUP_SPACING;
  const maxValue = Math.max(...dataPoints.flatMap((d) => Object.values(d.values).map(Math.abs))) * scale;

  return { group, totalWidth, maxValue };
}

// ── Y-axis labels ───────────────────────────────────────────────
// Returns the group so the caller can store it and remove it later.
export function addYLabels(allJson, axisX, axisZ, scale) {
  const group = new THREE.Group();

  const maxVal = Math.max(...allJson.flatMap((j) => j.data.flatMap((d) => Object.values(d.values).map(Math.abs))));
  const step = Math.ceil(maxVal / 5 / 100) * 100;

  for (let v = -maxVal; v <= maxVal; v += step) {
    const div = document.createElement("div");
    div.className = "label-y";
    div.textContent = v.toLocaleString();
    const lbl = new CSS2DObject(div);
    lbl.position.set(axisX, v * scale, axisZ);
    group.add(lbl);
  }

  scene.add(group);
  return group; // ← caller stores this in state.yLabelGroup
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

/** Recursively remove every CSS2DObject's DOM element under an object. */
export function disposeCSS2D(object) {
  object.traverse((child) => {
    if (child instanceof CSS2DObject && child.element?.parentNode) {
      child.element.parentNode.removeChild(child.element);
    }
  });
}

export function disposeGroup(group) {
  state.allBars = state.allBars.filter((b) => {
    if (b.group !== group) return true;
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
    return false;
  });
  disposeCSS2D(group);
  scene.remove(group);
}
