// Vice Panels editor: wires the controls to the cover renderer. Photos are read locally
// (object URLs and the bundled samples), panels are filled per layout, and the export paints
// the same scene at full post size on an offscreen canvas. A `?shot=` query instead sets up
// a fixed scene for the entry's screenshots (./shots.js).
import { LAYOUTS, LAYOUT_ORDER, pointInPolygon } from './layouts.js';
import { drawCoverArt } from './render.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard' },
  { id: 'neon', name: 'Neon Street' },
  { id: 'boat', name: 'Speedboat' },
  { id: 'pier', name: 'The Pier' },
];
const ZOOM_PRESETS = [1.18, 1.35, 1.08, 1.5, 1.25, 1.42, 1.12, 1.3];
const OFF_PRESETS = [[0, -0.15], [0.1, 0], [-0.12, 0.1], [0, 0.3], [0.15, -0.1], [-0.08, 0], [0, 0.12], [-0.15, -0.05]];

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const $ = (id) => document.getElementById(id);

export const state = {
  layout: 'mosaic',
  panels: [],
  span: null,
  grade: 'sunset',
  gradeAmt: 0.85,
  title: 'Neon Vice',
  subtitle: 'Palm City Heat',
  titleStyle: 'sunset',
  titlePos: 'bottom',
  size: { w: 1080, h: 1350 },
};

const photos = []; // { img, name }
let activePhoto = 0;
let selected = 0;
const panelCache = new Map(); // layout name -> panel slots, so edits survive layout switches

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Default panel slots for a layout: the loaded photos cycled with varied crops. */
export function defaultPanels(layoutName) {
  return LAYOUTS[layoutName].panels.map((_, i) => ({
    photo: photos.length ? photos[i % photos.length].img : null,
    zoom: ZOOM_PRESETS[i % ZOOM_PRESETS.length],
    ox: OFF_PRESETS[i % OFF_PRESETS.length][0],
    oy: OFF_PRESETS[i % OFF_PRESETS.length][1],
  }));
}

export function useLayout(name) {
  panelCache.set(state.layout, state.panels);
  state.layout = name;
  state.panels = panelCache.get(name) ?? defaultPanels(name);
  selected = LAYOUTS[name].focus;
  syncPanelControls();
  redraw();
}

/** The slot the Panel controls edit: the span slot in one-photo mode, else the selected panel. */
function currentSlot() {
  return state.span ?? state.panels[selected];
}

export function redraw() {
  drawCoverArt(ctx, canvas.width, canvas.height, state, document.body.classList.contains('shot-cover') ? -1 : selected);
}

function syncPanelControls() {
  const slot = currentSlot();
  if (!slot) return;
  $('panel-label').textContent = state.span
    ? 'All panels · one photo'
    : `Panel ${selected + 1} of ${state.panels.length}`;
  $('zoom').value = slot.zoom;
  $('offx').value = slot.ox;
  $('offy').value = slot.oy;
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb' + (i === activePhoto ? ' on' : '');
    const im = document.createElement('img');
    im.src = p.img.src;
    im.alt = p.name;
    const s = document.createElement('span');
    s.textContent = p.name;
    b.append(im, s);
    b.addEventListener('click', () => {
      activePhoto = i;
      if (state.span) state.span.photo = p.img;
      renderTray();
      redraw();
    });
    tray.append(b);
  });
}

function buildPickers() {
  const lp = $('layout-picker');
  for (const name of LAYOUT_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = LAYOUTS[name].label;
    b.dataset.layout = name;
    if (name === state.layout) b.classList.add('on');
    b.addEventListener('click', () => {
      lp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      useLayout(name);
    });
    lp.append(b);
  }
  const sp = $('size-picker');
  sp.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      sp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      state.size = { w: Number(b.dataset.w), h: Number(b.dataset.h) };
      fitPreview();
      redraw();
    });
  });
}

