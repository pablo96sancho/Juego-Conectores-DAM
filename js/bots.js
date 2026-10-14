// IA sencilla de los bots. Sin DOM; el azar es inyectable.

// `legal`: { toCall, canCheck, canBet, maxBet } (ver legalActions en game.js).
// `stage`: 0 antes del flop, 1 flop, 2 turn, 3 river. Antes del flop casi nadie
// tiene nada hecho, así que los bots no se retiran con facilidad.
export function botBetAction(evaluation, legal, rng = Math.random, stage = 3) {
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
  if (stage === 0) return toCall <= 2 || rng() < 0.5 ? call : fold;
  return toCall <= 1 && rng() < 0.5 ? call : fold;
}

export function botPassesChallenge(rng, probability) {
  return rng() < probability;
}
