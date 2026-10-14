// Arranque y conexión con la UI
import { loadConnectors, buildDeck, shuffle, deal, describeCard } from './deck.js';
import { evaluateHand } from './hands.js';
import {
  createGame, applyBetting, applyDraw, submitChallenge, nextHand, runBots,
  legalActions, MAX_DISCARD, FAIL_PENALTY,
} from './game.js';

function pintarLista(conectores) {
  const lista = document.getElementById('lista');
  for (const c of conectores) {
    const li = document.createElement('li');
    const titulo = document.createElement('h3');
    titulo.textContent = `${c.id}. ${c.nombre}`;
    const etiqueta = document.createElement('span');
    etiqueta.className = `etiqueta ${c.tipo}`;
    etiqueta.textContent = c.tipo;
    const funcion = document.createElement('p');
    funcion.textContent = `Función: ${c.funcion}`;
    const ubicacion = document.createElement('p');
    ubicacion.textContent = `Ubicación: ${c.ubicacion}`;
    li.append(titulo, etiqueta, funcion, ubicacion);
    lista.appendChild(li);
  }
}

// Modo práctica: reparte 5 cartas y muestra la mano que forman
function repartir(conectores) {
  const { hand } = deal(shuffle(buildDeck(conectores)), 5);
  const mano = evaluateHand(hand);
  const ul = document.getElementById('mano');
  ul.replaceChildren();
  for (const carta of hand) {
    const { title, text, image } = describeCard(carta, conectores);
    const li = document.createElement('li');
    li.className = carta.kind === 'conector' ? 'carta' : 'carta especial';
    const t = document.createElement('div');
    t.className = 'titulo';
    t.textContent = title;
    li.append(t);
    if (image) {
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt;
      li.append(img);
    } else {
      const p = document.createElement('div');
      p.textContent = text;
      li.append(p);
    }
    ul.appendChild(li);
  }
  const principal = conectores.find(c => c.id === mano.mainConnectorId);
  let texto = `Mano: ${mano.rankName}`;
  if (principal && mano.rank > 0) texto += ` de ${principal.nombre}`;
  if (mano.special) {
    const usado = conectores.find(c => c.id === mano.special.as.connectorId);
    texto += `. La carta especial cuenta como ${usado.nombre} (${mano.special.as.type}).`;
  }
  document.getElementById('resultado').textContent = texto;
}


// ---------- Partida ----------
const $ = id => document.getElementById(id);

// Crea un elemento: atributos 'class', 'onEvento' y normales
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

let game = null;
let conectoresJuego = [];
const seleccion = new Set();

function nuevaPartida() {
  game = createGame({ connectors: conectoresJuego });
  seleccion.clear();
  runBots(game);
  $('mesa').hidden = false;
  render(true);
}

// Ejecuta una acción del humano, deja jugar a los bots y repinta
function actuar(accion) {
  try {
    accion();
    runBots(game);
  } catch (error) {
    console.error(error);
  }
  seleccion.clear();
  render(true);
}

function crearCarta(carta, seleccionable, indice) {
  const { title, text, image } = describeCard(carta, conectoresJuego);
  const contenido = [el('div', { class: 'titulo' }, title)];
  if (image) contenido.push(el('img', { src: image.src, alt: image.alt }));
  else contenido.push(el('div', {}, text));
  const li = el('li', { class: carta.kind === 'conector' ? 'carta' : 'carta especial' });
  if (!seleccionable) {
    li.append(...contenido);
    return li;
  }
  const boton = el('button', {
    type: 'button', class: 'carta-boton', 'aria-pressed': String(seleccion.has(indice)),
    onclick: () => {
      if (seleccion.has(indice)) seleccion.delete(indice);
      else if (seleccion.size < MAX_DISCARD) seleccion.add(indice);
      render(false);
      document.querySelectorAll('#mano-juego .carta-boton')[indice].focus();
    },
  }, ...contenido);
  li.classList.toggle('seleccionada', seleccion.has(indice));
  li.append(boton);
  return li;
}

function renderJugadores(g) {
  const ul = $('jugadores');
  ul.replaceChildren();
  for (const p of g.players) {
    const estado = p.out ? 'eliminado' : p.folded ? 'retirado' : 'en mano';
    const turno = g.turn === p.id && ['betting1', 'betting2', 'draw'].includes(g.phase) && !p.folded;
    ul.append(el('li', { class: `${turno ? 'turno' : ''} ${p.out || p.folded ? 'fuera' : ''}` },
      `${p.name}: ${p.chips} fichas (${estado})${turno ? ' ← turno' : ''}`));
  }
}

