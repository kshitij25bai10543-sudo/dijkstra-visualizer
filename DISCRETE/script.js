'use strict';
/* ============ HELPERS ============ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const fmt = x => (x === Infinity ? '∞' : x);
const COL = { normal: '#1b2a4a', ring: '#4f8cff', current: '#ffb020', visited: '#7c4dff', source: '#00e5a0', dest: '#ff4d8d', path: '#00e5ff', edge: '#3a5a9a', tree: '#7c4dff' };

/*TEST-START*/
/* ============ GRAPH DATA: examples + helpers ============ */
const ek = (a, b) => [a, b].sort().join('|'); // undirected edge key
const EXAMPLES = {
  1: { src: 'A', dst: 'E',
    nodes: { A: [110, 240], B: [300, 110], C: [300, 370], D: [520, 240], E: [700, 240] },
    edges: [['A','B',4],['A','C',2],['B','C',1],['B','D',5],['C','D',8],['C','E',10],['D','E',2]] },
  2: { src: 'A', dst: 'G',
    nodes: { A: [90, 240], B: [250, 90], C: [470, 70], D: [250, 400], E: [470, 250], F: [520, 420], G: [720, 260] },
    edges: [['A','B',7],['A','D',5],['B','C',8],['B','D',9],['B','E',7],['C','E',5],['D','E',15],['D','F',6],['E','F',8],['E','G',9],['F','G',11]] },
  3: { src: 'A', dst: 'J',
    nodes: { A: [70, 240], B: [190, 90], C: [190, 390], D: [340, 240], E: [480, 100], F: [360, 430], G: [520, 300], H: [640, 150], I: [560, 440], J: [740, 300] },
    edges: [['A','B',4],['A','C',3],['B','D',5],['B','E',9],['C','D',2],['C','F',6],['D','E',3],['D','G',7],['E','H',4],['F','G',2],['F','I',8],['G','H',3],['G','J',9],['H','J',2],['I','J',3]] }
};

