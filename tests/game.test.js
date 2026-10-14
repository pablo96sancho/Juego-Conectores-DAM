import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createGame, applyBetting, applyDraw, submitChallenge, nextHand, runBots, beginShowdown,
  legalActions, START_CHIPS,
} from '../js/game.js';
import { botBetAction, botDiscards } from '../js/bots.js';
import { evaluateHand } from '../js/hands.js';

const connectors = JSON.parse(readFileSync(new URL('../data/conectores.json', import.meta.url)));
const c = (connectorId, type) => ({ kind: 'conector', connectorId, type });

// Generador pseudoaleatorio con semilla (mulberry32)
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const total = g => g.players.reduce((s, p) => s + p.chips, 0) + g.pot;
const newGame = (opts = {}) => createGame({ connectors, rng: seeded(1), ...opts });

test('la mano empieza con ante, 5 cartas y turno del humano', () => {
  const g = newGame();
  assert.equal(g.players.length, 3);
  for (const p of g.players) {
    assert.equal(p.chips, START_CHIPS - 1);
    assert.equal(p.hand.length, 5);
  }
  assert.equal(g.pot, 3);
  assert.equal(g.phase, 'betting1');
  assert.equal(g.turn, 0);
});

test('no se puede pasar con una apuesta pendiente ni actuar fuera de turno', () => {
  const g = newGame();
  assert.throws(() => applyBetting(g, 1, { type: 'check' }), /turno/);
  applyBetting(g, 0, { type: 'bet', amount: 1 });
  assert.throws(() => applyBetting(g, 1, { type: 'check' }), /igualar/);
  assert.throws(() => applyBetting(g, 1, { type: 'bet', amount: 3 }), /no permitida/);
});

test('apostar máximo 2 y una sola subida por jugador y ronda', () => {
  const g = newGame();
  assert.equal(legalActions(g, 0).maxBet, 2);
  applyBetting(g, 0, { type: 'bet', amount: 2 });
  applyBetting(g, 1, { type: 'bet', amount: 1 }); // sube
  applyBetting(g, 2, { type: 'call' });
  assert.equal(g.turn, 0);
  assert.equal(legalActions(g, 0).canBet, false);
  assert.throws(() => applyBetting(g, 0, { type: 'bet', amount: 1 }), /no permitida/);
  applyBetting(g, 0, { type: 'call' });
  // Todos han igualado 3 fichas: la ronda se cierra y empieza el cambio de cartas
  assert.equal(g.phase, 'draw');
  assert.equal(g.pot, 3 + 3 * 3);
});

test('si todos se retiran gana el último sin showdown', () => {
  const g = newGame();
  applyBetting(g, 0, { type: 'bet', amount: 1 });
  applyBetting(g, 1, { type: 'fold' });
  applyBetting(g, 2, { type: 'fold' });
  assert.equal(g.phase, 'handOver');
  assert.equal(g.result.byFold, true);
  assert.equal(g.players[0].chips, START_CHIPS - 1 - 1 + 4);
  assert.equal(total(g), 3 * START_CHIPS);
});

test('todos pasan: se cambian cartas y empieza la segunda ronda', () => {
  const g = newGame();
  for (const id of [0, 1, 2]) applyBetting(g, id, { type: 'check' });
  assert.equal(g.phase, 'draw');
  const before = g.players[0].hand.map(x => x.uid);
  applyDraw(g, 0, [0, 1]);
  const after = g.players[0].hand.map(x => x.uid);
  assert.notEqual(before[0], after[0]);
  assert.equal(before[4], after[4]);
  assert.throws(() => applyDraw(g, 1, [0, 1, 2, 3]), /no permitido/);
  applyDraw(g, 1, []);
  applyDraw(g, 2, [0, 1, 2]);
  assert.equal(g.phase, 'betting2');
  assert.equal(g.players[0].hand.length, 5);
});

// Prepara un showdown directo con manos fijas
function showdownSetup(hands, opts) {
  const g = newGame(opts);
  hands.forEach((h, i) => { g.players[i].hand = h; });
  g.pot = 10;
  g.players.forEach(p => { p.chips = START_CHIPS - 1; });
  beginShowdown(g);
  return g;
}
const poker7 = [c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(7, 'ubicacion'), c(1, 'foto')];
const pair4 = [c(4, 'foto'), c(4, 'nombre'), c(1, 'foto'), c(9, 'foto'), c(15, 'foto')];
const high = [c(1, 'foto'), c(3, 'nombre'), c(5, 'funcion'), c(8, 'ubicacion'), c(12, 'foto')];
const correctAnswers = g => g.challenge.questions.map(q => q.correctIndex);

