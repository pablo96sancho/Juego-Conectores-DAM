// IA sencilla de los bots. Sin DOM; el azar es inyectable.

// `legal`: { toCall, canCheck, canBet, maxBet } (ver legalActions en game.js)
export function botBetAction(evaluation, legal, rng = Math.random) {
  const { toCall, canCheck, canBet, maxBet } = legal;
  const check = { type: 'check' };
  const call = { type: 'call' };
  const fold = { type: 'fold' };
  const bet = amount => ({ type: 'bet', amount: Math.min(amount, maxBet) });

  if (evaluation.rank >= 3) {
    if (canBet) return bet(2);
    return canCheck ? check : call;
  }
  if (evaluation.rank >= 1) {
    if (canBet && rng() < 0.5) return bet(1);
    if (canCheck) return check;
    return toCall <= 2 || rng() < 0.6 ? call : fold;
  }
  if (canCheck) return canBet && rng() < 0.1 ? bet(1) : check;
  return toCall <= 1 && rng() < 0.5 ? call : fold;
}

// Índices de las cartas que el bot cambia (máximo 3): las que no forman grupo
export function botDiscards(hand) {
  const counts = new Map();
  for (const c of hand) {
    if (c.kind === 'conector') counts.set(c.connectorId, (counts.get(c.connectorId) ?? 0) + 1);
  }
  const keep = hand.map(c => c.kind !== 'conector' || counts.get(c.connectorId) >= 2);

  // Sin ningún grupo, conserva las 2 cartas de conector de mayor id
  if (!keep.some((k, i) => k && hand[i].kind === 'conector')) {
    hand
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.kind === 'conector')
      .sort((a, b) => b.c.connectorId - a.c.connectorId)
      .slice(0, 2)
      .forEach(({ i }) => { keep[i] = true; });
  }

  const discards = keep.map((k, i) => (k ? -1 : i)).filter(i => i >= 0);
  return discards.slice(0, 3);
}

export function botPassesChallenge(rng, probability) {
  return rng() < probability;
}
