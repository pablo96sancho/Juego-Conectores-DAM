import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDeck, shuffle, deal, describeCard } from '../js/deck.js';

const connectors = JSON.parse(readFileSync(new URL('../data/conectores.json', import.meta.url)));

test('el JSON tiene 10 internos y 10 externos', () => {
  assert.equal(connectors.length, 20);
  assert.equal(connectors.filter(c => c.tipo === 'interno').length, 10);
  assert.equal(connectors.filter(c => c.tipo === 'externo').length, 10);
});

test('cada conector tiene una función y una ubicación distintas de las de los demás', () => {
  for (const campo of ['nombre', 'funcion', 'ubicacion']) {
    assert.equal(new Set(connectors.map(c => c[campo])).size, 20, `${campo} repetido`);
  }
});

test('la baraja tiene 90 cartas con uid único', () => {
  const deck = buildDeck(connectors);
  assert.equal(deck.length, 90);
  assert.equal(new Set(deck.map(c => c.uid)).size, 90);
});

test('composición: 80 conector, 6 trampa, 2 USB, 2 anti-error', () => {
  const deck = buildDeck(connectors);
  const count = kind => deck.filter(c => c.kind === kind).length;
  assert.equal(count('conector'), 80);
  assert.equal(count('trampa'), 6);
  assert.equal(count('comodinUsb'), 2);
  assert.equal(count('comodinAntiError'), 2);
});

test('cada conector tiene 4 cartas, una de cada tipo', () => {
  const deck = buildDeck(connectors);
  for (const c of connectors) {
    const types = deck.filter(x => x.connectorId === c.id).map(x => x.type).sort();
    assert.deepEqual(types, ['foto', 'funcion', 'nombre', 'ubicacion']);
  }
});

test('shuffle conserva las cartas y no modifica el original', () => {
  const deck = buildDeck(connectors);
  const copy = [...deck];
  const shuffled = shuffle(deck);
  assert.deepEqual(deck, copy);
  assert.deepEqual(shuffled.map(c => c.uid).sort(), deck.map(c => c.uid).sort());
});

test('shuffle es determinista con un random inyectado', () => {
  const deck = buildDeck(connectors);
  const fixed = () => 0.5;
  assert.deepEqual(shuffle(deck, fixed), shuffle(deck, fixed));
});

test('deal reparte n cartas y falla si no hay suficientes', () => {
  const deck = buildDeck(connectors);
  const { hand, rest } = deal(deck, 5);
  assert.equal(hand.length, 5);
  assert.equal(rest.length, 85);
  assert.throws(() => deal(deck, 91));
});

test('describeCard devuelve texto para todos los tipos de carta', () => {
  for (const card of buildDeck(connectors)) {
    const d = describeCard(card, connectors);
    assert.ok(d.title && (d.text || d.image));
  }
});
