import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRanking, addScore, clearRanking } from '../js/ranking.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: k => { delete data[k]; },
  };
}

const broken = {
  getItem() { throw new Error('bloqueado'); },
  setItem() { throw new Error('bloqueado'); },
  removeItem() { throw new Error('bloqueado'); },
};

test('ranking vacío al principio', () => {
  assert.deepEqual(loadRanking(fakeStorage()), []);
});

test('se ordena por fichas, de mayor a menor', () => {
  const s = fakeStorage();
  addScore(s, { name: 'Ana', chips: 12, hands: 8 });
  addScore(s, { name: 'Luis', chips: 30, hands: 5 });
  addScore(s, { name: 'Eva', chips: 20, hands: 8 });
  assert.deepEqual(loadRanking(s).map(e => e.name), ['Luis', 'Eva', 'Ana']);
});

test('a igualdad de fichas, gana la puntuación más antigua', () => {
  const s = fakeStorage();
  addScore(s, { name: 'Nueva', chips: 10, hands: 8 }, new Date('2026-02-01'));
  addScore(s, { name: 'Vieja', chips: 10, hands: 8 }, new Date('2026-01-01'));
  assert.equal(loadRanking(s)[0].name, 'Vieja');
});

test('solo guarda las 10 mejores', () => {
  const s = fakeStorage();
  for (let i = 1; i <= 15; i++) addScore(s, { name: `J${i}`, chips: i, hands: 8 });
  const r = loadRanking(s);
  assert.equal(r.length, 10);
  assert.equal(r[0].chips, 15);
  assert.equal(r[9].chips, 6);
});

test('limpia el nombre: recorta, limita a 20 caracteres y pone Anónimo si está vacío', () => {
  const s = fakeStorage();
  addScore(s, { name: '  ' + 'x'.repeat(40), chips: 5, hands: 8 });
  addScore(s, { name: '   ', chips: 4, hands: 8 });
  const r = loadRanking(s);
  assert.equal(r[0].name.length, 20);
  assert.equal(r[1].name, 'Anónimo');
});

test('ignora datos corruptos en el almacén', () => {
  assert.deepEqual(loadRanking(fakeStorage({ 'connector-poker-ranking': 'esto no es json' })), []);
  assert.deepEqual(loadRanking(fakeStorage({ 'connector-poker-ranking': '{"a":1}' })), []);
  const s = fakeStorage({ 'connector-poker-ranking': JSON.stringify([{ name: 'ok', chips: 3, date: 'd' }, { basura: true }]) });
  assert.equal(loadRanking(s).length, 1);
});

test('clearRanking borra todo', () => {
  const s = fakeStorage();
  addScore(s, { name: 'Ana', chips: 12, hands: 8 });
  clearRanking(s);
  assert.deepEqual(loadRanking(s), []);
});

test('si localStorage falla no lanza errores', () => {
  assert.deepEqual(loadRanking(broken), []);
  assert.doesNotThrow(() => addScore(broken, { name: 'Ana', chips: 1, hands: 1 }));
  assert.doesNotThrow(() => clearRanking(broken));
});