/** Sizes the preview canvas to the chosen post aspect, capped for a responsive stage. */
function fitPreview() {
  const { w, h } = state.size;
  const scale = Math.min(1, 1120 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
}

function bindControls() {
  $('photo-input').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const img = await loadImage(URL.createObjectURL(file));
      photos.push({ img, name: file.name.replace(/\.[^.]+$/, '') });
    }
    activePhoto = photos.length - 1;
    if (state.span) state.span.photo = photos[activePhoto].img;
    renderTray();
    redraw();
    status.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded — all on this machine.`;
  });
  $('assign').addEventListener('click', () => {
    if (!photos.length) return;
    if (state.span) state.span.photo = photos[activePhoto].img;
    else state.panels[selected].photo = photos[activePhoto].img;
    redraw();
  });
  $('span-toggle').addEventListener('change', (e) => {
    state.span = e.target.checked
      ? { photo: photos.length ? photos[activePhoto].img : null, zoom: 1.12, ox: 0, oy: 0 }
      : null;
    syncPanelControls();
    redraw();
  });
  const edit = (key) => (e) => {
    const slot = currentSlot();
    if (slot) slot[key] = Number(e.target.value);
    redraw();
  };
  $('zoom').addEventListener('input', edit('zoom'));
  $('offx').addEventListener('input', edit('ox'));
  $('offy').addEventListener('input', edit('oy'));
  $('grade').addEventListener('change', (e) => { state.grade = e.target.value; redraw(); });
  $('grade-amt').addEventListener('input', (e) => { state.gradeAmt = Number(e.target.value); redraw(); });
  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('title-style').addEventListener('change', (e) => { state.titleStyle = e.target.value; redraw(); });
  $('title-pos').addEventListener('change', (e) => { state.titlePos = e.target.value; redraw(); });
  $('export').addEventListener('click', exportPng);

  // Drag inside a panel to reframe its photo; wheel zooms the selected panel.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    if (!state.span) {
      const hit = LAYOUTS[state.layout].panels.findIndex((poly) => pointInPolygon(poly, nx, ny));
      if (hit >= 0 && hit !== selected) {
        selected = hit;
        syncPanelControls();
      }
    }
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const slot = currentSlot();
    if (!slot) return;
    const r = canvas.getBoundingClientRect();
    slot.ox = clamp(slot.ox + ((e.clientX - drag.x) / r.width) * 1.7, -1, 1);
    slot.oy = clamp(slot.oy + ((e.clientY - drag.y) / r.height) * 1.7, -1, 1);
    drag = { x: e.clientX, y: e.clientY };
    $('offx').value = slot.ox;
    $('offy').value = slot.oy;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = currentSlot();
    if (!slot) return;
    slot.zoom = clamp(slot.zoom * Math.exp(-e.deltaY * 0.0012), 1, 3.2);
    $('zoom').value = slot.zoom;
    redraw();
  }, { passive: false });
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Paints the cover at the full post size and downloads it as a PNG. */
function exportPng() {
  const { w, h } = state.size;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCoverArt(off.getContext('2d'), w, h, state, -1);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-panels-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-panels-${w}x${h}.png`;
  }, 'image/png');
}

/** Loads the four bundled sample photos so the editor opens with a finished cover. */
export async function loadSamples() {
  for (const s of SAMPLES) {
    photos.push({ img: await loadImage(`samples/${s.id}.jpg`), name: s.name });
  }
}

export async function boot() {
  buildPickers();
  bindControls();
  fitPreview();
  await loadSamples();
  state.panels = defaultPanels(state.layout);
  selected = LAYOUTS[state.layout].focus;
  renderTray();
  syncPanelControls();
  redraw();
  if (document.fonts?.ready) {
    await document.fonts.load('80px Anton');
    await document.fonts.ready;
    redraw(); // repaint once the poster face arrives, so the title is true Anton
  }
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    state, canvas, loadSamples, defaultPanels, useLayout, boot, redraw,
  });
} else {
  boot();
}
