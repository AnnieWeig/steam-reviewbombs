import { state } from "./state.js";
import { camera, renderer, raycaster, mouse } from "./scene.js";
import { spherical, target, updateCamera } from "./camera.js";
import { handleBarClick, closePopup } from "./popup.js";
import { selectRow, clearRowSelection } from "./chart.js"; // ← add this

// Module-local interaction state
let isDragging = false;
let draggedRow = null;
let touchDragRow = null;
let prevMouse = { x: 0, y: 0 };
let mouseDownPos = { x: 0, y: 0 };
let dragStartMouse = { y: 0 };
let dragStartZ = 0;
let touchStartTime = 0;
let longPressTimer = null;
let lastPinchDist = null;

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function hitTestRow(clientX, clientY) {
  mouse.x = (clientX / innerWidth) * 2 - 1;
  mouse.y = -(clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(state.allBars.map((b) => b.mesh));
  if (hits.length > 0) {
    const bar = state.allBars.find((b) => b.mesh === hits[0].object);
    if (bar) {
      selectRow(bar.group);
      return;
    }
  }
  clearRowSelection();
}

export function setupInteractions() {
  const el = renderer.domElement;

  // ── Mouse ──────────────────────────────────────────────────────
  el.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      isDragging = true;
      prevMouse = mouseDownPos = { x: e.clientX, y: e.clientY };
    }
    if (e.button === 2) {
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      draggedRow = null;
      for (const g of state.rowGroups) {
        if (raycaster.intersectObjects(g.children, true).length) {
          draggedRow = g;
          dragStartMouse = { y: e.clientY };
          dragStartZ = g.position.z;
          selectRow(g); // ← highlight on drag start
          break;
        }
      }
    }
  });

  el.addEventListener("mouseup", (e) => {
    isDragging = false;
    if (Math.abs(e.clientX - mouseDownPos.x) < 5 && Math.abs(e.clientY - mouseDownPos.y) < 5 && e.button === 0) {
      hitTestRow(e.clientX, e.clientY); // ← row selection
      handleBarClick(e);
    }
    draggedRow = null;
  });

  el.addEventListener("mousemove", (e) => {
    if (draggedRow) {
      draggedRow.position.z = dragStartZ + (e.clientY - dragStartMouse.y) * 0.02;
      return;
    }
    if (isDragging) {
      target.x -= (e.clientX - prevMouse.x) * (spherical.radius / 1000);
      prevMouse = { x: e.clientX, y: e.clientY };
      updateCamera();
    }
  });

  el.addEventListener("mouseleave", () => {
    isDragging = false;
    draggedRow = null;
  });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
  });

  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const d = camera.position.clone().sub(target);
      spherical.radius = Math.max(3, Math.min(100, d.length() + e.deltaY * 0.05));
      updateCamera();
    },
    { passive: false }
  );

  // ── Touch ──────────────────────────────────────────────────────
  el.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartTime = Date.now();
        mouseDownPos = prevMouse = { x: t.clientX, y: t.clientY };
        isDragging = true;
        lastPinchDist = null;

        longPressTimer = setTimeout(() => {
          mouse.x = (t.clientX / innerWidth) * 2 - 1;
          mouse.y = -(t.clientY / innerHeight) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          for (const g of state.rowGroups) {
            if (raycaster.intersectObjects(g.children, true).length) {
              touchDragRow = g;
              dragStartMouse = { y: t.clientY };
              dragStartZ = g.position.z;
              isDragging = false;
              selectRow(g); // ← highlight on long-press drag start
              if (navigator.vibrate) navigator.vibrate(40);
              break;
            }
          }
        }, 500);
      } else if (e.touches.length === 2) {
        clearTimeout(longPressTimer);
        isDragging = false;
        touchDragRow = null;
        lastPinchDist = touchDist(e.touches);
      }
    },
    { passive: false }
  );

  el.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        clearTimeout(longPressTimer);
        const dist = touchDist(e.touches);
        if (lastPinchDist !== null) {
          const d = camera.position.clone().sub(target);
          spherical.radius = Math.max(3, Math.min(100, d.length() + (lastPinchDist - dist) * 0.08));
          updateCamera();
        }
        lastPinchDist = dist;
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (touchDragRow) {
          touchDragRow.position.z = dragStartZ + (t.clientY - dragStartMouse.y) * 0.02;
          return;
        }
        if (isDragging) {
          if (Math.abs(t.clientX - mouseDownPos.x) > 8 || Math.abs(t.clientY - mouseDownPos.y) > 8)
            clearTimeout(longPressTimer);
          target.x -= (t.clientX - prevMouse.x) * (spherical.radius / 1000);
          prevMouse = { x: t.clientX, y: t.clientY };
          updateCamera();
        }
      }
    },
    { passive: false }
  );

  el.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      clearTimeout(longPressTimer);
      const t = e.changedTouches[0];
      if (
        Math.abs(t.clientX - mouseDownPos.x) < 10 &&
        Math.abs(t.clientY - mouseDownPos.y) < 10 &&
        Date.now() - touchStartTime < 300 &&
        !touchDragRow
      ) {
        hitTestRow(t.clientX, t.clientY); // ← row selection
        handleBarClick({ clientX: t.clientX, clientY: t.clientY });
      }
      isDragging = false;
      touchDragRow = null;
      lastPinchDist = null;
    },
    { passive: false }
  );

  el.addEventListener("touchcancel", () => {
    clearTimeout(longPressTimer);
    isDragging = false;
    touchDragRow = null;
    lastPinchDist = null;
  });
}
import { state }                        from "./state.js";
import { camera, renderer, raycaster, mouse } from "./scene.js";
import { spherical, target, updateCamera }    from "./camera.js";
import { handleBarClick, closePopup }         from "./popup.js";

