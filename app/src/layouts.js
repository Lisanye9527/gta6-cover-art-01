// Panel layouts for the cover maker. Each layout is a list of convex polygons in normalized
// canvas coordinates (0..1 on both axes); the renderer insets each polygon a little toward its
// centroid to open the cream keyline gaps that separate the panels of a GTA-style poster.
// Every polygon is listed clockwise, and a layout's `focus` names the panel index the editor
// selects first.

/** A rectangle as a four-point polygon. */
function rect(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

export const LAYOUTS = {
  mosaic: {
    label: 'Mosaic Grid',
    focus: 4,
    panels: [
      rect(0.00, 0.00, 0.52, 0.42),
      rect(0.52, 0.00, 0.48, 0.27),
      rect(0.52, 0.27, 0.48, 0.15),
      rect(0.00, 0.42, 0.34, 0.30),
      rect(0.34, 0.42, 0.36, 0.30),
      rect(0.70, 0.42, 0.30, 0.30),
      rect(0.00, 0.72, 0.60, 0.28),
      rect(0.60, 0.72, 0.40, 0.28),
    ],
  },
  hero: {
    label: 'Hero & Strips',
    focus: 0,
    panels: [
      rect(0.00, 0.00, 0.58, 0.68),
      rect(0.58, 0.00, 0.42, 0.34),
      rect(0.58, 0.34, 0.42, 0.34),
      rect(0.00, 0.68, 0.50, 0.32),
      rect(0.50, 0.68, 0.50, 0.32),
    ],
  },
  slant: {
    label: 'Slant Columns',
    focus: 1,
    panels: [
      [[0.00, 0.00], [0.44, 0.00], [0.31, 1.00], [0.00, 1.00]],
      [[0.44, 0.00], [0.73, 0.00], [0.60, 1.00], [0.31, 1.00]],
      [[0.73, 0.00], [1.00, 0.00], [1.00, 1.00], [0.60, 1.00]],
    ],
  },
  duo: {
    label: 'Wide Duo',
    focus: 0,
    panels: [
      rect(0.00, 0.00, 1.00, 0.55),
      rect(0.00, 0.55, 0.50, 0.45),
      rect(0.50, 0.55, 0.50, 0.45),
    ],
  },
};

/** The layout names in picker order. */
export const LAYOUT_ORDER = ['mosaic', 'hero', 'slant', 'duo'];

/** The centroid of a polygon, used to inset it for the panel gap and to hit-test clicks. */
export function centroid(poly) {
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

/** True when the normalized point (x, y) falls inside the polygon (ray casting). */
export function pointInPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