function renderAcciones(g) {
  const cont = $('acciones');
  cont.replaceChildren();
  const yo = g.players[0];
  const miTurno = g.turn === 0 && !yo.folded && !yo.out;

  if ((g.phase === 'betting1' || g.phase === 'betting2') && miTurno) {
    const legal = legalActions(g, 0);
    const ronda = g.phase === 'betting1' ? 'primera' : 'segunda';
    cont.append(el('span', {}, `Ronda de apuestas (${ronda}). ${legal.toCall > 0 ? `Debes igualar ${legal.toCall}.` : 'Nadie ha apostado.'}`));
    if (legal.canCheck) cont.append(el('button', { type: 'button', onclick: () => actuar(() => applyBetting(g, 0, { type: 'check' })) }, 'Pasar'));
    else cont.append(el('button', { type: 'button', onclick: () => actuar(() => applyBetting(g, 0, { type: 'call' })) }, `Igualar (${legal.toCall})`));
    for (let a = 1; a <= legal.maxBet; a++) {
      cont.append(el('button', { type: 'button', onclick: () => actuar(() => applyBetting(g, 0, { type: 'bet', amount: a })) },
        `${legal.toCall > 0 ? 'Subir' : 'Apostar'} ${a}`));
    }
    if (!legal.canCheck) cont.append(el('button', { type: 'button', class: 'secundario', onclick: () => actuar(() => applyBetting(g, 0, { type: 'fold' })) }, 'Retirarse'));
  } else if (g.phase === 'draw' && miTurno) {
    const n = seleccion.size;
    cont.append(
      el('span', {}, `Cambio de cartas: marca hasta ${MAX_DISCARD} cartas para cambiarlas.`),
      el('button', { type: 'button', onclick: () => actuar(() => applyDraw(g, 0, [...seleccion])) },
        n > 0 ? `Cambiar ${n} carta${n > 1 ? 's' : ''}` : 'No cambiar'),
    );
  } else if (g.phase === 'handOver') {
    const ultima = g.handNumber >= g.maxHands;
    cont.append(el('button', { type: 'button', onclick: () => { nextHand(g); runBots(g); seleccion.clear(); render(true); } },
      ultima ? 'Ver resultado final' : 'Siguiente mano'));
  } else if (g.phase === 'gameOver') {
    cont.append(el('button', { type: 'button', onclick: nuevaPartida }, 'Nueva partida'));
  } else if (g.phase !== 'challenge') {
    cont.append(el('span', {}, 'Esperando a los bots…'));
  }
}

function renderReto(g, panel) {
  const form = el('form', {
    onsubmit: evento => {
      evento.preventDefault();
      const datos = new FormData(form);
      const respuestas = g.challenge.questions.map((_, i) => Number(datos.get(`q${i}`)));
      actuar(() => submitChallenge(g, respuestas));
    },
  }, el('h3', {}, 'Reto del showdown'),
  el('p', {}, `Tienes la mejor mano: justifícala. Acierta todas o perderás ${FAIL_PENALTY} fichas.`));
  g.challenge.questions.forEach((q, i) => {
    const fs = el('fieldset', {}, el('legend', {}, q.prompt));
    q.options.forEach((opcion, j) => {
      fs.append(el('label', {}, el('input', { type: 'radio', name: `q${i}`, value: j, required: true }), ` ${opcion}`));
    });
    form.append(fs);
  });
  form.append(el('button', { type: 'submit' }, 'Responder'));
  panel.append(form);
}

function renderResultado(g, panel) {
  const r = g.result;
  panel.append(el('h3', {}, 'Resultado de la mano'));
  for (const rev of g.reveal ?? []) panel.append(el('p', {}, `${rev.name}: ${rev.label}`));
  const quien = r.winners.map(id => g.players[id].name).join(' y ');
  const texto = r.carried ? `Nadie superó el reto: el bote (${g.pot}) pasa a la mano siguiente.`
    : r.byFold ? `${quien} gana ${r.amount} fichas: los demás se retiraron.`
      : `${quien} gana${r.winners.length > 1 ? 'n' : ''} ${r.amount} fichas.`;
  panel.append(el('p', {}, el('strong', {}, texto)));
  if (g.lastGrade) {
    panel.append(el('p', { class: g.lastGrade.passed ? 'acierto' : 'fallo' },
      g.lastGrade.passed ? 'Superaste el reto.' : `Fallaste el reto y pierdes ${FAIL_PENALTY} fichas.`));
    g.lastGrade.questions.forEach((q, i) => {
      if (!g.lastGrade.correct[i]) panel.append(el('p', {}, `${q.prompt} Respuesta correcta: ${q.options[q.correctIndex]}`));
    });
  }
}

function renderFinal(g, panel) {
  panel.append(el('h3', {}, 'Fin de la partida'));
  const ul = el('ol');
  for (const p of g.standings) ul.append(el('li', {}, `${p.name}: ${p.chips} fichas`));
  const primero = g.standings[0];
  panel.append(el('p', {}, el('strong', {}, primero.id === 0 ? '¡Has ganado!' : `Gana ${primero.name}.`)), ul);
}

function render(enfocar) {
  const g = game;
  $('info').textContent = `Mano ${g.handNumber} de ${g.maxHands} · Bote: ${g.pot} fichas`;
  renderJugadores(g);

  const ul = $('mano-juego');
  ul.replaceChildren();
  const elegir = g.phase === 'draw' && g.turn === 0 && !g.players[0].folded;
  g.players[0].hand.forEach((carta, i) => ul.append(crearCarta(carta, elegir, i)));

  renderAcciones(g);
  const panel = $('panel');
  panel.replaceChildren();
  if (g.phase === 'challenge') renderReto(g, panel);
  else if (g.phase === 'handOver') renderResultado(g, panel);
  else if (g.phase === 'gameOver') renderFinal(g, panel);

  const reg = $('registro');
  reg.replaceChildren(...g.log.slice(-12).map(t => el('li', {}, t)));
  reg.scrollTop = reg.scrollHeight;

  if (enfocar) {
    const primero = document.querySelector('#panel input, #acciones button');
    if (primero) primero.focus();
  }
}

try {
  const conectores = await loadConnectors();
  conectoresJuego = conectores;
  pintarLista(conectores);
  const internos = conectores.filter(c => c.tipo === 'interno').length;
  document.getElementById('estado').textContent =
    `${conectores.length} conectores cargados (${internos} internos, ${conectores.length - internos} externos).`;
  document.getElementById('repartir').addEventListener('click', () => repartir(conectores));
  $('nueva').addEventListener('click', nuevaPartida);
} catch (error) {
  document.getElementById('estado').textContent =
    'No se pudieron cargar los conectores. ¿Estás usando un servidor local?';
  console.error(error);
}
