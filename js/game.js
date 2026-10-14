// Estado de la partida (estilo Texas Hold'em): rondas, apuestas, mesa, showdown y fichas.
// Sin DOM. El jugador humano es siempre el id 0; los bots se juegan con runBots().
import { buildDeck, shuffle } from './deck.js';
import { bestHand, compareHands } from './hands.js';
import { buildChallenge, gradeChallenge } from './showdown.js';
import { botBetAction, botPassesChallenge } from './bots.js';

export const START_CHIPS = 20;
export const ANTE = 1;
export const MAX_BET = 2;
export const FAIL_PENALTY = 2;
export const HOLE_SIZE = 2;   // cartas de cada jugador
export const BOARD_SIZE = 5;  // cartas comunes de la mesa

// Rondas de apuestas y cartas de la mesa visibles en cada una
export const STAGES = ['Antes del flop', 'Flop', 'Turn', 'River'];
const VISIBLE_BY_STAGE = [0, 3, 4, 5];

const inHand = p => !p.out && !p.folded;

// Primer jugador, a partir de `start` y en círculo, que cumple `pred`
function nextWhere(g, start, pred) {
  const n = g.players.length;
  for (let i = 0; i < n; i++) {
    const p = g.players[(start + i) % n];
    if (pred(p)) return p.id;
  }
  return null;
}

function say(g, text) {
  g.log.push(text);
}

function handLabel(g, evaluation) {
  const main = g.connectors.find(c => c.id === evaluation.mainConnectorId);
  return evaluation.rank > 0 && main ? `${evaluation.rankName} de ${main.nombre}` : evaluation.rankName;
}

export function createGame({
  connectors,
  numBots = 2,
  rng = Math.random,
  botPassProb = 0.8,
  maxHands = 8,
  humanName = 'Jugador',
}) {
  const names = [humanName, ...Array.from({ length: numBots }, (_, i) => `Bot ${i + 1}`)];
  const g = {
    connectors, rng, botPassProb, maxHands,
    players: names.map((name, id) => ({
      id, name, isBot: id > 0, chips: START_CHIPS, hand: [], folded: false, out: false,
      contrib: 0, raised: false, acted: false, evaluation: null,
    })),
    deck: [], board: [], revealed: 0, stage: 0, pot: 0, handNumber: 0, firstToAct: -1,
    phase: 'betting', turn: 0, currentBet: 0,
    sd: null, challenge: null, lastGrade: null, result: null, reveal: [], standings: null, log: [],
  };
  startHand(g);
  return g;
}

export function startHand(g) {
  g.handNumber++;
  g.deck = shuffle(buildDeck(g.connectors), g.rng);
  g.result = null;
  g.reveal = [];
  g.challenge = null;
  g.lastGrade = null;
  g.sd = null;
  g.firstToAct = nextWhere(g, g.firstToAct + 1, p => !p.out);
  say(g, `— Mano ${g.handNumber} —${g.pot > 0 ? ` (el bote anterior sigue: ${g.pot})` : ''}`);
  for (const p of g.players.filter(p => !p.out)) {
    p.folded = false;
    p.evaluation = null;
    p.chips -= ANTE;
    g.pot += ANTE;
    p.hand = g.deck.splice(0, HOLE_SIZE);
  }
  g.board = g.deck.splice(0, BOARD_SIZE);
  g.revealed = 0;
  g.stage = 0;
  g.phase = 'betting';
  startBettingRound(g);
}

function startBettingRound(g) {
  for (const p of g.players.filter(inHand)) {
    p.contrib = 0;
    p.raised = false;
    p.acted = false;
  }
  g.currentBet = 0;
  g.turn = nextWhere(g, g.firstToAct, inHand);
}

// Qué puede hacer un jugador ahora. `maxBet` evita que otro no pueda igualar.
export function legalActions(g, pid) {
  const p = g.players[pid];
  const toCall = g.currentBet - p.contrib;
  let maxBet = Math.min(MAX_BET, p.chips - toCall);
  for (const q of g.players.filter(inHand)) {
    if (q !== p) maxBet = Math.min(maxBet, q.chips + q.contrib - g.currentBet);
  }
  const canBet = !p.raised && maxBet >= 1;
  return { toCall, canCheck: toCall === 0, canBet, maxBet: canBet ? maxBet : 0 };
}

function pay(g, p, amount) {
  p.chips -= amount;
  p.contrib += amount;
  g.pot += amount;
}

export function applyBetting(g, pid, action) {
  if (g.phase !== 'betting') throw new Error('No es una ronda de apuestas');
  if (g.turn !== pid) throw new Error('No es su turno');
  const p = g.players[pid];
  const legal = legalActions(g, pid);

  switch (action.type) {
    case 'fold':
      p.folded = true;
      say(g, `${p.name} se retira.`);
      break;
    case 'check':
      if (!legal.canCheck) throw new Error('No puede pasar: hay una apuesta que igualar');
      say(g, `${p.name} pasa.`);
      break;
    case 'call':
      if (legal.canCheck) throw new Error('No hay nada que igualar');
      pay(g, p, legal.toCall);
      say(g, `${p.name} iguala (${legal.toCall}).`);
      break;
    case 'bet': {
      const a = action.amount;
      if (!legal.canBet || !Number.isInteger(a) || a < 1 || a > legal.maxBet) {
        throw new Error('Apuesta no permitida');
      }
      pay(g, p, legal.toCall + a);
      g.currentBet += a;
      p.raised = true;
      for (const q of g.players.filter(inHand)) if (q !== p) q.acted = false;
      say(g, `${p.name} ${legal.toCall > 0 ? 'sube' : 'apuesta'} ${a}.`);
      break;
    }
    default:
      throw new Error(`Acción desconocida: ${action.type}`);
  }
  p.acted = true;

  const left = g.players.filter(inHand);
  if (left.length === 1) return winByFold(g, left[0]);
  advance(g, pid);
}