// Module-local interaction state
let isDragging     = false;
let draggedRow     = null;
let touchDragRow   = null;
let prevMouse      = { x: 0, y: 0 };
let mouseDownPos   = { x: 0, y: 0 };
let dragStartMouse = { y: 0 };
let dragStartZ     = 0;
let touchStartTime = 0;
let longPressTimer = null;
let lastPinchDist  = null;

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function setupInteractions() {
  const el = renderer.domElement;

  // ── Mouse ──────────────────────────────────────────────────────
  el.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      isDragging = true;
      prevMouse = mouseDownPos = { x: e.clientX, y: e.clientY };
    }
    if (e.button === 2) {
      mouse.x =  (e.clientX / innerWidth)  * 2 - 1;
      mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      draggedRow = null;
      for (const g of state.rowGroups) {
        if (raycaster.intersectObjects(g.children, true).length) {
          draggedRow     = g;
          dragStartMouse = { y: e.clientY };
          dragStartZ     = g.position.z;
          break;
        }
      }
    }
  });

  el.addEventListener("mouseup", (e) => {
    isDragging = false;
    if (
      Math.abs(e.clientX - mouseDownPos.x) < 5 &&
      Math.abs(e.clientY - mouseDownPos.y) < 5 &&
      e.button === 0
    ) handleBarClick(e);
    draggedRow = null;
  });

  el.addEventListener("mousemove", (e) => {
    if (draggedRow) {
      draggedRow.position.z = dragStartZ + (e.clientY - dragStartMouse.y) * 0.02;
      return;
    }
    if (isDragging) {
      target.x -= (e.clientX - prevMouse.x) * (spherical.radius / 1000);
      prevMouse = { x: e.clientX, y: e.clientY };
      updateCamera();
    }
  });

  el.addEventListener("mouseleave", () => { isDragging = false; draggedRow = null; });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown",  (e) => { if (e.key === "Escape") closePopup(); });

  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    const d = camera.position.clone().sub(target);
    spherical.radius = Math.max(3, Math.min(100, d.length() + e.deltaY * 0.05));
    updateCamera();
  }, { passive: false });

  // ── Touch ──────────────────────────────────────────────────────
  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartTime = Date.now();
      mouseDownPos = prevMouse = { x: t.clientX, y: t.clientY };
      isDragging = true; lastPinchDist = null;

      longPressTimer = setTimeout(() => {
        mouse.x =  (t.clientX / innerWidth)  * 2 - 1;
        mouse.y = -(t.clientY / innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        for (const g of state.rowGroups) {
          if (raycaster.intersectObjects(g.children, true).length) {
            touchDragRow   = g;
            dragStartMouse = { y: t.clientY };
            dragStartZ     = g.position.z;
            isDragging     = false;
            if (navigator.vibrate) navigator.vibrate(40);
            break;
          }
        }
      }, 500);
    } else if (e.touches.length === 2) {
      clearTimeout(longPressTimer);
      isDragging = false; touchDragRow = null;
      lastPinchDist = touchDist(e.touches);
    }
  }, { passive: false });

  el.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      clearTimeout(longPressTimer);
      const dist = touchDist(e.touches);
      if (lastPinchDist !== null) {
        const d = camera.position.clone().sub(target);
        spherical.radius = Math.max(3,
          Math.min(100, d.length() + (lastPinchDist - dist) * 0.08));
        updateCamera();
      }
      lastPinchDist = dist;
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (touchDragRow) {
        touchDragRow.position.z =
          dragStartZ + (t.clientY - dragStartMouse.y) * 0.02;
        return;
      }
      if (isDragging) {
        if (
          Math.abs(t.clientX - mouseDownPos.x) > 8 ||
          Math.abs(t.clientY - mouseDownPos.y) > 8
        ) clearTimeout(longPressTimer);
        target.x -= (t.clientX - prevMouse.x) * (spherical.radius / 1000);
        prevMouse = { x: t.clientX, y: t.clientY };
        updateCamera();
      }
    }
  }, { passive: false });

  el.addEventListener("touchend", (e) => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    const t = e.changedTouches[0];
    if (
      Math.abs(t.clientX - mouseDownPos.x) < 10 &&
      Math.abs(t.clientY - mouseDownPos.y) < 10 &&
      Date.now() - touchStartTime < 300 &&
      !touchDragRow
    ) handleBarClick({ clientX: t.clientX, clientY: t.clientY });
    isDragging = false; touchDragRow = null; lastPinchDist = null;
  }, { passive: false });

  el.addEventListener("touchcancel", () => {
    clearTimeout(longPressTimer);
    isDragging = false; touchDragRow = null; lastPinchDist = null;
  });
}
