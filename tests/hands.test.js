import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHand, compareHands, bestHand } from '../js/hands.js';

const c = (connectorId, type) => ({ kind: 'conector', connectorId, type });
const trampa = (a, b) => ({ kind: 'trampa', pair: [a, b] });
const usb = { kind: 'comodinUsb' };
const anti = { kind: 'comodinAntiError' };

// Manos base sin especiales
const highCard = [c(1, 'foto'), c(3, 'nombre'), c(5, 'funcion'), c(8, 'ubicacion'), c(12, 'foto')];

test('carta alta', () => {
  const h = evaluateHand(highCard);
  assert.equal(h.rank, 0);
  assert.equal(h.mainConnectorId, 12);
  assert.equal(h.special, null);
});

test('pareja', () => {
  const h = evaluateHand([c(4, 'foto'), c(4, 'nombre'), c(1, 'foto'), c(9, 'foto'), c(15, 'foto')]);
  assert.equal(h.rank, 1);
  assert.equal(h.mainConnectorId, 4);
});

test('doble pareja', () => {
  const h = evaluateHand([c(4, 'foto'), c(4, 'nombre'), c(9, 'foto'), c(9, 'nombre'), c(15, 'foto')]);
  assert.equal(h.rank, 2);
  assert.deepEqual(h.tiebreak, [9, 4, 15]);
});

test('trío', () => {
  const h = evaluateHand([c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(1, 'foto'), c(2, 'foto')]);
  assert.equal(h.rank, 3);
  assert.equal(h.mainConnectorId, 7);
});

test('full', () => {
  const h = evaluateHand([c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(2, 'foto'), c(2, 'nombre')]);
  assert.equal(h.rank, 4);
  assert.equal(h.rankName, 'Full');
});

test('póker', () => {
  const h = evaluateHand([c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(7, 'ubicacion'), c(2, 'foto')]);
  assert.equal(h.rank, 5);
  assert.equal(h.mainConnectorId, 7);
});

test('escalera de energía con cartas Nombre', () => {
  const h = evaluateHand([20, 1, 2, 3, 5].map(id => c(id, 'nombre')));
  assert.equal(h.rank, 6);
});

test('los mismos conectores con otros tipos de carta no son escalera', () => {
  const h = evaluateHand([c(20, 'nombre'), c(1, 'nombre'), c(2, 'nombre'), c(3, 'nombre'), c(5, 'foto')]);
  assert.equal(h.rank, 0);
});

test('el orden de los rangos es estricto', () => {
  const hands = [
    highCard,
    [c(4, 'foto'), c(4, 'nombre'), c(1, 'foto'), c(9, 'foto'), c(15, 'foto')],
    [c(4, 'foto'), c(4, 'nombre'), c(9, 'foto'), c(9, 'nombre'), c(15, 'foto')],
    [c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(1, 'foto'), c(2, 'foto')],
    [c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(2, 'foto'), c(2, 'nombre')],
    [c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(7, 'ubicacion'), c(2, 'foto')],
    [20, 1, 2, 3, 5].map(id => c(id, 'nombre')),
  ].map(evaluateHand);
  hands.forEach((h, i) => assert.equal(h.rank, i));
  for (let i = 1; i < hands.length; i++) assert.ok(compareHands(hands[i], hands[i - 1]) > 0);
});

// Desempates
test('desempate de pareja: gana el id mayor', () => {
  const a = evaluateHand([c(10, 'foto'), c(10, 'nombre'), c(1, 'foto'), c(2, 'foto'), c(3, 'foto')]);
  const b = evaluateHand([c(9, 'foto'), c(9, 'nombre'), c(1, 'foto'), c(2, 'foto'), c(3, 'foto')]);
  assert.ok(compareHands(a, b) > 0);
});

test('doble pareja: primero la pareja mayor y luego la menor', () => {
  const a = evaluateHand([c(9, 'foto'), c(9, 'nombre'), c(2, 'foto'), c(2, 'nombre'), c(1, 'foto')]);
  const b = evaluateHand([c(8, 'foto'), c(8, 'nombre'), c(7, 'foto'), c(7, 'nombre'), c(1, 'foto')]);
  assert.ok(compareHands(a, b) > 0);
  const d = evaluateHand([c(9, 'foto'), c(9, 'nombre'), c(3, 'foto'), c(3, 'nombre'), c(1, 'foto')]);
  assert.ok(compareHands(d, a) > 0);
});

