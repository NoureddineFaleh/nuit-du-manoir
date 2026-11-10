'use strict';
// Générateur d'énigmes : un code de 4 symboles parmi 6, et des indices vrais répartis entre les joueurs.
// Garantie : l'ensemble des indices a UNE seule solution, et aucun joueur seul ne peut la trouver.
const U = require('../../util');

const NG = 6;
const LEN = 4;
const ALL = [];
for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) for (let c = 0; c < NG; c++) for (let d = 0; d < NG; d++) {
  if (new Set([a, b, c, d]).size === 4) ALL.push([a, b, c, d]);
}

function holds(cl, code) {
  const pos = (g) => code.indexOf(g);
  switch (cl.k) {
    case 'at': return code[cl.p] === cl.g;
    case 'notAt': return code[cl.p] !== cl.g;
    case 'present': return pos(cl.g) >= 0;
    case 'absent': return pos(cl.g) < 0;
    case 'before': return pos(cl.a) >= 0 && pos(cl.b) >= 0 && pos(cl.a) < pos(cl.b);
    case 'adjacent': return pos(cl.a) >= 0 && pos(cl.b) >= 0 && Math.abs(pos(cl.a) - pos(cl.b)) === 1;
    case 'parity': return pos(cl.g) >= 0 && (pos(cl.g) % 2 === 0) === cl.odd; // position 1-indexée : index pair = position impaire
    default: return false;
  }
}

function randomClue(code) {
  const g = U.rnd(NG);
  const kinds = ['at', 'notAt', 'present', 'absent', 'before', 'adjacent', 'parity', 'notAt', 'before'];
  for (let tries = 0; tries < 40; tries++) {
    const k = U.pick(kinds);
    const cl = { k, g: U.rnd(NG), a: U.rnd(NG), b: U.rnd(NG), p: U.rnd(LEN), odd: Math.random() < 0.5 };
    if ((k === 'before' || k === 'adjacent') && cl.a === cl.b) continue;
    if (holds(cl, code)) return cl;
  }
  return { k: 'present', g: code[0] };
}

const count = (clues) => ALL.reduce((n, c) => n + (clues.every((cl) => holds(cl, c)) ? 1 : 0), 0);

/** Retourne { code, clues: [[clue,...] par joueur] } */
function generate(players) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const code = U.pick(ALL);
    const clues = [];
    let left = ALL.length;
    // chaque indice retenu est le plus utile parmi quelques candidats (évite les indices inutiles)
    let guard = 0;
    while (left > 1 && guard++ < 40) {
      let best = null;
      let bestN = Infinity;
      for (let i = 0; i < 25; i++) {
        const cl = randomClue(code);
        const n = count(clues.concat(cl));
        if (n < left && n < bestN) { best = cl; bestN = n; }
      }
      if (!best) break;
      clues.push(best);
      left = bestN;
    }
    if (left !== 1) continue;
    // au moins un indice par joueur
    let guard2 = 0;
    while (clues.length < players + 1 && guard2++ < 50) clues.push(randomClue(code));
    const shuffled = U.shuffle(clues);
    const per = Array.from({ length: players }, () => []);
    shuffled.forEach((cl, i) => per[i % players].push(cl));
    // coopération obligatoire : personne ne trouve seul
    const ok = per.every((set) => count(set) > 1);
    if (ok || attempt === 59) return { code, clues: per };
  }
  throw new Error('génération impossible');
}

function feedback(code, guess) {
  let exact = 0;
  let near = 0;
  guess.forEach((g, i) => { if (code[i] === g) exact++; else if (code.includes(g)) near++; });
  return { exact, near };
}

module.exports = { generate, holds, count, feedback, ALL, NG, LEN };
