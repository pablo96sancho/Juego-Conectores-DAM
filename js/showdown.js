// Retos de justificación del showdown: genera preguntas tipo test y las corrige.
// Funciones puras (el azar es inyectable), sin DOM.
import { shuffle } from './deck.js';

// Velocidades de las versiones de USB (comodín USB)
export const USB_SPEEDS = [
  { version: 'USB 2.0', speed: '480 Mbps' },
  { version: 'USB 3.2 Gen 1 (antes 3.0)', speed: '5 Gbps' },
  { version: 'USB 3.2 Gen 2 (antes 3.1)', speed: '10 Gbps' },
  { version: 'USB 3.2 Gen 2x2', speed: '20 Gbps' },
  { version: 'USB4', speed: '40 Gbps' },
  { version: 'USB4 versión 2.0', speed: '80 Gbps' },
];

const OPTIONS = 3;

function unique(values) {
  return [...new Set(values)];
}

// Pregunta de 3 opciones: la correcta y 2 incorrectas. Las de `preferred` van primero.
function buildQuestion(prompt, correct, preferred, others, rng) {
  const wrong = unique([...preferred, ...shuffle(others, rng)]).filter(v => v !== correct);
  if (wrong.length < OPTIONS - 1) throw new Error('No hay suficientes opciones incorrectas');
  const options = shuffle([correct, ...wrong.slice(0, OPTIONS - 1)], rng);
  return { prompt, options, correctIndex: options.indexOf(correct) };
}

// Conectores parecidos al objetivo (mismo tipo o misma ubicación) primero
function similarFirst(target, connectors) {
  const others = connectors.filter(c => c.id !== target.id);
  const similar = others.filter(c => c.tipo === target.tipo || c.ubicacion === target.ubicacion);
  return { similar, rest: others.filter(c => !similar.includes(c)) };
}

function fieldQuestion(target, field, connectors, rng) {
  const { similar, rest } = similarFirst(target, connectors);
  const prompt = field === 'funcion'
    ? `¿Cuál es la función de ${target.nombre}?`
    : `¿Dónde va ${target.nombre}?`;
  const preferred = shuffle(similar, rng).map(c => c[field]);
  return buildQuestion(prompt, target[field], preferred, rest.map(c => c[field]), rng);
}

function specialQuestion(special, connectors, rng) {
  const byId = new Map(connectors.map(c => [c.id, c]));
  const as = byId.get(special.as.connectorId);
  const kind = special.card.kind;

  if (kind === 'trampa') {
    const otherId = special.card.pair.find(id => id !== as.id);
    const other = byId.get(otherId);
    const prompt = `La Trampa encaja con ${as.nombre} y con ${other.nombre}. ¿Cuál es la función de ${as.nombre}?`;
    return buildQuestion(prompt, as.funcion, [other.funcion],
      connectors.filter(c => c.id !== as.id).map(c => c.funcion), rng);
  }
  if (kind === 'comodinUsb') {
    const usb = USB_SPEEDS[Math.floor(rng() * USB_SPEEDS.length)];
    return buildQuestion(`¿Qué velocidad tiene ${usb.version}?`, usb.speed, [],
      USB_SPEEDS.map(u => u.speed), rng);
  }
  // Comodín Anti-error: solo sustituye a conectores internos
  const internal = connectors.filter(c => c.tipo === 'interno' && c.id !== as.id);
  return buildQuestion(`¿Qué característica anti-error tiene ${as.nombre}?`, as.antiError, [],
    internal.map(c => c.antiError), rng);
}

// Reto para una mano evaluada (resultado de evaluateHand): 2 preguntas sobre su
// combinación, más una sobre la carta especial si cuenta alguna.
export function buildChallenge(evaluation, connectors, rng = Math.random) {
  const byId = new Map(connectors.map(c => [c.id, c]));
  const [main, second] = evaluation.groups;
  const twoGroups = evaluation.rank === 2 || evaluation.rank === 4;
  const target1 = byId.get(main.connectorId);
  const target2 = twoGroups ? byId.get(second.connectorId) : target1;

  const questions = [
    fieldQuestion(target1, 'funcion', connectors, rng),
    fieldQuestion(target2, 'ubicacion', connectors, rng),
  ];
  if (evaluation.special) questions.push(specialQuestion(evaluation.special, connectors, rng));
  return questions;
}

// Corrige las respuestas (índices de opción). Se supera si todas son correctas.
export function gradeChallenge(questions, answers) {
  const correct = questions.map((q, i) => answers[i] === q.correctIndex);
  return { passed: correct.every(Boolean), correct };
}
