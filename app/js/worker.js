// AI-arbetare: kör BioCLIP-bildkodaren (int8 ONNX) helt lokalt och jämför
// bildinbäddningen mot förberäknade textinbäddningar för alla arter.
import * as ort from '../vendor/ort.wasm.min.mjs';

const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];
const SIZE = 224;
// Kalibrerad med tools/calibrate.py på färska svenska fältfoton (BioCLIP:s egen skala är 100,
// vilket gav överdrivet säkra procent).
const LOGIT_SCALE = 55;

let session = null;
let textEmb = null; // Float32Array N*D
let dim = 512;
let n = 0;

ort.env.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

function f16ToF32(buf) {
  const u16 = new Uint16Array(buf);
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i];
    const s = (h & 0x8000) ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) out[i] = s * Math.pow(2, -14) * (f / 1024);
    else if (e === 31) out[i] = f ? NaN : s * Infinity;
    else out[i] = s * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  return out;
}

// Läs direkt ur cachen (oberoende av om service workern styr sidan just nu), annars via nätet.
async function getBuffer(url, what) {
  let res = null;
  try { res = await caches.match(url, { ignoreSearch: true }); } catch { /* caches saknas */ }
  if (!res) res = await fetch(url);
  if (!res.ok) throw new Error(`${what} saknas på enheten – ladda ner AI-modellen igen under Mer (kräver nät)`);
  return res.arrayBuffer();
}

async function init({ modelUrl, embUrl, wasmUrl, count }) {
  const [modelBuf, embBuf, wasmBuf] = await Promise.all([
    getBuffer(modelUrl, 'AI-modellen'), getBuffer(embUrl, 'Artdata för AI'), wasmUrl ? getBuffer(wasmUrl, 'AI-motorn') : null,
  ]);
  if (wasmBuf) {
    const b = new Uint8Array(wasmBuf, 0, 4);
    if (b[0] !== 0 || b[1] !== 0x61 || b[2] !== 0x73 || b[3] !== 0x6d) throw new Error('AI-motorn är skadad i cachen – ladda ner AI-modellen igen under Mer');
    ort.env.wasm.wasmBinary = wasmBuf;
  }
  textEmb = f16ToF32(embBuf);
  n = count;
  dim = textEmb.length / n;
  if (dim !== 512) throw new Error('Artdata och AI-data matchar inte – ladda om appen med nätanslutning');
  session = await ort.InferenceSession.create(modelBuf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

function toTensor(imageData) {
  const { data } = imageData;
  const plane = SIZE * SIZE;
  const arr = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    arr[i] = (data[i * 4] / 255 - MEAN[0]) / STD[0];
    arr[plane + i] = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
    arr[2 * plane + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
  }
  return new ort.Tensor('float32', arr, [1, 3, SIZE, SIZE]);
}

async function embed(imageData) {
  const out = await session.run({ pixel_values: toTensor(imageData) });
  return out.embedding.data; // redan L2-normerad
}

function normalize(v) {
  let norm = 0;
  for (let d = 0; d < dim; d++) norm += v[d] * v[d];
  norm = Math.sqrt(norm) || 1;
  for (let d = 0; d < dim; d++) v[d] /= norm;
  return v;
}

// Bildinbäddning för ett foto (flera vyer av samma foto medelvärdesbildas). Beror inte på
// vald artgrupp/lista, så appen cachar den och behöver bara ranka om vid gruppbyte.
async function embedPhoto({ images }) {
  const t0 = performance.now();
  const v = new Float32Array(dim);
  for (const img of images) {
    const e = await embed(img);
    for (let d = 0; d < dim; d++) v[d] += e[d];
  }
  return { vec: normalize(v), ms: Math.round(performance.now() - t0) };
}

// vectors: en inbäddning per foto av samma individ -> medelvärde -> jämförs mot kandidatarterna.
function rank({ vectors, candidates, topK = 10 }) {
  const v = new Float32Array(dim);
  for (const e of vectors) for (let d = 0; d < dim; d++) v[d] += e[d];
  normalize(v);
  const idx = candidates && candidates.length ? candidates : [...Array(n).keys()];
  const sims = new Float32Array(idx.length);
  let maxLogit = -Infinity, maxSim = -1;
  for (let j = 0; j < idx.length; j++) {
    const off = idx[j] * dim;
    let s = 0;
    for (let d = 0; d < dim; d++) s += textEmb[off + d] * v[d];
    sims[j] = s;
    if (s > maxSim) maxSim = s;
    if (s * LOGIT_SCALE > maxLogit) maxLogit = s * LOGIT_SCALE;
  }
  const probs = new Float32Array(idx.length);
  let sum = 0;
  for (let j = 0; j < idx.length; j++) { probs[j] = Math.exp(sims[j] * LOGIT_SCALE - maxLogit); sum += probs[j]; }
  const all = [];
  for (let j = 0; j < idx.length; j++) all.push({ id: idx[j], p: probs[j] / sum, sim: sims[j] });
  all.sort((a, b) => b.p - a.p);
  return { top: all.slice(0, topK), all: all.slice(0, 200), maxSim };
}

self.onmessage = async (ev) => {
  const { id, type, payload } = ev.data;
  try {
    let result;
    if (type === 'init') result = await init(payload);
    else if (type === 'embed') result = await embedPhoto(payload);
    else if (type === 'rank') result = rank(payload);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