test('mismas parejas: decide la carta suelta de mayor id', () => {
  const a = evaluateHand([c(9, 'foto'), c(9, 'nombre'), c(2, 'foto'), c(2, 'nombre'), c(15, 'foto')]);
  const b = evaluateHand([c(9, 'funcion'), c(9, 'ubicacion'), c(2, 'funcion'), c(2, 'ubicacion'), c(14, 'foto')]);
  assert.ok(compareHands(a, b) > 0);
});

test('empate total: compareHands devuelve 0', () => {
  const a = evaluateHand([c(4, 'foto'), c(4, 'nombre'), c(1, 'foto'), c(9, 'foto'), c(15, 'foto')]);
  const b = evaluateHand([c(4, 'funcion'), c(4, 'ubicacion'), c(1, 'nombre'), c(9, 'nombre'), c(15, 'nombre')]);
  assert.equal(compareHands(a, b), 0);
});

test('full: decide el trío antes que la pareja', () => {
  const a = evaluateHand([c(7, 'foto'), c(7, 'nombre'), c(7, 'funcion'), c(1, 'foto'), c(1, 'nombre')]);
  const b = evaluateHand([c(6, 'foto'), c(6, 'nombre'), c(6, 'funcion'), c(20, 'foto'), c(20, 'nombre')]);
  assert.ok(compareHands(a, b) > 0);
});

// Trampa
test('Trampa completa una pareja como Función de uno de su par', () => {
  const h = evaluateHand([c(13, 'foto'), c(13, 'nombre'), trampa(13, 14), c(1, 'foto'), c(2, 'foto')]);
  assert.equal(h.rank, 3);
  assert.equal(h.mainConnectorId, 13);
  assert.deepEqual(h.special.as, { connectorId: 13, type: 'funcion' });
});

test('Trampa no se usa si el grupo ya tiene la carta Función', () => {
  const h = evaluateHand([c(13, 'foto'), c(13, 'funcion'), trampa(13, 14), c(1, 'foto'), c(2, 'foto')]);
  assert.equal(h.rank, 1);
  assert.equal(h.special, null);
});

test('Trampa no sirve para conectores fuera de su par', () => {
  const h = evaluateHand([c(9, 'foto'), c(9, 'nombre'), trampa(13, 14), c(1, 'foto'), c(2, 'foto')]);
  assert.equal(h.rank, 1);
  assert.equal(h.special, null);
});

// Comodines
test('comodín USB sustituye a USB-A o USB-C', () => {
  const h = evaluateHand([c(12, 'foto'), c(12, 'nombre'), c(12, 'funcion'), usb, c(1, 'foto')]);
  assert.equal(h.rank, 5);
  assert.equal(h.mainConnectorId, 12);
});

test('comodín USB no sirve para otros conectores', () => {
  const h = evaluateHand([c(13, 'foto'), c(13, 'nombre'), usb, c(1, 'foto'), c(2, 'foto')]);
  assert.equal(h.rank, 1);
  assert.equal(h.special, null);
});

test('comodín Anti-error sustituye a un conector interno', () => {
  const h = evaluateHand([c(8, 'foto'), c(8, 'nombre'), c(8, 'funcion'), anti, c(15, 'foto')]);
  assert.equal(h.rank, 5);
  assert.equal(h.special.as.connectorId, 8);
});

test('comodín Anti-error no sirve para conectores externos', () => {
  const h = evaluateHand([c(15, 'foto'), c(15, 'nombre'), anti, c(13, 'foto'), c(14, 'foto')]);
  assert.equal(h.rank, 1);
  assert.equal(h.special, null);
});

test('Anti-error completa la escalera de energía con un Nombre interno', () => {
  const h = evaluateHand([c(20, 'nombre'), c(1, 'nombre'), c(2, 'nombre'), c(3, 'nombre'), anti]);
  assert.equal(h.rank, 6);
  assert.deepEqual(h.special.as, { connectorId: 5, type: 'nombre' });
});

