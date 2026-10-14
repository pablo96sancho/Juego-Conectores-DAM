import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildChallenge, gradeChallenge, USB_SPEEDS } from '../js/showdown.js';
import { evaluateHand } from '../js/hands.js';

const connectors = JSON.parse(readFileSync(new URL('../data/conectores.json', import.meta.url)));
const byId = new Map(connectors.map(c => [c.id, c]));
const c = (connectorId, type) => ({ kind: 'conector', connectorId, type });

const pair13 = [c(13, 'foto'), c(13, 'nombre'), c(1, 'foto'), c(5, 'foto'), c(9, 'foto')];

test('reto básico: 2 preguntas de 3 opciones sin repetidas y con una correcta', () => {
  const qs = buildChallenge(evaluateHand(pair13), connectors, Math.random);
  assert.equal(qs.length, 2);
  for (const q of qs) {
    assert.equal(q.options.length, 3);
    assert.equal(new Set(q.options).size, 3);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 3);
  }
});

test('las respuestas correctas coinciden con los datos del conector', () => {
  const [f, u] = buildChallenge(evaluateHand(pair13), connectors, Math.random);
  assert.match(f.prompt, /HDMI/);
  assert.equal(f.options[f.correctIndex], byId.get(13).funcion);
  assert.equal(u.options[u.correctIndex], byId.get(13).ubicacion);
});

test('los distractores salen de conectores parecidos', () => {
  for (let i = 0; i < 20; i++) {
    const [f] = buildChallenge(evaluateHand(pair13), connectors, Math.random);
    const similar = connectors.filter(x => x.id !== 13 && (x.tipo === 'externo' || x.ubicacion === byId.get(13).ubicacion));
    const wrong = f.options.filter((_, idx) => idx !== f.correctIndex);
    for (const w of wrong) assert.ok(similar.some(x => x.funcion === w));
  }
});

test('doble pareja: la segunda pregunta es sobre la pareja menor', () => {
  const ev = evaluateHand([c(13, 'foto'), c(13, 'nombre'), c(2, 'foto'), c(2, 'nombre'), c(9, 'foto')]);
  const [, u] = buildChallenge(ev, connectors, Math.random);
  assert.match(u.prompt, /EPS/);
});

test('carta especial Trampa añade una pregunta sobre la función', () => {
  const ev = evaluateHand([c(13, 'foto'), c(13, 'nombre'), { kind: 'trampa', pair: [13, 14] }, c(1, 'foto'), c(5, 'foto')]);
  const qs = buildChallenge(ev, connectors, Math.random);
  assert.equal(qs.length, 3);
  assert.equal(qs[2].options[qs[2].correctIndex], byId.get(13).funcion);
  // la función del otro conector del par aparece como distractor
  assert.ok(qs[2].options.includes(byId.get(14).funcion));
});

test('comodín USB pregunta una velocidad real', () => {
  const ev = evaluateHand([c(12, 'foto'), c(12, 'nombre'), c(12, 'funcion'), { kind: 'comodinUsb' }, c(1, 'foto')]);
  const qs = buildChallenge(ev, connectors, Math.random);
  assert.equal(qs.length, 3);
  const q = qs[2];
  const version = USB_SPEEDS.find(u => q.prompt.includes(u.version + '?'));
  assert.ok(version);
  assert.equal(q.options[q.correctIndex], version.speed);
});

test('comodín Anti-error pregunta la característica anti-error', () => {
  const ev = evaluateHand([c(8, 'foto'), c(8, 'nombre'), c(8, 'funcion'), { kind: 'comodinAntiError' }, c(15, 'foto')]);
  const q = buildChallenge(ev, connectors, Math.random)[2];
  assert.equal(q.options[q.correctIndex], byId.get(8).antiError);
});

test('gradeChallenge exige todas correctas', () => {
  const qs = buildChallenge(evaluateHand(pair13), connectors, Math.random);
  const right = qs.map(q => q.correctIndex);
  assert.equal(gradeChallenge(qs, right).passed, true);
  const wrong = [...right];
  wrong[1] = (wrong[1] + 1) % 3;
  const g = gradeChallenge(qs, wrong);
  assert.equal(g.passed, false);
  assert.deepEqual(g.correct, [true, false]);
  assert.equal(gradeChallenge(qs, []).passed, false);
});
