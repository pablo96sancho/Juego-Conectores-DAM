// Ranking local en localStorage. El almacén se inyecta para poder testearlo.
const KEY = 'connector-poker-ranking';
const MAX_ENTRIES = 10;
const MAX_NAME = 20;

function isEntry(e) {
  return e && typeof e.name === 'string' && Number.isFinite(e.chips) && typeof e.date === 'string';
}

// Mejor primero: más fichas y, a igualdad, la más antigua
function sortEntries(entries) {
  return [...entries].sort((a, b) => b.chips - a.chips || a.date.localeCompare(b.date)).slice(0, MAX_ENTRIES);
}

export function loadRanking(storage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    return Array.isArray(data) ? sortEntries(data.filter(isEntry)) : [];
  } catch {
    return [];
  }
}

// Guarda una puntuación y devuelve el ranking actualizado
export function addScore(storage, { name, chips, hands }, now = new Date()) {
  const entry = {
    name: String(name ?? '').trim().slice(0, MAX_NAME) || 'Anónimo',
    chips,
    hands,
    date: now.toISOString(),
  };
  const ranking = sortEntries([...loadRanking(storage), entry]);
  try {
    storage.setItem(KEY, JSON.stringify(ranking));
  } catch {
    // Sin almacenamiento (modo privado, cuota…): el juego sigue sin ranking persistente
  }
  return ranking;
}

export function clearRanking(storage) {
  try {
    storage.removeItem(KEY);
  } catch {
    // Nada que borrar
  }
}