/* ============ MIN-HEAP (priority queue) ============ */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(d, id) {
    const a = this.a; a.push([d, id]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

/* ============ DIJKSTRA (real algorithm; records a snapshot per step) ============ */
function buildAdj(g) {
  const adj = {}; g.nodes.forEach(n => { adj[n.id] = []; });
  g.edges.forEach(e => { adj[e.a].push({ to: e.b, w: e.w }); adj[e.b].push({ to: e.a, w: e.w }); });
  return adj;
}
function dijkstra(g, src, dst) {
  const adj = buildAdj(g), dist = {}, prev = {}, visited = new Set(), tree = new Set(), steps = [], heap = new MinHeap();
  let examined = 0;
  g.nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
  dist[src] = 0; heap.push(0, src);
  const snap = o => steps.push({ ...o, dist: { ...dist }, visited: new Set(visited), tree: new Set(tree), examined, path: o.path || null });
  snap({ type: 'init', cur: src, msg: `Source is ${src}: distance[${src}] = 0, all other distances = ∞.` });
  while (heap.size) {
    const [d, u] = heap.pop();
    if (visited.has(u) || d > dist[u]) continue; // stale heap entry
    visited.add(u);
    snap({ type: 'select', cur: u, msg: `Current node: ${u}. It has the smallest tentative distance (${dist[u]}), so mark it visited.` });
    if (u === dst) break; // destination settled: its distance is final
    for (const { to, w } of adj[u]) {
      if (visited.has(to)) continue;
      examined++;
      const nd = dist[u] + w, old = dist[to], better = nd < old;
      if (better) {
        if (prev[to] !== null) tree.delete(ek(prev[to], to));
        dist[to] = nd; prev[to] = u; tree.add(ek(u, to)); heap.push(nd, to);
      }
      snap({ type: 'examine', cur: u, edge: ek(u, to),
        msg: `Checking edge ${u} → ${to} (weight ${w}). Current distance to ${u} = ${dist[u]}. Distance to ${to} through ${u} = ${nd}. ` +
          (better ? `${nd} is smaller than ${fmt(old)}. Updating distance of ${to}.` : `${nd} is not smaller than ${old}. No update.`) });
    }
  }
  let path = null;
  if (dist[dst] !== Infinity) { path = []; for (let v = dst; v !== null; v = prev[v]) path.unshift(v); }
  snap({ type: 'done', cur: null, path, msg: path ? `Destination ${dst} reached. Shortest distance = ${dist[dst]}. Path: ${path.join(' → ')}.` : 'No path exists between the selected nodes.' });
  return { steps, dist, prev, path, visitedCount: visited.size, examined };
}
/*TEST-END*/

/* ============ APP STATE ============ */
const G = { nodes: [], edges: [], src: '', dst: '' };
const P = { steps: [], i: -1, timer: null, ms: 0, logged: false, runs: 0 };
const UI = { mode: 'move', pending: null, drag: null };
const hasNode = id => G.nodes.some(n => n.id === id);
const hasEdge = (a, b) => G.edges.some(e => ek(e.a, e.b) === ek(a, b));
const nodeById = id => G.nodes.find(n => n.id === id);
function newLabel() {
  for (let i = 0; ; i++) { const l = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''); if (!hasNode(l)) return l; }
}
function say(text, type) { const m = $('#msg'); m.textContent = text || ''; m.className = type || ''; }

/* ============ GRAPH EDITING ============ */
function parseWeight() {
  const raw = $('#weight').value.trim(), v = Number(raw);
  if (raw === '' || !Number.isFinite(v)) { say('Invalid edge weight. Enter a number.', 'err'); return null; }
  if (v < 0) { say('Negative edge weights are not allowed: Dijkstra\'s algorithm needs weights of 0 or more.', 'err'); return null; }
  return v;
}
function addNode(x, y) { const id = newLabel(); G.nodes.push({ id, x, y }); if (!G.src) G.src = id; changed(); say(`Added node ${id}.`, 'ok'); }
function addEdge(a, b) {
  if (a === b) return say('An edge needs two different nodes.', 'err');
  if (!hasNode(a) || !hasNode(b)) return say('One of the nodes does not exist.', 'err');
  if (hasEdge(a, b)) return say(`Edge ${a}–${b} already exists. Click it in Move mode to change its weight.`, 'err');
  const w = parseWeight(); if (w === null) return;
  G.edges.push({ a, b, w }); changed(); say(`Added edge ${a}–${b} with weight ${w}.`, 'ok');
}
function delNode(id) {
  G.nodes = G.nodes.filter(n => n.id !== id); G.edges = G.edges.filter(e => e.a !== id && e.b !== id);
  if (G.src === id) G.src = ''; if (G.dst === id) G.dst = '';
  changed(); say(`Deleted node ${id} and its edges.`, 'ok');
}
function delEdge(key) { G.edges = G.edges.filter(e => ek(e.a, e.b) !== key); changed(); say('Deleted edge.', 'ok'); }
function setWeight(key) {
  const w = parseWeight(); if (w === null) return;
  const e = G.edges.find(x => ek(x.a, x.b) === key); if (e) { e.w = w; changed(); say(`Edge ${e.a}–${e.b} weight set to ${w}.`, 'ok'); }
}
function loadGraph(def) {
  G.nodes = Object.entries(def.nodes).map(([id, [x, y]]) => ({ id, x, y }));
  G.edges = def.edges.map(([a, b, w]) => ({ a, b, w })); G.src = def.src; G.dst = def.dst; UI.pending = null; changed();
}
function loadExample(k) { loadGraph(EXAMPLES[k]); say(`Example ${k} loaded. Press RUN DIJKSTRA or STEP.`, 'ok'); }
function randomGraph() {
  const n = 7, ids = [], nodes = {}, edges = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    const id = String.fromCharCode(65 + i), ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    nodes[id] = [Math.round(400 + 300 * Math.cos(ang)), Math.round(240 + 180 * Math.sin(ang))]; ids.push(id);
  }
  const add = (a, b) => { const k = ek(a, b); if (a !== b && !seen.has(k)) { seen.add(k); edges.push([a, b, 1 + Math.floor(Math.random() * 15)]); } };
  for (let i = 1; i < n; i++) add(ids[i], ids[Math.floor(Math.random() * i)]); // spanning tree keeps it connected
  for (let i = 0; i < 5; i++) add(ids[Math.floor(Math.random() * n)], ids[Math.floor(Math.random() * n)]);
  loadGraph({ nodes, edges, src: 'A', dst: ids[1 + Math.floor(Math.random() * (n - 1))] }); say('Random connected graph generated.', 'ok');
}
function clearGraph() { G.nodes = []; G.edges = []; G.src = G.dst = ''; UI.pending = null; changed(); say('Graph cleared.', 'info'); }

