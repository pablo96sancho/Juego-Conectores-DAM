// Evaluación de manos de 5 cartas. Funciones puras, sin DOM.
import { CARD_TYPES } from './deck.js';

export const RANK_NAMES = [
  'Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Full', 'Póker', 'Escalera de energía',
];

// Cartas Nombre de: IEC C13/C14, ATX 24, EPS 4+4, PCIe 6+2 y SATA alimentación
export const ENERGY_IDS = [20, 1, 2, 3, 5];

const USB_IDS = [11, 12];
const INTERNAL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function isEnergyStairs(cards) {
  const names = new Set(cards.filter(c => c.type === 'nombre').map(c => c.connectorId));
  return cards.length === 5 && ENERGY_IDS.every(id => names.has(id));
}

// Agrupa por conector y calcula rango y desempate. `cards`: { connectorId, type }
function scoreCards(cards) {
  const counts = new Map();
  for (const c of cards) counts.set(c.connectorId, (counts.get(c.connectorId) ?? 0) + 1);
  const groups = [...counts]
    .map(([connectorId, count]) => ({ connectorId, count }))
    .sort((a, b) => b.count - a.count || b.connectorId - a.connectorId);
  const pattern = groups.map(g => g.count);

  let rank = 0;
  if (isEnergyStairs(cards)) rank = 6;
  else if (pattern[0] === 4) rank = 5;
  else if (pattern[0] === 3 && pattern[1] === 2) rank = 4;
  else if (pattern[0] === 3) rank = 3;
  else if (pattern[0] === 2 && pattern[1] === 2) rank = 2;
  else if (pattern[0] === 2) rank = 1;

  // Desempate: ids de los grupos de mayor a menor tamaño y, a igualdad, mayor id
  return { rank, groups, tiebreak: groups.map(g => g.connectorId) };
}

// Positivo si `a` gana, negativo si gana `b`, 0 si empatan
export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Cartas de conector en las que se puede convertir una carta especial.
// Solo se admiten tipos que al conector aún le faltan: un grupo nunca pasa de 4.
function substitutions(special, normals) {
  let ids;
  let types = CARD_TYPES;
  if (special.kind === 'trampa') {
    ids = special.pair;
    types = ['funcion'];
  } else if (special.kind === 'comodinUsb') {
    ids = USB_IDS;
  } else {
    ids = INTERNAL_IDS;
  }
  return ids
    .flatMap(connectorId => types.map(type => ({ connectorId, type })))
    .filter(s => !normals.some(n => n.connectorId === s.connectorId && n.type === s.type));
}

// Evalúa una mano. Solo cuenta una carta especial (la que dé la mejor mano);
// las demás no valen nada. El especial solo se usa si sube el rango de la mano:
// no compensa justificarlo para ganar un simple desempate.
export function evaluateHand(cards) {
  const normals = cards
    .filter(c => c.kind === 'conector')
    .map(({ connectorId, type }) => ({ connectorId, type }));
  const specials = cards.filter(c => c.kind !== 'conector');

  const base = scoreCards(normals);
  let best = { ...base, special: null };
  for (const special of specials) {
    for (const as of substitutions(special, normals)) {
      const result = { ...scoreCards([...normals, as]), special: { card: special, as } };
      if (result.rank > base.rank && compareHands(result, best) > 0) best = result;
    }
  }

  return {
    rank: best.rank,
    rankName: RANK_NAMES[best.rank],
    mainConnectorId: best.groups[0]?.connectorId ?? null,
    groups: best.groups,
    tiebreak: best.tiebreak,
    special: best.special, // { card, as } si hay que justificar una carta especial
  };
}

// Todas las combinaciones de k elementos de una lista
function combinations(items, k) {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ];
}

// Mejor mano posible con las cartas disponibles (hasta 7: 2 de la mano + 5 de la mesa).
// Con 5 cartas o menos equivale a evaluateHand. A igualdad se prefiere la que no usa
// carta especial, para no obligar a justificarla sin necesidad.
export function bestHand(cards) {
  if (cards.length <= 5) return { ...evaluateHand(cards), used: cards };
  let best = null;
  for (const subset of combinations(cards, 5)) {
    const result = { ...evaluateHand(subset), used: subset };
    const diff = best ? compareHands(result, best) : 1;
    if (diff > 0 || (diff === 0 && result.special === null && best.special !== null)) best = result;
  }
  return best;
}
