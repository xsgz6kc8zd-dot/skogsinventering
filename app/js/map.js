// Kartmodul: Leaflet (laddas som global L i index.html).
// Bakgrund: OpenStreetMap (bara online), Lantmäteriets topografiska webbkarta med egen API-nyckel
// (kan laddas ner per område för offline) eller egen plattadress. Tematiska lager från Skogsstyrelsen
// (öppna data): online som kartbilder, eller nedladdade som GeoJSON för offline.

export const SKS_BASE = 'https://geodpags.skogsstyrelsen.se/arcgis/rest/services/Geodataportal/GeodataportalVisa';
export const SKS_LAYERS = [
  { id: 'nyckelbiotop', name: 'Nyckelbiotoper', service: 'Nyckelbiotop', color: '#d81b60', sub: [0] },
  { id: 'naturvarde', name: 'Objekt med naturvärden', service: 'Objektnaturvarde', color: '#8e24aa', sub: [0] },
  { id: 'sumpskog', name: 'Sumpskog', service: 'Sumpskog', color: '#1e88e5', sub: [0] },
  { id: 'avverkning', name: 'Avverkningsanmälningar', service: 'Avverkningsanmalan', color: '#f4511e', sub: [0] },
  { id: 'biotopskydd', name: 'Biotopskyddsområden', service: 'Biotopskydd', color: '#00897b', sub: [0] },
  { id: 'naturvardsavtal', name: 'Naturvårdsavtal', service: 'Naturvardsavtal', color: '#43a047', sub: [0] },
  { id: 'skoghistoria', name: 'Skoghistoria (kulturlämningar)', service: 'Skoghistoria', color: '#6d4c41', sub: [0, 1, 2] },
];

