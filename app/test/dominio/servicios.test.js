import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tablero } from '../../src/dominio/Tablero.js';
import { Sonido } from '../../src/dominio/Sonido.js';
import { ModoDisparo } from '../../src/dominio/valores/ModoDisparo.js';
import { elegirSonidoAleatorio } from '../../src/dominio/servicios/SelectorAleatorio.js';
import { sonidosACortar } from '../../src/dominio/servicios/ReglasDeSolapamiento.js';

test('elegirSonidoAleatorio devuelve null en un banco vacío', () => {
  let t = Tablero.vacio().crearBanco('Vacío', '#000');
  assert.equal(elegirSonidoAleatorio(t.bancos[0]), null);
});

test('elegirSonidoAleatorio con un solo sonido siempre lo devuelve', () => {
  let t = Tablero.vacio().crearBanco('Uno', '#000');
  const banco0 = t.bancos[0];
  t = t.conSonidoAgregado(banco0.id, 0, new Sonido({ nombre: 'X' }));
  const banco = t.bancos[0];
  for (let i = 0; i < 10; i++) {
    assert.equal(elegirSonidoAleatorio(banco).nombre, 'X');
  }
});

test('elegirSonidoAleatorio evita repetir el último elegido cuando hay más de uno', () => {
  let t = Tablero.vacio().crearBanco('Dos', '#000');
  const b0 = t.bancos[0];
  t = t.conSonidoAgregado(b0.id, 0, new Sonido({ nombre: 'A' }));
  t = t.conSonidoAgregado(b0.id, 1, new Sonido({ nombre: 'B' }));
  const banco = t.bancos[0];
  const a = banco.listaSonidos().find((s) => s.nombre === 'A');
  for (let i = 0; i < 20; i++) {
    const elegido = elegirSonidoAleatorio(banco, a.id);
    assert.notEqual(elegido.id, a.id);
  }
});

test('sonidosACortar no corta nada para UN_TIRO/LOOP/MANTENER', () => {
  const sonido = new Sonido({ nombre: 'X', modo: ModoDisparo.LOOP });
  const activos = [{ soundId: 'otro', bancoId: 'b1', modo: ModoDisparo.LOOP }];
  assert.deepEqual(sonidosACortar(sonido, 'b1', activos), []);
});

test('sonidosACortar corta otros EXCLUSIVO del mismo banco', () => {
  const sonido = new Sonido({ nombre: 'CamaNueva', modo: ModoDisparo.EXCLUSIVO });
  const activos = [
    { soundId: 'cama-vieja', bancoId: 'b1', modo: ModoDisparo.EXCLUSIVO },
    { soundId: 'golpe', bancoId: 'b1', modo: ModoDisparo.UN_TIRO },
    { soundId: 'cama-otro-banco', bancoId: 'b2', modo: ModoDisparo.EXCLUSIVO },
  ];
  assert.deepEqual(sonidosACortar(sonido, 'b1', activos), ['cama-vieja']);
});

test('sonidosACortar no se corta a sí mismo', () => {
  const sonido = new Sonido({ nombre: 'Cama', modo: ModoDisparo.EXCLUSIVO });
  const activos = [{ soundId: sonido.id, bancoId: 'b1', modo: ModoDisparo.EXCLUSIVO }];
  assert.deepEqual(sonidosACortar(sonido, 'b1', activos), []);
});
