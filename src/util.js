'use strict';

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shuffle(arr) {
  const r = arr.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

let counter = 0;
const uid = () => 'p' + (++counter).toString(36) + Math.random().toString(36).slice(2, 6);

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

module.exports = { rnd, pick, clamp, shuffle, uid, norm };