test('showdown: la mejor mano supera el reto y cobra el bote', () => {
  const g = showdownSetup([poker7, pair4, high], { botPassProb: 1 });
  assert.equal(g.phase, 'challenge');
  assert.equal(g.challenge.playerId, 0);
  const grade = submitChallenge(g, correctAnswers(g));
  assert.equal(grade.passed, true);
  assert.equal(g.phase, 'handOver');
  assert.deepEqual(g.result.winners, [0]);
  assert.equal(g.players[0].chips, START_CHIPS - 1 + 10);
});

test('showdown: fallar el reto cuesta 2 fichas y pasa al siguiente mejor', () => {
  const g = showdownSetup([poker7, pair4, high], { botPassProb: 1 });
  const wrong = correctAnswers(g).map(a => (a + 1) % 3);
  submitChallenge(g, wrong);
  assert.equal(g.players[0].chips, START_CHIPS - 1 - 2);
  assert.deepEqual(g.result.winners, [1]);
  assert.equal(g.players[1].chips, START_CHIPS - 1 + 12); // bote 10 + 2 de la penalización
  assert.equal(total(g), 3 * (START_CHIPS - 1) + 10);
});

test('showdown: si nadie supera el reto el bote se acumula', () => {
  const g = showdownSetup([poker7, pair4, high], { botPassProb: 0 });
  submitChallenge(g, correctAnswers(g).map(a => (a + 1) % 3));
  assert.equal(g.phase, 'handOver');
  assert.equal(g.result.carried, true);
  assert.equal(g.pot, 10 + 2 + 2 + 2);
  const pot = g.pot;
  nextHand(g);
  assert.equal(g.handNumber, 2);
  assert.equal(g.pot, pot + 3); // el bote acumulado más los nuevos antes
});

test('showdown: empate entre bots, los que superan el reto reparten el bote', () => {
  const g = showdownSetup([high, pair4, pair4], { botPassProb: 1 });
  assert.equal(g.phase, 'handOver');
  assert.deepEqual(g.result.winners, [1, 2]);
  assert.equal(g.players[1].chips, START_CHIPS - 1 + 5);
  assert.equal(g.players[2].chips, START_CHIPS - 1 + 5);
});

test('los bots evalúan y descartan sin romper reglas', () => {
  assert.ok(botDiscards(pair4).length <= 3);
  assert.deepEqual(botDiscards(pair4).sort(), [2, 3, 4]);
  assert.equal(botDiscards([c(1, 'foto'), c(1, 'nombre'), c(1, 'funcion'), c(1, 'ubicacion'), c(2, 'foto')]).length, 1);
  const legal = { toCall: 0, canCheck: true, canBet: true, maxBet: 2 };
  assert.equal(botBetAction(evaluateHand(poker7), legal, () => 0).type, 'bet');
});

// Humano automático para simular partidas completas
function playHuman(g, rng) {
  switch (g.phase) {
    case 'betting1':
    case 'betting2':
      applyBetting(g, 0, botBetAction(evaluateHand(g.players[0].hand), legalActions(g, 0), rng));
      break;
    case 'draw':
      applyDraw(g, 0, botDiscards(g.players[0].hand));
      break;
    case 'challenge':
      submitChallenge(g, g.challenge.questions.map(q => (rng() < 0.7 ? q.correctIndex : (q.correctIndex + 1) % 3)));
      break;
    case 'handOver':
      nextHand(g);
      break;
  }
}

test('simulación: 200 partidas completas sin errores y con fichas conservadas', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    const g = createGame({ connectors, numBots: 2 + (seed % 3), rng, maxHands: 8 });
    const chips = g.players.length * START_CHIPS;
    let steps = 0;
    while (g.phase !== 'gameOver') {
      runBots(g);
      if (g.phase === 'gameOver') break;
      playHuman(g, rng);
      runBots(g);
      assert.equal(total(g), chips, `semilla ${seed}: fichas no conservadas`);
      assert.ok(g.players.every(p => p.chips >= 0), `semilla ${seed}: fichas negativas`);
      assert.ok(++steps < 2000, `semilla ${seed}: partida sin fin`);
    }
    assert.ok(g.handNumber <= 8);
    assert.equal(g.standings.length, g.players.length);
  }
});
