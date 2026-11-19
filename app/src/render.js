// Renders the cover art: photo panels clipped into the chosen layout, a Vice City colour
// grade over each panel, cream keylines between panels, and the big poster title lettering.
// Pure canvas 2D, no libraries: the same function paints the editor preview and, at full
// resolution on an offscreen canvas, the exported PNG.
import { LAYOUTS, centroid } from './layouts.js';

/** Colour grades: a canvas filter for the photo itself plus a gradient wash over the panel. */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.28) contrast(1.07) brightness(1.02)',
    wash: [[0, 'rgba(255, 176, 66, 0.10)'], [0.55, 'rgba(255, 94, 98, 0.16)'], [1, 'rgba(146, 38, 146, 0.36)']],
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.45) contrast(1.13) brightness(0.97)',
    wash: [[0, 'rgba(0, 229, 255, 0.13)'], [0.5, 'rgba(64, 32, 160, 0.10)'], [1, 'rgba(255, 45, 150, 0.30)']],
  },
  gold: {
    label: 'Golden Hour',
    filter: 'sepia(0.32) saturate(1.25) contrast(1.05)',
    wash: [[0, 'rgba(255, 190, 60, 0.10)'], [1, 'rgba(160, 60, 10, 0.22)']],
  },
  none: { label: 'Clean', filter: 'none', wash: [] },
};

/** Title lettering styles: the vertical gradient the Anton letters are filled with. */
export const TITLE_STYLES = {
  sunset: ['#fff7e0', '#ffd76a', '#ff8a3d', '#ff4e7a'],
  chrome: ['#ffffff', '#d7dee6', '#78828d', '#eef2f6'],
  neon: ['#c8fff4', '#2ee6ff', '#7a5cff', '#ff4ecd'],
};

const FRAME = '#f3ead8';
const INK = '#160a20';

/** A panel polygon in canvas pixels, inset toward its centroid so the gaps read as keylines. */
function insetPolygon(poly, w, h, gapPx) {
  const px = poly.map(([x, y]) => [x * w, y * h]);
  const [cx, cy] = centroid(poly).map((v, i) => v * (i === 0 ? w : h));
  return px.map(([x, y]) => {
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(gapPx, d * 0.4);
    return [x + (dx / d) * m, y + (dy / d) * m];
  });
}

function polygonPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function bboxOf(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Draws an image cover-fit into a box; zoom > 1 crops tighter, ox/oy (-1..1) slide the crop. */
function drawPhotoCover(ctx, img, box, zoom, ox, oy, filter) {
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = box.x + (box.w - dw) / 2 + (ox * (dw - box.w)) / 2;
  const dy = box.y + (box.h - dh) / 2 + (oy * (dh - box.h)) / 2;
  ctx.save();
  if (filter && filter !== 'none') ctx.filter = filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** The grade wash: a vertical gradient laid over one panel, scaled by the strength slider. */
function drawWash(ctx, box, grade, amt) {
  if (!grade.wash.length || amt <= 0) return;
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  for (const [stop, color] of grade.wash) g.addColorStop(stop, color);
  ctx.save();
  ctx.globalAlpha = amt;
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

/** A designed placeholder for a panel with no photo yet: dusk gradient and a quiet label. */
function drawPlaceholder(ctx, pts, box, index) {
  const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  g.addColorStop(0, '#3a1c5c');
  g.addColorStop(1, '#b02a6e');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = `600 ${Math.max(13, box.h * 0.07)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1}`, box.x + box.w / 2, box.y + box.h / 2);
  ctx.restore();
}

/** The poster title: fitted Anton capitals with a sunset gradient, dark keyline and shadow. */
function drawTitle(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  if (!title) return;
  const atTop = state.titlePos === 'top';
  // Scrim so the lettering holds against busy panels.
  const bandH = h * 0.34;
  const scrim = atTop
    ? ctx.createLinearGradient(0, 0, 0, bandH)
    : ctx.createLinearGradient(0, h, 0, h - bandH);
  scrim.addColorStop(0, 'rgba(12, 4, 22, 0.52)');
  scrim.addColorStop(1, 'rgba(12, 4, 22, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, atTop ? 0 : h - bandH, w, bandH);

  let size = h * 0.155;
  const setFont = () => { ctx.font = `${size}px Anton, 'Arial Black', sans-serif`; };
  setFont();
  while (ctx.measureText(title).width > w * 0.92 && size > 14) {
    size -= 2;
    setFont();
  }
  const cx = w / 2;
  const titleBase = atTop ? h * 0.055 + size : h * 0.955 - size * 0.18;
  ctx.save();
  ctx.translate(cx, titleBase);
  ctx.transform(1, 0, -0.055, 1, 0, 0); // a whisper of poster slant
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(10, 2, 18, 0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.045;
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.085;
  ctx.strokeText(title, 0, 0);
  ctx.shadowColor = 'transparent';
  const fill = ctx.createLinearGradient(0, -size, 0, size * 0.25);
  TITLE_STYLES[state.titleStyle].forEach((c, i, arr) => fill.addColorStop(i / (arr.length - 1), c));
  ctx.fillStyle = fill;
  ctx.fillText(title, 0, 0);
  ctx.restore();

  const sub = (state.subtitle || '').trim().toUpperCase();
  if (!sub) return;
  const subSize = Math.max(12, size * 0.21);
  ctx.save();
  ctx.font = `${subSize}px Anton, 'Arial Black', sans-serif`;
  try { ctx.letterSpacing = `${subSize * 0.34}px`; } catch { /* older engines: no tracking */ }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(10, 2, 18, 0.7)';
  ctx.shadowBlur = subSize * 0.4;
  const subY = atTop ? titleBase + subSize * 1.7 : titleBase - size - subSize * 0.85;
  ctx.fillText(sub, cx, subY);
  // Flanking rules either side of the subtitle. measureText already counts the letter
  // spacing set above, so the measured width is the full tracked width.
  const tw = ctx.measureText(sub).width;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const ruleY = subY - subSize * 0.32;
  const ruleW = Math.max(0, (w * 0.92 - tw) / 2 - subSize * 0.8);
  if (ruleW > 8) {
    ctx.fillRect(cx - tw / 2 - ruleW - subSize * 0.6, ruleY, ruleW, Math.max(2, subSize * 0.09));
    ctx.fillRect(cx + tw / 2 + subSize * 0.6, ruleY, ruleW, Math.max(2, subSize * 0.09));
  }
  ctx.restore();
}

/**
 * Paints the whole cover onto ctx at w x h. state.panels[i] is { photo, zoom, ox, oy } per
 * layout panel; state.span, when set, is one such slot whose photo stretches across every
 * panel. `selected` (editor only) outlines one panel; exports pass -1.
 */
export function drawCoverArt(ctx, w, h, state, selected = -1) {
  const layout = LAYOUTS[state.layout];
  const grade = GRADES[state.grade];
  const gap = Math.max(3, Math.min(w, h) * 0.008);
  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, w, h);

  layout.panels.forEach((poly, i) => {
    const pts = insetPolygon(poly, w, h, gap);
    const box = bboxOf(pts);
    polygonPath(ctx, pts);
    ctx.save();
    ctx.clip();
    const slot = state.span ?? state.panels[i];
    if (slot && slot.photo) {
      const target = state.span ? { x: 0, y: 0, w, h } : box;
      drawPhotoCover(ctx, slot.photo, target, slot.zoom, slot.ox, slot.oy, grade.filter);
      drawWash(ctx, box, grade, state.gradeAmt);
    } else {
      drawPlaceholder(ctx, pts, box, i);
    }
    ctx.restore();
    polygonPath(ctx, pts);
    ctx.strokeStyle = 'rgba(22, 10, 32, 0.35)';
    ctx.lineWidth = Math.max(1, gap * 0.22);
    ctx.stroke();
    if (i === selected) {
      polygonPath(ctx, pts);
      ctx.strokeStyle = '#19e3d2';
      ctx.lineWidth = Math.max(2, gap * 0.55);
      ctx.setLineDash([gap * 1.6, gap * 1.1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // A soft vignette to seat the panels before the title goes on.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(10, 2, 18, 0)');
  vg.addColorStop(1, 'rgba(10, 2, 18, 0.20)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  drawTitle(ctx, w, h, state);
}