export const BASES = {
  osm: { name: 'OpenStreetMap (kräver nät)', url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bidragsgivare', maxZoom: 19, offline: false },
  lmtopo: {
    name: 'Lantmäteriet terrängkarta (egen nyckel)', maxZoom: 17, offline: true, attr: '© Lantmäteriet',
    url: s => s.lmKey ? `https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/token/${encodeURIComponent(s.lmKey)}/1.0.0/topowebb/default/3857/{z}/{y}/{x}.png` : null,
  },
  custom: { name: 'Egen plattadress (XYZ)', url: s => s.customTiles || null, attr: '', maxZoom: 19, offline: true },
  none: { name: 'Ingen bakgrund', url: () => null, attr: '', maxZoom: 21, offline: true },
};
const TILE_CACHE = 'skog-tiles-v1';

// Skogsstyrelsens kartbild för en platta (ArcGIS export i EPSG:3857)
const SksTile = () => L.TileLayer.extend({
  getTileUrl(c) {
    const ts = this.getTileSize();
    const nw = this._map.unproject([c.x * ts.x, c.y * ts.y], c.z), se = this._map.unproject([(c.x + 1) * ts.x, (c.y + 1) * ts.y], c.z);
    const a = L.CRS.EPSG3857.project(nw), b = L.CRS.EPSG3857.project(se);
    return `${SKS_BASE}${this.options.service}/MapServer/export?bbox=${a.x},${b.y},${b.x},${a.y}&bboxSR=3857&imageSR=3857&size=${ts.x},${ts.y}&format=png32&transparent=true&layers=show:${this.options.sub.join(',')}&f=image`;
  },
});

function featureLabel(p) {
  return p.Objnamn || p.Namn || p.Benamning || p.Beteckn || p.Arendenr || p.Lamningstyp || p.Kategori || '';
}

export function createMap(el, { onObsClick, onObjectClick, onMapClick } = {}) {
  const map = L.map(el, { zoomControl: false, attributionControl: true, tap: true }).setView([62.4, 16.5], 5);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  let base = null; const overlays = new Map();
  const dataLayer = L.layerGroup().addTo(map), meLayer = L.layerGroup().addTo(map), trackLayer = L.layerGroup(), drawLayer = L.layerGroup().addTo(map);
  let draw = null;
  map.on('click', e => { if (draw) { draw.add(e.latlng); return; } onMapClick && onMapClick(e.latlng); });

  const api = {
    map,
    setBase(id, settings) {
      if (base) { map.removeLayer(base); base = null; }
      const def = BASES[id] || BASES.osm;
      const url = def.url(settings || {});
      if (url) base = L.tileLayer(url, { maxZoom: def.maxZoom, maxNativeZoom: Math.min(def.maxZoom, 19), attribution: def.attr, crossOrigin: true }).addTo(map);
      el.classList.toggle('nobase', !url);
      return !!url || id === 'none';
    },
    // ids: aktiva lager; vectors: { id: {features} } nedladdade för offline (används i första hand)
    setOverlays(ids, vectors = {}) {
      for (const [, l] of overlays) map.removeLayer(l);
      overlays.clear();
      for (const def of SKS_LAYERS.filter(d => ids.includes(d.id))) {
        let layer;
        const v = vectors[def.id];
        if (v && v.features) {
          layer = L.geoJSON(v, {
            style: { color: def.color, weight: 2, fillOpacity: .18 },
            pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 7, color: def.color, fillOpacity: .6 }),
            onEachFeature: (f, l) => l.bindPopup(`<b>${def.name}</b><br>${escapeHtml(featureLabel(f.properties || {}))}`),
          });
        } else {
          const T = SksTile();
          layer = new T('', { service: def.service, sub: def.sub, opacity: .75, maxZoom: 21, attribution: '© Skogsstyrelsen' });
        }
        layer.addTo(map); overlays.set(def.id, layer);
      }
    },
    drawData({ observations, objects, species, colorOf, track, activeObjectId }) {
      dataLayer.clearLayers();
      for (const ob of objects) {
        if (!ob.polygon || ob.polygon.length < 2) continue;
        const ll = ob.polygon.map(p => [p.lat, p.lon]);
        const shape = ob.polygon.length >= 3 ? L.polygon(ll, { color: '#ffd600', weight: ob.id === activeObjectId ? 5 : 3, fillOpacity: .12, fillColor: '#ffd600' })
          : L.polyline(ll, { color: '#ffd600', weight: 3, dashArray: '6 6' });
        shape.bindTooltip(ob.name, { permanent: true, direction: 'center', className: 'obj-label' });
        shape.on('click', e => { if (draw) return; L.DomEvent.stopPropagation(e); onObjectClick && onObjectClick(ob.id); });
        shape.addTo(dataLayer);
      }
      for (const o of observations) {
        if (!o.pos) continue;
        const sp = species[o.speciesId] || {};
        const nv = !!(sp.rl && sp.rl !== 'DD') || !!sp.sig;
        const m = L.circleMarker([o.pos.lat, o.pos.lon], { radius: nv ? 9 : 7, color: nv ? '#d32f2f' : '#fff', weight: nv ? 3 : 2, fillColor: colorOf(sp), fillOpacity: .95 });
        m.on('click', e => { if (draw) return; L.DomEvent.stopPropagation(e); onObsClick && onObsClick(o.id); });
        m.addTo(dataLayer);
      }
      trackLayer.clearLayers();
      if (track && track.length > 1) L.polyline(track.map(p => [p.lat, p.lon]), { color: '#00b0ff', weight: 3, opacity: .8 }).addTo(trackLayer);
    },
    showTrack(on) { on ? trackLayer.addTo(map) : map.removeLayer(trackLayer); },
    setMe(p) {
      meLayer.clearLayers();
      if (!p) return;
      L.circle([p.lat, p.lon], { radius: p.acc, color: '#111', weight: 1, fillOpacity: .08, interactive: false }).addTo(meLayer);
      L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#111', fillOpacity: 1, interactive: false }).addTo(meLayer);
    },
    fit(objects, observations, me) {
      const pts = [];
      for (const ob of objects) for (const p of ob.polygon || []) pts.push([p.lat, p.lon]);
      for (const o of observations) if (o.pos) pts.push([o.pos.lat, o.pos.lon]);
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 17 });
      else if (me) map.setView([me.lat, me.lon], 15);
    },
    center(p, z) { map.setView([p.lat, p.lon], z || Math.max(map.getZoom(), 15)); },
    // Ritläge: tryck på kartan lägger till hörn, hörnen kan dras
    startDraw(points, onChange) {
      draw = { pts: points.map(p => ({ lat: p.lat, lon: p.lon })) };
      const redraw = () => {
        drawLayer.clearLayers();
        const ll = draw.pts.map(p => [p.lat, p.lon]);
        if (ll.length >= 2) (ll.length >= 3 ? L.polygon(ll, { color: '#ffd600', weight: 3, fillOpacity: .15, interactive: false }) : L.polyline(ll, { color: '#ffd600', weight: 3, interactive: false })).addTo(drawLayer);
        draw.pts.forEach((p, i) => {
          const mk = L.marker([p.lat, p.lon], { draggable: true, icon: L.divIcon({ className: 'vtx', iconSize: [26, 26] }) }).addTo(drawLayer);
          mk.on('drag', e => { const q = e.target.getLatLng(); draw.pts[i] = { lat: q.lat, lon: q.lng }; });
          mk.on('dragend', () => { redraw(); onChange(draw.pts); });
        });
        onChange(draw.pts);
      };
      draw.add = latlng => { draw.pts.push({ lat: latlng.lat, lon: latlng.lng }); redraw(); };
      draw.undo = () => { draw.pts.pop(); redraw(); };
      redraw();
      if (draw.pts.length >= 3) map.fitBounds(L.latLngBounds(draw.pts.map(p => [p.lat, p.lon])).pad(0.4));
      return draw;
    },
    stopDraw() { const pts = draw ? draw.pts : null; draw = null; drawLayer.clearLayers(); return pts; },
    get drawing() { return !!draw; },
    invalidate() { setTimeout(() => map.invalidateSize(), 50); },
  };
  return api;
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Nedladdning för offline ----------
// Skogsstyrelsens lager som GeoJSON inom ett område (bounds = [[s,w],[n,e]])
export async function downloadSksLayers(bounds, ids, onProgress) {
  const [[s, w], [n, e]] = bounds;
  const out = {};
  let i = 0;
  for (const def of SKS_LAYERS.filter(d => ids.includes(d.id))) {
    const features = [];
    for (const sub of def.sub) {
      for (let offset = 0; offset < 20000; offset += 1000) {
        const url = `${SKS_BASE}${def.service}/MapServer/${sub}/query?where=1%3D1&geometry=${w},${s},${e},${n}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=1000`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${def.name}: HTTP ${r.status}`);
        const j = await r.json();
        features.push(...(j.features || []));
        if (!j.features || j.features.length < 1000) break;
      }
    }
    out[def.id] = { type: 'FeatureCollection', features, bounds, fetched: Date.now() };
    onProgress && onProgress(++i / ids.length, def.name, features.length);
  }
  return out;
}

const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
export function countTiles(bounds, zmin, zmax) {
  const [[s, w], [n, e]] = bounds; let c = 0;
  for (let z = zmin; z <= zmax; z++) c += (lon2x(e, z) - lon2x(w, z) + 1) * (lat2y(s, z) - lat2y(n, z) + 1);
  return c;
}
// Bakgrundsplattor till Cache Storage (bara för källor som tillåter det: Lantmäteriet, egen adress)
export async function downloadTiles(template, bounds, zmin, zmax, onProgress, signal) {
  const cache = await caches.open(TILE_CACHE);
  const [[s, w], [n, e]] = bounds;
  const total = countTiles(bounds, zmin, zmax); let done = 0, bytes = 0, failed = 0;
  for (let z = zmin; z <= zmax; z++) {
    for (let x = lon2x(w, z); x <= lon2x(e, z); x++) {
      for (let y = lat2y(n, z); y <= lat2y(s, z); y++) {
        if (signal && signal.aborted) throw new Error('Avbrutet');
        const url = template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        if (!(await cache.match(url))) {
          try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) { const b = await r.blob(); bytes += b.size; await cache.put(url, new Response(b, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'image/png' } })); } else failed++; }
          catch { failed++; }
        }
        onProgress && onProgress(++done / total, bytes, failed);
      }
    }
  }
  return { total, bytes, failed };
}
export { TILE_CACHE };