/* ============ RENDERING (SVG, all colours as attributes so PNG export works) ============ */
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function render(step) {
  const svg = $('#graph'); svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  const f = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 4, result: 'b' }, f);
  const mg = el('feMerge', {}, f); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
  const pathKeys = new Set(); if (step && step.path) for (let i = 0; i < step.path.length - 1; i++) pathKeys.add(ek(step.path[i], step.path[i + 1]));
  G.edges.forEach(e => {
    const a = nodeById(e.a), b = nodeById(e.b), k = ek(e.a, e.b); let c = COL.edge, w = 3, glow = false;
    if (step) { if (pathKeys.has(k)) { c = COL.path; w = 6; glow = true; } else if (step.edge === k) { c = COL.current; w = 5; glow = true; } else if (step.tree.has(k)) { c = COL.tree; w = 4; } }
    const g = el('g', { 'data-ek': k }, svg);
    el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': 18 }, g); // wide hit area
    el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', filter: glow ? 'url(#glow)' : 'none' }, g);
    const t = el('text', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 5, fill: '#fff', 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, 'font-family': 'Arial,sans-serif', stroke: '#070c1c', 'stroke-width': 5, 'paint-order': 'stroke' }, g);
    t.textContent = e.w;
  });
  G.nodes.forEach(n => {
    let fill = COL.normal, glow = false;
    if (step) { if (step.visited.has(n.id)) fill = COL.visited; if (step.path && step.path.includes(n.id)) { fill = COL.path; glow = true; } if (step.cur === n.id && step.type !== 'done') { fill = COL.current; glow = true; } }
    const ring = n.id === G.src ? COL.source : n.id === G.dst ? COL.dest : COL.ring;
    const g = el('g', { 'data-id': n.id, style: 'cursor:grab' }, svg);
    if (UI.pending === n.id) el('circle', { cx: n.x, cy: n.y, r: 30, fill: 'none', stroke: '#fff', 'stroke-dasharray': '5 4', 'stroke-width': 2 }, g);
    el('circle', { cx: n.x, cy: n.y, r: 24, fill, stroke: ring, 'stroke-width': ring === COL.ring ? 3 : 6, filter: glow ? 'url(#glow)' : 'none' }, g);
    const lbl = el('text', { x: n.x, y: n.y + 6, fill: fill === COL.path || fill === COL.current ? '#001018' : '#fff', 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, 'font-family': 'Arial,sans-serif', 'pointer-events': 'none' }, g);
    lbl.textContent = n.id;
    if (step) { const d = el('text', { x: n.x, y: n.y - 32, fill: '#00e5ff', 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, 'font-family': 'Arial,sans-serif', 'pointer-events': 'none' }, g); d.textContent = fmt(step.dist[n.id]); }
  });
}

/* ============ STATS + RESULTS ============ */
function stats(step) {
  $('#sNodes').textContent = G.nodes.length; $('#sEdges').textContent = G.edges.length;
  $('#sVisited').textContent = step ? step.visited.size : 0;
  $('#sCur').textContent = step && step.cur ? fmt(step.dist[step.cur]) : '—';
  $('#sShort').textContent = step && step.type === 'done' && step.path ? step.dist[G.dst] : '—';
}
function results(step) {
  $('#rSrc').textContent = G.src || '—'; $('#rDst').textContent = G.dst || '—';
  const done = step && step.type === 'done';
  $('#rDist').textContent = !step ? '—' : done ? (step.path ? step.dist[G.dst] : 'No path exists between the selected nodes.') : '…';
  $('#rPath').textContent = !step ? '—' : done ? (step.path ? step.path.join(' → ') : '—') : '…';
  $('#rVis').textContent = step ? step.visited.size : '—'; $('#rEx').textContent = step ? step.examined : '—';
  $('#rTime').textContent = step ? P.ms.toFixed(3) + ' ms' : '—';
}
function syncSelects() {
  [['#srcSel', 'src'], ['#dstSel', 'dst']].forEach(([sel, key]) => {
    const s = $(sel); s.innerHTML = '<option value="">— select —</option>' + G.nodes.map(n => `<option value="${n.id}">${n.id}</option>`).join(''); s.value = G[key];
  });
}

