// Geodesi: WGS84 -> SWEREF 99 TM (Lantmäteriets Gauss–Krüger-formler), avstånd och area.

const A = 6378137.0;
const F = 1 / 298.257222101; // GRS 80
const LON0 = 15.0;
const K0 = 0.9996;
const FN = 0.0;
const FE = 500000.0;

export function toSweref99TM(lat, lon) {
  const e2 = F * (2 - F);
  const n = F / (2 - F);
  const aRoof = A / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const Aa = e2;
  const B = (5 * e2 * e2 - e2 ** 3) / 6;
  const C = (104 * e2 ** 3 - 45 * e2 ** 4) / 120;
  const D = (1237 * e2 ** 4) / 1260;
  const b1 = n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180;
  const b2 = 13 * n * n / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440;
  const b3 = 61 * n ** 3 / 240 - 103 * n ** 4 / 140;
  const b4 = 49561 * n ** 4 / 161280;
  const rad = Math.PI / 180;
  const phi = lat * rad;
  const dl = (lon - LON0) * rad;
  const s = Math.sin(phi);
  const phiStar = phi - s * Math.cos(phi) * (Aa + B * s ** 2 + C * s ** 4 + D * s ** 6);
  const xiP = Math.atan(Math.tan(phiStar) / Math.cos(dl));
  const etaP = Math.atanh(Math.cos(phiStar) * Math.sin(dl));
  const N = K0 * aRoof * (xiP + b1 * Math.sin(2 * xiP) * Math.cosh(2 * etaP) + b2 * Math.sin(4 * xiP) * Math.cosh(4 * etaP)
    + b3 * Math.sin(6 * xiP) * Math.cosh(6 * etaP) + b4 * Math.sin(8 * xiP) * Math.cosh(8 * etaP)) + FN;
  const E = K0 * aRoof * (etaP + b1 * Math.cos(2 * xiP) * Math.sinh(2 * etaP) + b2 * Math.cos(4 * xiP) * Math.sinh(4 * etaP)
    + b3 * Math.cos(6 * xiP) * Math.sinh(6 * etaP) + b4 * Math.cos(8 * xiP) * Math.sinh(8 * etaP)) + FE;
  return { N: Math.round(N), E: Math.round(E) };
}

export function distanceM(a, b) {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Area (m²) för polygon i WGS84 via SWEREF 99 TM (shoelace)
export function polygonAreaM2(points) {
  if (!points || points.length < 3) return 0;
  const p = points.map(q => toSweref99TM(q.lat, q.lon));
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    s += p[i].E * p[j].N - p[j].E * p[i].N;
  }
  return Math.abs(s) / 2;
}

export function formatArea(m2) {
  if (!m2) return '–';
  return m2 >= 10000 ? `${(m2 / 10000).toFixed(2)} ha` : `${Math.round(m2)} m²`;
}

// Håller en löpande GPS-bevakning och ger senaste/bästa position.
export class GpsTracker {
  constructor() { this.last = null; this.listeners = new Set(); this.watchId = null; this.error = null; }
  start() {
    if (!('geolocation' in navigator) || this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        this.error = null;
        this.last = {
          lat: pos.coords.latitude, lon: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy), alt: pos.coords.altitude != null ? Math.round(pos.coords.altitude) : null,
          t: pos.timestamp,
        };
        this.listeners.forEach(fn => fn(this.last));
      },
      err => { this.error = err.message; this.listeners.forEach(fn => fn(null, err)); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }
  stop() { if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  fresh(maxAgeMs = 60000) { return this.last && Date.now() - this.last.t < maxAgeMs ? this.last : null; }
}

// SWEREF 99 TM -> WGS84 (Lantmäteriets inversa Gauss–Krüger-formler)
export function fromSweref99TM(N, E) {
  const e2 = F * (2 - F);
  const n = F / (2 - F);
  const aRoof = A / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const d1 = n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96 - n ** 4 / 360;
  const d2 = n * n / 48 + n ** 3 / 15 - 437 * n ** 4 / 1440;
  const d3 = 17 * n ** 3 / 480 - 37 * n ** 4 / 840;
  const d4 = 4397 * n ** 4 / 161280;
  const As = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
  const Bs = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
  const Cs = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
  const Ds = -(4279 * e2 ** 4) / 1260;
  const xi = (N - FN) / (K0 * aRoof), eta = (E - FE) / (K0 * aRoof);
  const xiP = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
    - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
  const etaP = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
    - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
  const phiS = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  const dl = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
  const s = Math.sin(phiS);
  const phi = phiS + s * Math.cos(phiS) * (As + Bs * s ** 2 + Cs * s ** 4 + Ds * s ** 6);
  return { lat: phi * 180 / Math.PI, lon: LON0 + dl * 180 / Math.PI };
}

// Generalisering till rutnät i SWEREF 99 TM (som Artportalen): rutans mittpunkt och hörn i WGS84
export function generalizeToGrid(lat, lon, km) {
  const cell = km * 1000;
  const { N, E } = toSweref99TM(lat, lon);
  const n0 = Math.floor(N / cell) * cell, e0 = Math.floor(E / cell) * cell;
  const corners = [[n0, e0], [n0, e0 + cell], [n0 + cell, e0 + cell], [n0 + cell, e0], [n0, e0]].map(([n, e]) => fromSweref99TM(n, e));
  return { center: fromSweref99TM(n0 + cell / 2, e0 + cell / 2), N: n0 + cell / 2, E: e0 + cell / 2, corners, km };
}