test('el comodín USB no completa la escalera de energía', () => {
  const h = evaluateHand([c(20, 'nombre'), c(1, 'nombre'), c(2, 'nombre'), c(3, 'nombre'), usb]);
  assert.ok(h.rank < 6);
});

test('un grupo nunca pasa de 4 cartas', () => {
  const h = evaluateHand([c(8, 'foto'), c(8, 'nombre'), c(8, 'funcion'), c(8, 'ubicacion'), anti]);
  assert.equal(h.rank, 5);
  assert.equal(h.groups[0].count, 4);
  assert.equal(h.special, null);
});

test('solo cuenta una carta especial por mano', () => {
  // Dos Anti-error con un trío posible: solo uno puede sumar
  const h = evaluateHand([c(8, 'foto'), c(8, 'nombre'), anti, anti, c(15, 'foto')]);
  assert.equal(h.rank, 3);
  assert.equal(h.groups[0].count, 3);
});

test('las cartas especiales sobrantes no forman grupo', () => {
  const h = evaluateHand([usb, usb, anti, anti, trampa(13, 14)]);
  assert.equal(h.rank, 0);
  assert.equal(h.mainConnectorId, null);
});

test('el especial no se usa solo para ganar un desempate', () => {
  const h = evaluateHand([c(15, 'foto'), c(15, 'nombre'), c(13, 'foto'), c(17, 'foto'), anti]);
  assert.equal(h.rank, 1); // sigue siendo pareja
  assert.equal(h.special, null);
});

// Mejor mano con 7 cartas (2 de la mano + 5 de la mesa)
test('bestHand con 5 cartas o menos equivale a evaluateHand', () => {
  assert.equal(bestHand(highCard).rank, 0);
  assert.equal(bestHand([c(4, 'foto'), c(4, 'nombre')]).rank, 1);
  assert.equal(bestHand([]).rank, 0);
});

test('bestHand encuentra un póker escondido entre 7 cartas', () => {
  const h = bestHand([c(1, 'foto'), c(7, 'foto'), c(3, 'nombre'), c(7, 'nombre'), c(7, 'funcion'), c(9, 'foto'), c(7, 'ubicacion')]);
  assert.equal(h.rank, 5);
  assert.equal(h.mainConnectorId, 7);
  assert.equal(h.used.length, 5);
});

test('bestHand elige el mejor kicker entre 7 cartas', () => {
  const h = bestHand([c(4, 'foto'), c(4, 'nombre'), c(1, 'foto'), c(2, 'foto'), c(3, 'foto'), c(19, 'foto'), c(18, 'foto')]);
  assert.equal(h.rank, 1);
  assert.deepEqual(h.tiebreak, [4, 19, 18, 3]);
});

test('bestHand encuentra la escalera de energía entre 7 cartas', () => {
  const h = bestHand([...[20, 1, 2, 3, 5].map(id => c(id, 'nombre')), c(8, 'foto'), c(12, 'foto')]);
  assert.equal(h.rank, 6);
});

test('bestHand usa una carta especial solo si hace falta', () => {
  // Póker de 8 sin especial: no debe elegir la combinación con el comodín
  const sinEspecial = bestHand([c(8, 'foto'), c(8, 'nombre'), c(8, 'funcion'), c(8, 'ubicacion'), anti, c(15, 'foto'), c(2, 'foto')]);
  assert.equal(sinEspecial.rank, 5);
  assert.equal(sinEspecial.special, null);
  // Con el comodín se completa un póker que sin él sería trío
  const conEspecial = bestHand([c(8, 'foto'), c(8, 'nombre'), c(8, 'funcion'), anti, c(15, 'foto'), c(17, 'foto'), c(13, 'foto')]);
  assert.equal(conEspecial.rank, 5);
  assert.ok(conEspecial.special);
});

test('bestHand: solo cuenta una carta especial aunque haya varias entre las 7', () => {
  const h = bestHand([c(8, 'foto'), anti, anti, usb, c(15, 'foto'), c(17, 'foto'), c(13, 'foto')]);
  assert.equal(h.rank, 1); // pareja de 8 con un solo comodín
});