/* ============ PLAYBACK ============ */
function resetRun(redraw) {
  clearTimeout(P.timer); P.timer = null; P.steps = []; P.i = -1; P.logged = false;
  $('#explain').textContent = 'Run Dijkstra to see each decision explained here.';
  stats(null); results(null); if (redraw) render(null);
}
function changed() { resetRun(false); syncSelects(); stats(null); results(null); render(null); }
function prepare() {
  if (!G.nodes.length) { say('The graph is empty. Add nodes or load an example.', 'err'); return false; }
  if (!G.src) { say('Please select a source node.', 'err'); return false; }
  if (!G.dst) { say('Please select a destination node.', 'err'); return false; }
  if (!hasNode(G.src) || !hasNode(G.dst)) { say('A selected node does not exist.', 'err'); return false; }
  if (G.edges.some(e => e.w < 0 || !Number.isFinite(e.w))) { say('The graph has an invalid edge weight.', 'err'); return false; }
  resetRun(false);
  const t0 = performance.now(); const r = dijkstra(G, G.src, G.dst); P.ms = performance.now() - t0;
  P.steps = r.steps; P.i = -1; P.logged = false;
  say(G.src === G.dst ? 'Source and destination are the same, so the distance is 0.' : '', 'info');
  return true;
}
function nextStep() {
  if (P.i >= P.steps.length - 1) return false;
  const s = P.steps[++P.i];
  render(s); stats(s); results(s); $('#explain').textContent = s.msg;
  if (s.type === 'done') finish(s);
  return s.type !== 'done';
}
function finish(s) {
  if (P.logged) return; P.logged = true; P.runs++;
  const line = '--------------------------------\n';
  const out = `${line}RUN #${P.runs}\nSource: ${G.src}\nDestination: ${G.dst}\n` + (s.path ? `Shortest Distance: ${s.dist[G.dst]}\nShortest Path: ${s.path.join(' → ')}\n` : 'Result: No path exists between the selected nodes.\n') +
    `Nodes Visited: ${s.visited.size}\nEdges Examined: ${s.examined}\n${line}`;
  const log = $('#log'); log.textContent = (P.runs === 1 || log.textContent === 'No runs yet.' ? '' : log.textContent + '\n') + out; log.scrollTop = log.scrollHeight;
  say(s.path ? `Done. Shortest distance ${s.dist[G.dst]}.` : 'No path exists between the selected nodes.', s.path ? 'ok' : 'err');
}
const delay = () => ({ 1: 1400, 2: 700, 3: 180 }[$('#speed').value] || 700);
function tick() { P.timer = null; if (nextStep()) P.timer = setTimeout(tick, delay()); }
function play() { if (P.timer) return; if (!P.steps.length || P.i >= P.steps.length - 1) { if (!prepare()) return; } tick(); }
function pause() { clearTimeout(P.timer); P.timer = null; }
function step() { pause(); if (!P.steps.length || P.i >= P.steps.length - 1) { if (!prepare()) return; } nextStep(); }

