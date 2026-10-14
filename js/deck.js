// Baraja de 90 cartas. Funciones puras salvo loadConnectors (fetch). Sin DOM.

export const CARD_TYPES = ['foto', 'nombre', 'funcion', 'ubicacion'];

// Pares de conectores parecidos para las cartas Trampa
export const TRAP_PAIRS = [
  [13, 14], // HDMI / DisplayPort
  [15, 16], // VGA / DVI
  [11, 12], // USB-A / USB-C
  [4, 6],   // SATA datos / M.2
  [1, 2],   // ATX 24 / EPS 4+4
  [3, 2],   // PCIe 6+2 / EPS 4+4
];

export async function loadConnectors(url = 'data/conectores.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Construye las 90 cartas: 80 de conector, 6 Trampa, 2 comodines USB y 2 Anti-error
export function buildDeck(connectors) {
  const cards = [];
  for (const c of connectors) {
    for (const type of CARD_TYPES) {
      cards.push({ uid: `c${c.id}-${type}`, kind: 'conector', connectorId: c.id, type });
    }
  }
  for (const pair of TRAP_PAIRS) {
    cards.push({ uid: `trampa-${pair.join('-')}`, kind: 'trampa', pair });
  }
  for (let i = 1; i <= 2; i++) {
    cards.push({ uid: `usb-${i}`, kind: 'comodinUsb' });
    cards.push({ uid: `antierror-${i}`, kind: 'comodinAntiError' });
  }
  return cards;
}

// Fisher-Yates; devuelve una copia. `random` es inyectable para los tests
export function shuffle(cards, random = Math.random) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Reparte n cartas de la parte superior del mazo
export function deal(deck, n) {
  if (n > deck.length) throw new Error('No quedan cartas suficientes');
  return { hand: deck.slice(0, n), rest: deck.slice(n) };
}

const TYPE_LABELS = { foto: 'Foto', nombre: 'Nombre', funcion: 'Función', ubicacion: 'Ubicación' };

// Texto de una carta para mostrarla en la interfaz
export function describeCard(card, connectors) {
  const byId = new Map(connectors.map(c => [c.id, c]));
  switch (card.kind) {
    case 'conector': {
      const c = byId.get(card.connectorId);
      const content = { foto: '', nombre: c.nombre, funcion: c.funcion, ubicacion: c.ubicacion };
      const described = { title: TYPE_LABELS[card.type], text: content[card.type] };
      // La carta Foto no puede llevar texto: el nombre iría en el alt, que se oculta a la vista
      if (card.type === 'foto') described.image = { src: c.imagen, alt: `Foto de un conector (${c.nombre})` };
      return described;
    }
    case 'trampa':
      return { title: 'Trampa', text: `Función ambigua: ${card.pair.map(id => byId.get(id).nombre).join(' o ')}` };
    case 'comodinUsb':
      return { title: 'Comodín USB', text: 'Sustituye a una carta de USB-A o USB-C' };
    default:
      return { title: 'Comodín Anti‑error', text: 'Sustituye a una carta de un conector interno' };
  }
}
