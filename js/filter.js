import { state } from "./state.js";

/** Date range filter — hides individual bars outside the window. */
export function applyFilter() {
  const from = document.getElementById("filterFrom").value;
  const to = document.getElementById("filterTo").value;
  const fd = from ? new Date(from) : null;
  const td = to ? new Date(to + "-31") : null;

  state.allBars.forEach(({ mesh, date }) => {
    mesh.visible = (!fd || date >= fd) && (!td || date <= td);
  });
}

export function resetFilter() {
  document.getElementById("filterFrom").value = "";
  document.getElementById("filterTo").value = "";
  state.allBars.forEach(({ mesh }) => (mesh.visible = true));
  // Also clear review-bomb toggle
  const toggle = document.getElementById("review-bomb-toggle");
  if (toggle) toggle.checked = false;
}

/**
 * Review-bombed game filter.
 * When ON  → hide every row group whose game has NO review-bombed month.
 * When OFF → show all groups.
 */
export function applyReviewBombFilter(on) {
  state.rowGroups.forEach((group) => {
    if (!on) {
      group.visible = true;
      return;
    }
    // Does any bar in this group have reviewBombed = true?
    const hasBomb = state.allBars.some((b) => b.group === group && b.reviewBombed);
    group.visible = hasBomb;
  });
}
