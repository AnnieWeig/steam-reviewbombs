import { state, MAX_BAR_HEIGHT, getBarColorHex } from "./state.js";

let aframeIframe = null;
let aframeExitBtn = null;
let aframeScale = 3;

async function tryLockLandscape() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
    }
  } catch (err) {
    console.log("Landscape lock not available:", err?.message ?? err);
  }
}

export function toggleAFrameAR() {
  aframeIframe ? exitAFrameAR() : enterAFrameAR();
}

export function updateAFrameScale(val) {
  aframeScale = Number(val);
  document.getElementById("aframe-scale-val").textContent = val;
  if (aframeIframe) {
    exitAFrameAR();
    setTimeout(enterAFrameAR, 200);
  }
}

export function enterWordCloudAR(wordMap, meta) {
  tryLockLandscape();
  _openIframe(buildWordCloudHTML(wordMap, meta), "❌ Exit Word Cloud AR");
}

function buildWordCloudHTML(wordMap, meta) {
  const entries = Object.entries(wordMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35);

  const maxProb = entries[0]?.[1] ?? 1;
  const isBombed = !!meta.reviewBombed;

  const CLOUD_BASE = 0.5;
  const ROW_GAP = 0.15;
  const WORD_PAD = 0.03;

  function wordColor(t) {
    const hue = Math.round(t * 220);
    const sat = 100;
    const lum = Math.round(55 - t * 15);
    return `hsl(${hue},${sat}%,${lum}%)`;
  }

  function wordOpacity(norm) {
    return (0.4 + norm * 0.6).toFixed(2);
  }

  function escHtml(s = "") {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const sized = entries.map(([word, prob], i) => {
    const norm = prob / maxProb;
    const scale = 0.45 + Math.pow(norm, 0.7) * 0.55;
    const h = scale * 0.11;
    const w = word.length * h * 0.58 + h * 0.5;
    const t = i / Math.max(entries.length - 1, 1);
    return { word, norm, scale, h, w, color: wordColor(t), opacity: wordOpacity(norm) };
  });

  const rows = [];
  let idx = 0;
  for (let rowNum = 0; idx < sized.length; rowNum++) {
    rows.push(sized.slice(idx, idx + rowNum + 1));
    idx += rowNum + 1;
  }

  const totalRows = rows.length;
  const wordData = [];

  rows.forEach((row, ri) => {
    const cy = ((totalRows - 1) / 2 - ri) * ROW_GAP;
    const rowW = row.reduce((s, d) => s + d.w, 0) + WORD_PAD * (row.length - 1);

    let cx = -rowW / 2;

    row.forEach((d) => {
      const wordCx = cx + d.w / 2;
      cx += d.w + WORD_PAD;

      wordData.push({
        word: d.word,
        norm: d.norm,
        scale: d.scale,
        h: d.h,
        px: wordCx.toFixed(4),
        py: (cy + CLOUD_BASE).toFixed(4),
        pz: "0.0000",
        planeW: d.w.toFixed(4),
        planeH: d.h.toFixed(4),
        color: d.color,
        opacity: d.opacity
      });
    });
  });

  const planesHTML = wordData
    .map(
      (d, i) => `
    <a-plane
      id="wp-${i}"
      position="${d.px} ${d.py} ${d.pz}"
      rotation="0 0 0"
      width="${d.planeW}"
      height="${d.planeH}"
      material="transparent: true; alphaTest: 0.05; opacity: ${d.opacity}; side: double; shader: flat">
    </a-plane>`
    )
    .join("");

  const badges = [isBombed ? "⚠ Review Bomb" : null, meta.earlyAccess ? "⚡ Early Access" : null]
    .filter(Boolean)
    .join("  ·  ");

  const script = `
    const WORD_DATA = ${JSON.stringify(wordData)};

    function makeWordTexture(word, color, scale) {
      const fontSize = Math.round(280 + scale * 80);
      const bold = scale > 0.6 ? '700' : '400';
      const font = bold + ' ' + fontSize + 'px sans-serif';

      const mc = document.createElement('canvas');
      mc.getContext('2d').font = font;
      const textW = Math.ceil(mc.getContext('2d').measureText(word).width);

      const pad = Math.round(fontSize * 0.15);
      const canvas = document.createElement('canvas');
      canvas.width = textW + pad * 2;
      canvas.height = fontSize + pad * 2;
      const ctx = canvas.getContext('2d');

      if (scale > 0.75) {
        ctx.shadowColor = color;
        ctx.shadowBlur = fontSize * 0.22;
      }
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(word, canvas.width / 2, canvas.height / 2);

      return { dataURL: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height };
    }

    function updateOrientationHint() {
      let el = document.getElementById('rotate-device-hint');
      if (!el) return;
      const isMobile = matchMedia('(pointer: coarse)').matches;
      const isPortrait = innerHeight > innerWidth;
      el.style.display = isMobile && isPortrait ? 'flex' : 'none';
    }

    function installARGestureControls(rootId) {
      const root = document.getElementById(rootId);
      const sceneEl = document.querySelector('a-scene');
      if (!root || !sceneEl) return;

      let start = null;

      function dist(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      function angle(t1, t2) {
        return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      }

      sceneEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          start = {
            mode: 'drag',
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            pos: {
              x: root.object3D.position.x,
              y: root.object3D.position.y,
              z: root.object3D.position.z
            }
          };
        } else if (e.touches.length === 2) {
          start = {
            mode: 'gesture',
            dist: dist(e.touches[0], e.touches[1]),
            angle: angle(e.touches[0], e.touches[1]),
            scale: root.object3D.scale.x,
            rotY: root.object3D.rotation.y
          };
        }
      }, { passive: false });

      sceneEl.addEventListener('touchmove', (e) => {
        if (!start) return;
        e.preventDefault();

        if (start.mode === 'drag' && e.touches.length === 1) {
          const dx = (e.touches[0].clientX - start.x) * 0.0015;
          const dy = (e.touches[0].clientY - start.y) * 0.0015;
          root.object3D.position.x = start.pos.x + dx;
          root.object3D.position.z = start.pos.z + dy;
        }

        if (start.mode === 'gesture' && e.touches.length === 2) {
          const newDist = dist(e.touches[0], e.touches[1]);
          const newAngle = angle(e.touches[0], e.touches[1]);

          const scaleFactor = newDist / start.dist;
          const nextScale = Math.max(0.2, Math.min(6, start.scale * scaleFactor));
          root.object3D.scale.set(nextScale, nextScale, nextScale);

          const deltaAngle = newAngle - start.angle;
          root.object3D.rotation.y = start.rotY + deltaAngle;
        }
      }, { passive: false });

      sceneEl.addEventListener('touchend', (e) => {
        if (!e.touches || e.touches.length === 0) start = null;
      });

      sceneEl.addEventListener('touchcancel', () => {
        start = null;
      });
    }

    document.querySelector('a-scene').addEventListener('loaded', () => {
      WORD_DATA.forEach((d, i) => {
        const { dataURL, aspect } = makeWordTexture(d.word, d.color, d.scale);
        const plane = document.getElementById('wp-' + i);
        if (!plane) return;
        const h = parseFloat(d.planeH);
        plane.setAttribute('width', (h * aspect).toFixed(4));
        plane.setAttribute(
          'material',
          'transparent: true; alphaTest: 0.05; opacity: ' + d.opacity + '; ' +
          'side: double; shader: flat; src: url(' + dataURL + ')'
        );
      });

      installARGestureControls('wordcloud-root');
      updateOrientationHint();
    });

    window.addEventListener('resize', updateOrientationHint);
    window.addEventListener('orientationchange', updateOrientationHint);

    const marker = document.querySelector('a-marker');
    marker.addEventListener('markerFound', () => {
      document.getElementById('marker-hint').style.display = 'none';
    });
    marker.addEventListener('markerLost', () => {
      document.getElementById('marker-hint').style.display = 'block';
    });
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>Word Cloud AR</title>
  <script src="https://aframe.io/releases/1.4.2/aframe.min.js"><\/script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/aframe-extras@6.1.1/dist/aframe-extras.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; font-family: sans-serif; }
    #info {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.82); color: white;
      padding: 10px 20px; border-radius: 10px; text-align: center;
      font-size: 13px; z-index: 200; pointer-events: none;
      border: 1px solid ${isBombed ? "rgba(255,60,0,0.4)" : "rgba(0,160,255,0.3)"};
      white-space: nowrap;
    }
    #info .title  { color: #00aaff; font-weight: 600; margin-bottom: 3px; }
    #info .badges { color: ${isBombed ? "#ff4422" : "#ffdd55"}; font-size: 11px; margin-bottom: 2px; }
    #info .stats  { color: #aaa; font-size: 11px; }
    #marker-hint {
      position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.75); color: #ccc; font-size: 12px;
      padding: 10px 18px; border-radius: 8px; text-align: center;
      pointer-events: none; z-index: 200; white-space: nowrap;
    }
    #marker-hint a { color: #cc88ff; pointer-events: all; }
    #tip {
      position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.65); color: #888; font-size: 11px;
      padding: 7px 14px; border-radius: 6px; pointer-events: none;
      z-index: 200; white-space: nowrap;
    }
    #rotate-device-hint {
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
    }
  </style>
</head>
<body>
  <div id="rotate-device-hint">📱 Please rotate your device to landscape</div>

  <div id="info">
    <div class="title">${escHtml(meta.gameName ?? "")} · ${escHtml(meta.date ?? "")}</div>
    ${badges ? `<div class="badges">${escHtml(badges)}</div>` : ""}
    <div class="stats">
      ✅ ${(meta.positiv ?? 0).toLocaleString()} positive
      &nbsp;·&nbsp;
      ❌ ${Math.abs(meta.negativ ?? 0).toLocaleString()} negative
    </div>
  </div>
  <div id="marker-hint">
    👆 Point at the
    <a href="https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png" target="_blank">Hiro marker</a>
    — word cloud appears above it
  </div>
  <div id="tip">☝️ Drag = move &nbsp;·&nbsp; 🤏 Pinch = zoom &nbsp;·&nbsp; 🔄 Twist = rotate</div>

  <a-scene
    arjs="sourceType: webcam; debugUIEnabled: false; trackingMethod: best;"
    renderer="logarithmicDepthBuffer: true; antialias: true;"
    vr-mode-ui="enabled: false"
    loading-screen="dotsColor: #00aaff; backgroundColor: #111111">
    <a-marker preset="hiro" smooth="true" smoothCount="5" smoothTolerance="0.01">
      <a-entity id="wordcloud-root" position="0 0 0" rotation="0 0 0" scale="1 1 1">
        <a-entity>
          ${planesHTML}
        </a-entity>
      </a-entity>
    </a-marker>
    <a-entity camera look-controls="enabled: false"></a-entity>
  </a-scene>
  <script>${script}<\/script>
</body>
</html>`;
}

function buildBarsHTML() {
  const ROW_SPACING = 0.85;
  const BAR_W = 0.32;

  // Overall AR size multiplier
  const s = aframeScale * 0.12;

  // Compress chart horizontally so it stays visible on marker
  const MAX_AR_WIDTH = 3.2; // world units before scale
  let html = "";
  const allDates = [];

  state.loadedJsons.forEach((json, rowIdx) => {
    const zOffsetWorld = rowIdx * ROW_SPACING;
    const keys = ["cusumPositiv", "cusumNegativ"];

    const times = json.data.map((d) => new Date(d.time).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const spanMonths = Math.max((maxTime - minTime) / (1000 * 60 * 60 * 24 * 30.44), 1);

    const xScale = MAX_AR_WIDTH / spanMonths;

    const label = (json.name ?? "Dataset").length > 20
      ? `${(json.name ?? "Dataset").slice(0, 20)}…`
      : (json.name ?? "Dataset");

    html += `<a-text
      value="${label.replace(/"/g, "'")}"
      position="${(-MAX_AR_WIDTH / 2 - 0.45) * s} ${(0.14 * s).toFixed(4)} ${(zOffsetWorld * s).toFixed(4)}"
      color="#00aaff"
      width="${(8 * s).toFixed(4)}"
      align="right"
      side="double">
    </a-text>`;

    const hasBomb = json.data.some((d) => d.reviewBombed);
    html += `<a-plane
      id="row-root-${rowIdx}"
      data-row="${rowIdx}"
      ${hasBomb ? 'data-has-bomb="true"' : ""}
      material="visible: false"
      width="0.001"
      height="0.001"
      position="0 0 ${(zOffsetWorld * s).toFixed(4)}">
    </a-plane>`;

    json.data.forEach((d) => {
      const time = new Date(d.time).getTime();
      const dateStr = new Date(d.time).toISOString().slice(0, 7);
      allDates.push(dateStr);

      // Center the row around x = 0
      const monthOffset = (time - minTime) / (1000 * 60 * 60 * 24 * 30.44);
      const xWorld = monthOffset * xScale - MAX_AR_WIDTH / 2;

      const ea = !!d.earlyAccess;

      keys.forEach((key, j) => {
        const value = d.values?.[key] ?? 0;
        const hWorld = Math.abs(value) * state.globalChartScale;
        const yWorld = value >= 0 ? hWorld / 2 : -hWorld / 2;
        const color = getBarColorHex(j, ea, d.reviewBombed);
        const opacity = d.reviewBombed ? 0.82 : ea ? 0.58 : 1.0;

        html += `<a-box
          position="${(xWorld * s).toFixed(4)} ${(yWorld * s).toFixed(4)} ${(zOffsetWorld * s).toFixed(4)}"
          width="${(BAR_W * s).toFixed(4)}"
          height="${Math.max(hWorld * s, 0.01).toFixed(4)}"
          depth="${(BAR_W * s).toFixed(4)}"
          color="${color}"
          material="transparent:true;opacity:${opacity};side:double"
          shadow
          data-date="${dateStr}"
          data-row="${rowIdx}"
          data-review-bombed="${!!d.reviewBombed}">
        </a-box>`;
      });

      if (d.reviewBombed) {
        html += `<a-text
          value="⚠"
          position="${(xWorld * s).toFixed(4)} ${((MAX_BAR_HEIGHT + 0.35) * s).toFixed(4)} ${(zOffsetWorld * s).toFixed(4)}"
          color="#ff4422"
          width="${(3.2 * s).toFixed(4)}"
          align="center"
          side="double"
          data-date="${dateStr}"
          data-row="${rowIdx}"
          data-review-bombed="true">
        </a-text>`;
      }
    });
  });

  const sorted = [...new Set(allDates)].sort();
  return {
    html,
    minDate: sorted[0] ?? "",
    maxDate: sorted[sorted.length - 1] ?? ""
  };
}

function iframeCSS() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; background: #000; font-family: sans-serif; }
    #burger-btn { position: fixed; top: 16px; left: 16px; z-index: 300; background: rgba(0,0,0,0.78); color: white; border: none; border-radius: 8px; width: 44px; height: 44px; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    #burger-btn:hover { background: rgba(255,255,255,0.18); }
    #menu-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 400; }
    #menu-overlay.open { display: block; }
    #menu-panel { position: fixed; top: 0; left: -320px; width: 300px; height: 100%; background: #1a1a2e; color: white; transition: left 0.25s ease; display: flex; flex-direction: column; overflow-y: auto; z-index: 401; }
    #menu-panel.open { left: 0; }
    .menu-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 15px; font-weight: 600; flex-shrink: 0; }
    .menu-header button { background: none; border: none; color: #aaa; font-size: 22px; cursor: pointer; }
    .menu-header button:hover { color: white; }
    .menu-section { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .menu-section h3 { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #666; margin-bottom: 12px; }
    .filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .filter-row label { font-size: 12px; color: #aaa; white-space: nowrap; }
    .filter-row input[type="month"] { flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 7px 10px; color: white; font-size: 12px; outline: none; }
    .filter-row input:focus { border-color: #00aaff; }
    .filter-actions { display: flex; gap: 8px; margin-top: 6px; }
    .btn-primary { flex: 1; background: rgba(0,120,255,0.85); color: white; border: none; border-radius: 6px; padding: 8px; font-size: 12px; cursor: pointer; }
    .btn-primary:hover { background: rgba(0,120,255,1); }
    .btn-secondary { flex: 1; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 6px; padding: 8px; font-size: 12px; cursor: pointer; }
    .btn-secondary:hover { background: rgba(255,255,255,0.2); }
    .toggle-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #ccc; }
    .toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 22px; cursor: pointer; transition: background .2s; }
    .toggle-slider:before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: transform .2s; }
    .toggle input:checked + .toggle-slider { background: #ff4422; }
    .toggle input:checked + .toggle-slider:before { transform: translateX(18px); }
    .game-list { display: flex; flex-direction: column; gap: 8px; }
    .game-list-entry { background: rgba(255,255,255,0.07); border-radius: 6px; padding: 8px 10px; }
    .g-name { font-size: 12px; font-weight: 500; color: #00aaff; }
    .g-id { font-size: 10px; color: #555; margin-top: 2px; }
    .panel-hint { color: #666; font-size: 10px; line-height: 1.5; margin-top: 8px; }
    .marker-link { display: block; color: #cc88ff; font-size: 12px; text-decoration: none; }
    .marker-link:hover { text-decoration: underline; }
    #marker-hint { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.72); color: #ccc; font-size: 12px; padding: 10px 18px; border-radius: 8px; text-align: center; pointer-events: none; white-space: nowrap; z-index: 200; }
    #marker-hint a { color: #cc88ff; pointer-events: all; }
    #rotate-device-hint {
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
    }
  `;
}

function iframeJS(minDate, maxDate) {
  return `
    const openMenu = () => {
      document.getElementById('menu-panel').classList.add('open');
      document.getElementById('menu-overlay').classList.add('open');
    };

    const closeMenu = () => {
      document.getElementById('menu-panel').classList.remove('open');
      document.getElementById('menu-overlay').classList.remove('open');
    };

    function updateOrientationHint() {
      const el = document.getElementById('rotate-device-hint');
      const isMobile = matchMedia('(pointer: coarse)').matches;
      const isPortrait = innerHeight > innerWidth;
      el.style.display = isMobile && isPortrait ? 'flex' : 'none';
    }

    function installARGestureControls(rootId) {
      const root = document.getElementById(rootId);
      const sceneEl = document.querySelector('a-scene');
      if (!root || !sceneEl) return;

      let start = null;

      function dist(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      function angle(t1, t2) {
        return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      }

      sceneEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          start = {
            mode: 'drag',
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            pos: {
              x: root.object3D.position.x,
              y: root.object3D.position.y,
              z: root.object3D.position.z
            }
          };
        } else if (e.touches.length === 2) {
          start = {
            mode: 'gesture',
            dist: dist(e.touches[0], e.touches[1]),
            angle: angle(e.touches[0], e.touches[1]),
            scale: root.object3D.scale.x,
            rotY: root.object3D.rotation.y
          };
        }
      }, { passive: false });

      sceneEl.addEventListener('touchmove', (e) => {
        if (!start) return;
        e.preventDefault();

        if (start.mode === 'drag' && e.touches.length === 1) {
          const dx = (e.touches[0].clientX - start.x) * 0.0015;
          const dy = (e.touches[0].clientY - start.y) * 0.0015;
          root.object3D.position.x = start.pos.x + dx;
          root.object3D.position.z = start.pos.z + dy;
        }

        if (start.mode === 'gesture' && e.touches.length === 2) {
          const newDist = dist(e.touches[0], e.touches[1]);
          const newAngle = angle(e.touches[0], e.touches[1]);

          const scaleFactor = newDist / start.dist;
          const nextScale = Math.max(0.2, Math.min(6, start.scale * scaleFactor));
          root.object3D.scale.set(nextScale, nextScale, nextScale);

          const deltaAngle = newAngle - start.angle;
          root.object3D.rotation.y = start.rotY + deltaAngle;
        }
      }, { passive: false });

      sceneEl.addEventListener('touchend', (e) => {
        if (!e.touches || e.touches.length === 0) start = null;
      });

      sceneEl.addEventListener('touchcancel', () => {
        start = null;
      });
    }

    document.getElementById('burger-btn').addEventListener('click', openMenu);
    document.getElementById('menu-close-btn').addEventListener('click', closeMenu);
    document.getElementById('menu-overlay').addEventListener('click', closeMenu);

    function applyFilters() {
      const from = document.getElementById('filterFrom').value || '${minDate}';
      const to = document.getElementById('filterTo').value || '${maxDate}';
      const bomb = document.getElementById('review-bomb-toggle').checked;
      const bombRows = new Set();
      document.querySelectorAll('[data-has-bomb]').forEach(el => bombRows.add(el.dataset.row));
      const rowOk = row => !bomb || bombRows.has(row);
      document.querySelectorAll('[data-date][data-row]').forEach(el => {
        el.setAttribute('visible', String(el.dataset.date >= from && el.dataset.date <= to && rowOk(el.dataset.row)));
      });
    }

    function resetFilters() {
      document.getElementById('filterFrom').value = '${minDate}';
      document.getElementById('filterTo').value = '${maxDate}';
      document.getElementById('review-bomb-toggle').checked = false;
      document.querySelectorAll('[data-date][data-row]').forEach(el => el.setAttribute('visible', 'true'));
    }

    document.getElementById('btn-apply').addEventListener('click', applyFilters);
    document.getElementById('btn-reset').addEventListener('click', resetFilters);
    document.getElementById('review-bomb-toggle').addEventListener('change', applyFilters);

    const marker = document.querySelector('a-marker');
    if (marker) {
      marker.addEventListener('markerFound', () => {
        document.getElementById('marker-hint').style.display = 'none';
      });
      marker.addEventListener('markerLost', () => {
        document.getElementById('marker-hint').style.display = 'block';
      });
    }

    document.querySelector('a-scene').addEventListener('loaded', () => {
      installARGestureControls('ar-chart-root');
      updateOrientationHint();
    });

    window.addEventListener('resize', updateOrientationHint);
    window.addEventListener('orientationchange', updateOrientationHint);
  `;
}

function buildIframeHTML() {
  const { html: barsHTML, minDate, maxDate } = buildBarsHTML();
  const gameTitle = state.loadedJsons.map((j) => j.name ?? "Dataset").join(" vs ");
  const gameListHTML = state.loadedJsons
    .map(
      (j) => `
    <div class="game-list-entry">
      <div class="g-name">${(j.name ?? "Unknown").replace(/</g, "&lt;")}</div>
      <div class="g-id">ID: ${j.id ?? "—"}</div>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>AR — ${gameTitle.replace(/</g, "&lt;")}</title>
  <script src="https://aframe.io/releases/1.4.2/aframe.min.js"><\/script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"><\/script>
  <style>${iframeCSS()}</style>
</head>
<body>
  <div id="rotate-device-hint">📱 Please rotate your device to landscape</div>

  <button id="burger-btn">☰</button>
  <div id="menu-overlay"></div>
  <div id="menu-panel">
    <div class="menu-header"><span>🎮 AR Filters</span><button id="menu-close-btn">✕</button></div>
    <div class="menu-section">
      <h3>📅 Narrow date range</h3>
      <div class="filter-row"><label>From</label><input type="month" id="filterFrom" value="${minDate}"></div>
      <div class="filter-row"><label>To</label><input type="month" id="filterTo" value="${maxDate}"></div>
      <div class="filter-actions">
        <button class="btn-primary" id="btn-apply">Apply</button>
        <button class="btn-secondary" id="btn-reset">Reset</button>
      </div>
    </div>
    <div class="menu-section">
      <h3>⚠️ Review bomb filter</h3>
      <div class="toggle-row">
        <span>Show only review-bombed games</span>
        <label class="toggle"><input type="checkbox" id="review-bomb-toggle"><span class="toggle-slider"></span></label>
      </div>
    </div>
    <div class="menu-section">
      <h3>📊 Viewing (${state.loadedJsons.length} game${state.loadedJsons.length !== 1 ? "s" : ""})</h3>
      <div class="game-list">${gameListHTML}</div>
      <p class="panel-hint">Exit AR to add or remove games.</p>
      <p class="panel-hint">☝️ Drag = move chart · 🤏 Pinch = zoom · 🔄 Twist = rotate</p>
    </div>
    <div class="menu-section">
      <a class="marker-link" href="https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png" target="_blank">📄 Open / print Hiro marker</a>
    </div>
  </div>

  <div id="marker-hint">
    👆 Point at the <a href="https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png" target="_blank">Hiro marker</a>
  </div>

  <a-scene
    arjs="sourceType: webcam; debugUIEnabled: false; trackingMethod: best;"
    renderer="logarithmicDepthBuffer: true; antialias: true;"
    vr-mode-ui="enabled: false"
    loading-screen="dotsColor: #00aaff; backgroundColor: #111111">
    <a-marker preset="hiro" smooth="true" smoothCount="5" smoothTolerance="0.01">
      <a-entity id="ar-chart-root" position="0 0 0" rotation="0 0 0" scale="1 1 1">
        ${barsHTML}
      </a-entity>
    </a-marker>
    <a-entity camera look-controls="enabled: false"></a-entity>
  </a-scene>

  <script>${iframeJS(minDate, maxDate)}<\/script>
</body>
</html>`;
}

function _openIframe(html, exitLabel) {
  const blob = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  aframeIframe = document.createElement("iframe");
  aframeIframe.src = blobUrl;
  aframeIframe.allow = "camera";
  aframeIframe.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:500;border:none;background:#000;";
  aframeIframe.onload = () => URL.revokeObjectURL(blobUrl);
  document.body.appendChild(aframeIframe);

  aframeExitBtn = document.createElement("button");
  aframeExitBtn.textContent = exitLabel;
  aframeExitBtn.style.cssText = `
    position:fixed; top:20px; right:16px; z-index:600;
    background:rgba(180,0,0,0.92); color:white; border:none;
    border-radius:8px; padding:12px 20px; font-family:sans-serif;
    font-size:14px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.6);
  `;
  aframeExitBtn.addEventListener("click", exitAFrameAR);
  document.body.appendChild(aframeExitBtn);
}

export function enterAFrameAR() {
  if (!state.loadedJsons.length) {
    alert("Add at least one game before entering AR.");
    return;
  }
  tryLockLandscape();
  _openIframe(buildIframeHTML(), "❌ Exit AR");
}

export function exitAFrameAR() {
  if (!aframeIframe) return;
  aframeIframe.remove();
  aframeIframe = null;

  if (aframeExitBtn) {
    aframeExitBtn.remove();
    aframeExitBtn = null;
  }
}