/* ============ GRAPH INTERACTION ============ */
function svgPoint(e) { const svg = $('#graph'), p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function initGraphEvents() {
  const svg = $('#graph');
  svg.addEventListener('pointerdown', e => {
    const nodeEl = e.target.closest('[data-id]'), edgeEl = e.target.closest('[data-ek]');
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (UI.mode === 'move') UI.drag = { id, moved: false, shift: e.shiftKey || e.altKey };
      else if (UI.mode === 'delete') delNode(id);
      else if (UI.mode === 'edge') { if (!UI.pending) { UI.pending = id; say(`Edge from ${id}: now click the second node.`, 'info'); render(null); } else { const a = UI.pending; UI.pending = null; addEdge(a, id); } }
    } else if (edgeEl) { if (UI.mode === 'delete') delEdge(edgeEl.dataset.ek); else if (UI.mode === 'move') setWeight(edgeEl.dataset.ek); }
    else if (UI.mode === 'node') { const p = svgPoint(e); addNode(Math.max(30, Math.min(770, p.x)), Math.max(40, Math.min(450, p.y))); }
  });
  window.addEventListener('pointermove', e => {
    if (!UI.drag) return; const n = nodeById(UI.drag.id); if (!n) return; const p = svgPoint(e);
    UI.drag.moved = true; n.x = Math.max(30, Math.min(770, p.x)); n.y = Math.max(40, Math.min(450, p.y));
    render(P.i >= 0 ? P.steps[P.i] : null);
  });
  window.addEventListener('pointerup', () => {
    if (!UI.drag) return; const d = UI.drag; UI.drag = null;
    if (!d.moved) { if (d.shift) G.dst = d.id; else G.src = d.id; changed(); say(`${d.shift ? 'Destination' : 'Source'} set to ${d.id}.`, 'ok'); }
  });
}
function initControls() {
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => {
    UI.mode = b.dataset.mode; UI.pending = null; $$('[data-mode]').forEach(x => x.classList.toggle('active', x === b)); render(P.i >= 0 ? P.steps[P.i] : null);
    say({ move: 'Move: drag nodes, click to set source, Shift-click for destination.', node: 'Add node: click an empty spot on the graph.', edge: 'Add edge: click two nodes (weight from the Weight box).', delete: 'Delete: click a node or edge.' }[UI.mode], 'info');
  }));
  $('#srcSel').addEventListener('change', e => { G.src = e.target.value; changed(); });
  $('#dstSel').addEventListener('change', e => { G.dst = e.target.value; changed(); });
  $('#loadBtn').addEventListener('click', () => loadExample($('#exSel').value));
  $('#randBtn').addEventListener('click', randomGraph);
  $('#clearBtn').addEventListener('click', clearGraph);
  $('#runBtn').addEventListener('click', () => { pause(); if (prepare()) tick(); });
  $('#playBtn').addEventListener('click', play);
  $('#pauseBtn').addEventListener('click', pause);
  $('#stepBtn').addEventListener('click', step);
  $('#resetBtn').addEventListener('click', () => { resetRun(true); say('Run reset. The graph is unchanged.', 'info'); });
  $$('[data-ex]').forEach(b => b.addEventListener('click', () => { $('#exSel').value = b.dataset.ex; loadExample(b.dataset.ex); $('#visualizer').scrollIntoView({ behavior: 'smooth' }); }));
  $('#printBtn').addEventListener('click', () => window.print());
  $('#clearLogBtn').addEventListener('click', () => { $('#log').textContent = 'No runs yet.'; P.runs = 0; });
  $('#copyBtn').addEventListener('click', copyLog);
  $('#dlBtn').addEventListener('click', () => download(new Blob([`Dijkstra's Algorithm — Execution Output\n\n${$('#log').textContent}\n`], { type: 'text/plain' }), 'dijkstra-output.txt'));
  $('#imgBtn').addEventListener('click', downloadPng);
}

/* ============ EXPORT: copy / download / PNG ============ */
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function copyLog() {
  const text = $('#log').textContent;
  const fallback = () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); say('Output copied.', 'ok'); } catch (_) { say('Copy failed. Select the text manually.', 'err'); } t.remove(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => say('Output copied.', 'ok'), fallback); else fallback();
}
function downloadPng() {
  const clone = $('#graph').cloneNode(true); clone.setAttribute('xmlns', NS); clone.setAttribute('width', 1600); clone.setAttribute('height', 960);
  el('rect', { width: 800, height: 480, fill: '#070c1c' }, clone); clone.insertBefore(clone.lastChild, clone.children[1]);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })), img = new Image();
  img.onload = () => { const c = document.createElement('canvas'); c.width = 1600; c.height = 960; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob(b => b ? download(b, 'dijkstra-graph.png') : say('Image export failed.', 'err')); };
  img.onerror = () => { URL.revokeObjectURL(url); say('Image export failed.', 'err'); };
  img.src = url;
}

