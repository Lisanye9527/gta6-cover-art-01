// Fixed scenes for the entry's screenshots, driven by the `?shot=` query:
//   ?shot=cover&w=1280&h=720&layout=slant&grade=neon  — the cover alone, painted at exactly
//     the requested pixels (the app's own drawing of an export, at screenshot size);
//   ?shot=editor&layout=hero&grade=sunset            — the full editor with the samples
//     loaded, as a judge would meet it.
// Both set window.__shotReady once the scene is painted with the poster font in hand.
export async function runShot(shot, query, api) {
  const { state, canvas } = api;
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    canvas.width = Number(query.get('w') ?? 1280);
    canvas.height = Number(query.get('h') ?? 720);
    await api.loadSamples();
    state.layout = query.get('layout') ?? 'mosaic';
    state.panels = api.defaultPanels(state.layout);
    applyLook(query, state);
    api.redraw();
  } else {
    await api.boot();
    const layout = query.get('layout');
    if (layout && layout !== state.layout) {
      api.useLayout(layout);
      document.querySelectorAll('#layout-picker button').forEach((b) =>
        b.classList.toggle('on', b.dataset.layout === layout));
    }
    applyLook(query, state);
    syncInputs(query);
    api.redraw();
  }
  if (document.fonts?.ready) {
    await document.fonts.load('80px Anton');
    await document.fonts.ready;
    api.redraw();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/** Title, grade and lettering choices shared by both scenes, read from the query. */
function applyLook(query, state) {
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('amt')) state.gradeAmt = Number(query.get('amt'));
  if (query.get('title')) state.title = query.get('title');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('style')) state.titleStyle = query.get('style');
  if (query.get('pos')) state.titlePos = query.get('pos');
}

/** Keeps the editor's visible controls honest about the scene the screenshot shows. */
function syncInputs(query) {
  const set = (id, v) => { if (v) document.getElementById(id).value = v; };
  set('grade', query.get('grade'));
  set('title', query.get('title'));
  set('subtitle', query.get('subtitle'));
  set('title-style', query.get('style'));
  set('title-pos', query.get('pos'));
}