// Pasa el turno al siguiente que debe actuar o cierra la ronda
function advance(g, pid) {
  const next = nextWhere(g, pid + 1, p => inHand(p) && !p.acted);
  if (next !== null) {
    g.turn = next;
    return;
  }
  if (g.stage < STAGES.length - 1) {
    g.stage++;
    g.revealed = VISIBLE_BY_STAGE[g.stage];
    say(g, `${STAGES[g.stage]}: se ${g.revealed === 3 ? 'descubren 3 cartas' : 'descubre 1 carta'} de la mesa.`);
    startBettingRound(g);
  } else {
    beginShowdown(g);
  }
}

// Cartas de la mesa que ya se ven
export function visibleBoard(g) {
  return g.board.slice(0, g.revealed);
}

function winByFold(g, winner) {
  winner.chips += g.pot;
  const amount = g.pot;
  g.pot = 0;
  say(g, `${winner.name} gana ${amount} fichas: todos los demás se retiraron.`);
  finishHand(g, { winners: [winner.id], amount, byFold: true, carried: false, reveal: [] });
}

export function beginShowdown(g) {
  g.phase = 'showdown';
  g.revealed = BOARD_SIZE;
  const contenders = g.players.filter(inHand);
  for (const p of contenders) p.evaluation = bestHand([...p.hand, ...g.board]);
  contenders.sort((a, b) => compareHands(b.evaluation, a.evaluation));

  // Grupos de empatados, de mejor a peor
  const groups = [];
  for (const p of contenders) {
    const last = groups[groups.length - 1];
    if (last && compareHands(p.evaluation, g.players[last[0]].evaluation) === 0) last.push(p.id);
    else groups.push([p.id]);
  }
  g.sd = { groups, gi: 0, mi: 0, passers: [] };
  const reveal = contenders.map(p => ({ id: p.id, name: p.name, label: handLabel(g, p.evaluation), hand: p.hand }));
  g.reveal = reveal;
  for (const r of reveal) say(g, `${r.name} enseña: ${r.label}.`);
  advanceShowdown(g);
}

// Recorre los retos en orden. Se detiene si le toca al humano (phase 'challenge').
function advanceShowdown(g) {
  const sd = g.sd;
  while (sd.gi < sd.groups.length) {
    const group = sd.groups[sd.gi];
    while (sd.mi < group.length) {
      const p = g.players[group[sd.mi]];
      if (!p.isBot) {
        g.challenge = { playerId: p.id, questions: buildChallenge(p.evaluation, g.connectors, g.rng) };
        g.phase = 'challenge';
        return;
      }
      resolveChallenge(g, p, botPassesChallenge(g.rng, g.botPassProb));
      sd.mi++;
    }
    if (sd.passers.length > 0) return payout(g);
    sd.gi++;
    sd.mi = 0;
  }
  say(g, `Nadie supera el reto: el bote (${g.pot}) pasa a la mano siguiente.`);
  finishHand(g, { winners: [], amount: 0, byFold: false, carried: true, reveal: g.reveal });
}

function resolveChallenge(g, p, passed) {
  if (passed) {
    g.sd.passers.push(p.id);
    say(g, `${p.name} supera el reto.`);
    return;
  }
  const penalty = Math.min(FAIL_PENALTY, p.chips);
  p.chips -= penalty;
  g.pot += penalty;
  say(g, `${p.name} falla el reto y pierde ${penalty} fichas (van al bote).`);
}

function payout(g) {
  const winners = g.sd.passers;
  const share = Math.floor(g.pot / winners.length);
  const extra = g.pot - share * winners.length;
  winners.forEach((id, i) => { g.players[id].chips += share + (i === 0 ? extra : 0); });
  const amount = g.pot;
  g.pot = 0;
  say(g, `${winners.map(id => g.players[id].name).join(' y ')} se lleva${winners.length > 1 ? 'n' : ''} ${amount} fichas.`);
  finishHand(g, { winners, amount, byFold: false, carried: false, reveal: g.reveal });
}

// Respuestas del humano al reto (índices de opción, uno por pregunta)
export function submitChallenge(g, answers) {
  if (g.phase !== 'challenge') throw new Error('No hay ningún reto pendiente');
  const grade = gradeChallenge(g.challenge.questions, answers);
  g.lastGrade = { ...grade, questions: g.challenge.questions, answers };
  resolveChallenge(g, g.players[g.challenge.playerId], grade.passed);
  g.challenge = null;
  g.phase = 'showdown';
  g.sd.mi++;
  advanceShowdown(g);
  return g.lastGrade;
}

function finishHand(g, result) {
  g.result = result;
  g.phase = 'handOver';
}

// Pasa a la mano siguiente o termina la partida
export function nextHand(g) {
  if (g.phase !== 'handOver') throw new Error('La mano no ha terminado');
  for (const p of g.players) if (p.chips < ANTE) p.out = true;
  const alive = g.players.filter(p => !p.out);
  if (g.players[0].out || alive.length < 2 || g.handNumber >= g.maxHands) {
    g.phase = 'gameOver';
    g.standings = [...g.players].sort((a, b) => b.chips - a.chips);
    return;
  }
  startHand(g);
}

// Juega los turnos de los bots hasta que le toque al humano o cambie la fase
export function runBots(g) {
  while (g.phase === 'betting' && g.players[g.turn].isBot) {
    const p = g.players[g.turn];
    const evaluation = bestHand([...p.hand, ...visibleBoard(g)]);
    applyBetting(g, p.id, botBetAction(evaluation, legalActions(g, p.id), g.rng, g.stage));
  }
}