/* ============ NAVIGATION, EXPLAINER, CARDS, RIPPLE ============ */
function initNav() {
  $$('[data-target]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.target).scrollIntoView({ behavior: 'smooth' })));
  const items = $$('#nav button');
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) items.forEach(b => b.classList.toggle('active', b.dataset.target === en.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  ['home', 'algorithm', 'visualizer', 'examples', 'complexity', 'about'].forEach(id => io.observe($('#' + id)));
}
const HOW = [
  { n: ['A'], e: [], t: 'Choose A as the source node.' }, { n: ['A'], e: [], t: 'distance[A] = 0.' },
  { n: ['B', 'C', 'D'], e: [], t: 'distance[B], distance[C], distance[D] = ∞.' }, { n: ['A'], e: [], t: 'A has the smallest distance (0), so it is selected.' },
  { n: ['A', 'B', 'C'], e: ['AB', 'AC'], t: 'Relax A–B and A–C: B and C get finite distances.' }, { n: ['A'], e: [], t: 'A is marked visited and is never processed again.' },
  { n: ['A', 'B', 'C'], e: ['BC'], t: 'Repeat: pick the next closest node and relax its edges.' }, { n: ['A', 'C', 'D'], e: ['AC', 'CD'], t: 'Follow predecessors back from D to A to build the path.' }
];
function initHow() {
  $$('#steps button').forEach(b => b.addEventListener('click', () => {
    const h = HOW[+b.dataset.step]; $$('#steps button').forEach(x => x.classList.toggle('on', x === b));
    $$('.mn circle').forEach(c => c.classList.toggle('on', h.n.includes(c.id.slice(2)))); $$('.me line').forEach(l => l.classList.toggle('on', h.e.includes(l.id.slice(2))));
    $('#stepText').textContent = h.t;
  }));
}
function initCards() {
  $$('.cards').forEach(group => group.addEventListener('click', e => {
    const c = e.target.closest('.card'); if (!c) return;
    [...group.children].forEach(x => { x.classList.toggle('sel', x === c); x.classList.toggle('dim', x !== c); });
  }));
}
function initRipple() {
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span'), d = Math.max(r.width, r.height) / 4;
    s.className = 'ripple'; s.style.cssText = `width:${d * 2}px;height:${d * 2}px;left:${e.clientX - r.left - d}px;top:${e.clientY - r.top - d}px`;
    b.appendChild(s); s.addEventListener('animationend', () => s.remove());
  });
}

/* ============ CUSTOM CURSOR (fine pointers only) ============ */
function initCursor() {
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  document.body.classList.add('cursor-on');
  const ring = $('#cursor-ring'), dot = $('#cursor-dot'); let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; });
  (function loop() { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
  const sel = 'button,a,input,select,.card,[data-id],[data-ek]';
  document.addEventListener('mouseover', e => ring.classList.toggle('hover', !!e.target.closest(sel)));
  document.addEventListener('mousedown', () => ring.classList.add('down'));
  document.addEventListener('mouseup', () => ring.classList.remove('down'));
}

/* ============ 3D HERO (Three.js) ============ */
function initHero() {
  const cv = $('#bg'); if (!window.THREE) return;
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch (_) { return; }
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100); cam.position.z = 9;
  const N = 38, base = [], pos = new Float32Array(N * 3), pairs = [];
  for (let i = 0; i < N; i++) base.push([(Math.random() - .5) * 16, (Math.random() - .5) * 9, (Math.random() - .5) * 8]);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = Math.hypot(base[i][0] - base[j][0], base[i][1] - base[j][1], base[i][2] - base[j][2]); if (d < 4) pairs.push([i, j]); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x00e5ff, size: 0.22, transparent: true, opacity: 0.95 }));
  const lpos = new Float32Array(pairs.length * 6), lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x7c4dff, transparent: true, opacity: 0.45 }));
  const dust = new Float32Array(180 * 3); for (let i = 0; i < dust.length; i++) dust[i] = (Math.random() - .5) * 24;
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dp = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x4f8cff, size: 0.05 }));
  const group = new THREE.Group(); group.add(pts, lines, dp); scene.add(group);
  let mx = 0, my = 0, visible = true, raf = 0;
  window.addEventListener('mousemove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
  function resize() { const w = cv.clientWidth, h = cv.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();
  function frame(t) {
    raf = 0; if (!visible || document.hidden) return; t *= 0.001;
    for (let i = 0; i < N; i++) { pos[i * 3] = base[i][0] + Math.sin(t + i) * .3; pos[i * 3 + 1] = base[i][1] + Math.cos(t * .8 + i * 2) * .3; pos[i * 3 + 2] = base[i][2] + Math.sin(t * .6 + i * 3) * .3; }
    pairs.forEach(([a, b], k) => { for (let c = 0; c < 3; c++) { lpos[k * 6 + c] = pos[a * 3 + c]; lpos[k * 6 + 3 + c] = pos[b * 3 + c]; } });
    pg.attributes.position.needsUpdate = true; lg.attributes.position.needsUpdate = true;
    group.rotation.y += (mx * 0.8 + t * 0.05 - group.rotation.y) * 0.04; group.rotation.x += (my * 0.5 - group.rotation.x) * 0.04; dp.rotation.y = t * 0.02;
    renderer.render(scene, cam); raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }).observe($('#home'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  start();
}

/* ============ START ============ */
function init() {
  initNav(); initHow(); initCards(); initRipple(); initCursor(); initControls(); initGraphEvents(); initHero();
  loadExample(1); say('', '');
}
document.addEventListener('DOMContentLoaded', init);