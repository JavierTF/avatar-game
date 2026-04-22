// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Metrics } from '../js/metrics.js';

function makePlayer(overrides = {}) {
    return {
        vida: 5, mana: 0, puntos: 0, combo: 0, maxCombo: 0,
        manaGastado: 0, metros: 0,
        metrosBrazoDch: 0, metrosBrazoIzq: 0,
        velocidadMaxCabeza: 0, velocidadMaxBrazoDch: 0, velocidadMaxBrazoIzq: 0,
        velocidadMediaCabeza: 0, velocidadMediaBrazoDch: 0, velocidadMediaBrazoIzq: 0,
        agachadas: 0, saltos: 0, desplazamientoLateral: 0,
        rangoVertical: 0, rangoHorizontalX: 0, rangoProfundidadZ: 0,
        areaOcupada: 0, alturaPromedioCabeza: 0,
        alturaMaxBrazoDch: 0, alturaMaxBrazoIzq: 0,
        alcanceMaxBrazoDch: 0, alcanceMaxBrazoIzq: 0,
        simetriaBrazos: 1, pctTiempoActivo: 0, intensidad: 'bajo',
        ...overrides,
    };
}

describe('Metrics — contadores básicos', () => {
    it('ballSpawned incrementa el total por color', () => {
        const m = new Metrics();
        m.ballSpawned('red');
        m.ballSpawned('red');
        m.ballSpawned('blue');
        expect(m.reds.total).toBe(2);
        expect(m.blues.total).toBe(1);
    });

    it('ballHit incrementa el hit por color', () => {
        const m = new Metrics();
        m.ballHit('blue');
        m.ballHit('green');
        m.ballHit('green');
        expect(m.blues.hit).toBe(1);
        expect(m.greens.hit).toBe(2);
    });

    it('powerUsed acumula usos y eliminaciones', () => {
        const m = new Metrics();
        m.powerUsed('sismico', 3);
        m.powerUsed('sismico', 2);
        m.powerUsed('escudo', 0);
        expect(m.powers.sismico.used).toBe(2);
        expect(m.powers.sismico.killed).toBe(5);
        expect(m.powers.escudo.used).toBe(1);
    });
});

describe('Metrics — naranjas por efecto', () => {
    it('ballHit("orange", sub) incrementa el subcontador', () => {
        const m = new Metrics();
        m.ballHit('orange', 'heal');
        m.ballHit('orange', 'heal');
        m.ballHit('orange', 'mana');
        expect(m.naranjasPorEfecto.heal).toBe(2);
        expect(m.naranjasPorEfecto.mana).toBe(1);
        expect(m.naranjasPorEfecto.points).toBe(0);
        expect(m.naranjasPorEfecto.slow).toBe(0);
    });

    it('ballHit("orange") sin sub no rompe y cuenta el hit total', () => {
        const m = new Metrics();
        m.ballHit('orange');
        expect(m.oranges.hit).toBe(1);
        expect(m.naranjasPorEfecto.heal).toBe(0);
    });

    it('subefecto desconocido se ignora silenciosamente', () => {
        const m = new Metrics();
        m.ballHit('orange', 'fake-effect');
        expect(m.oranges.hit).toBe(1);
        expect(m.naranjasPorEfecto.heal).toBe(0);
    });
});

describe('Metrics — racha sin daño', () => {
    it('redEscaped incrementa rachaActual', () => {
        const m = new Metrics();
        m.redEscaped();
        m.redEscaped();
        expect(m.rachaActual).toBe(2);
    });

    it('rachaMaxSinDaño trackea el pico de rachaActual', () => {
        const m = new Metrics();
        m.redEscaped(); m.redEscaped(); m.redEscaped();
        expect(m.rachaMaxSinDaño).toBe(3);
    });

    it('ballHit("red") resetea rachaActual pero conserva la máxima', () => {
        const m = new Metrics();
        m.redEscaped(); m.redEscaped(); m.redEscaped(); // racha=3
        m.ballHit('red');
        expect(m.rachaActual).toBe(0);
        expect(m.rachaMaxSinDaño).toBe(3);
    });

    it('tras reset, la nueva racha sólo se registra como máxima si la supera', () => {
        const m = new Metrics();
        m.redEscaped(); m.redEscaped(); m.redEscaped(); // max=3
        m.ballHit('red');
        m.redEscaped(); m.redEscaped();                  // actual=2, no supera max
        expect(m.rachaMaxSinDaño).toBe(3);
        m.redEscaped(); m.redEscaped();                  // actual=4, supera
        expect(m.rachaMaxSinDaño).toBe(4);
    });
});

describe('Metrics — reset', () => {
    it('reset deja los contadores a 0', () => {
        const m = new Metrics();
        m.ballSpawned('red');
        m.ballHit('blue');
        m.redEscaped();
        m.powerUsed('llama', 2);
        m.reset();
        expect(m.reds.total).toBe(0);
        expect(m.blues.hit).toBe(0);
        expect(m.rachaMaxSinDaño).toBe(0);
        expect(m.rachaActual).toBe(0);
        expect(m.powers.llama.used).toBe(0);
        expect(m.naranjasPorEfecto.heal).toBe(0);
    });
});

describe('Metrics — buildHTML', () => {
    it('devuelve un string que contiene las métricas clave del jugador', () => {
        const m = new Metrics();
        m.ballSpawned('red'); m.ballSpawned('red'); m.ballHit('red');
        m.ballHit('orange', 'heal');
        m.redEscaped();
        m.powerUsed('viento', 4);

        const player = makePlayer({
            puntos: 250, maxCombo: 5,
            metros: 12.3, metrosBrazoDch: 8.1, metrosBrazoIzq: 7.5,
            agachadas: 4, saltos: 2, pctTiempoActivo: 55, intensidad: 'medio',
            manaGastado: 80, rangoVertical: 0.45, rangoHorizontalX: 1.8, rangoProfundidadZ: 1.2,
            areaOcupada: 2.16, alturaPromedioCabeza: 1.62,
            velocidadMaxCabeza: 1.8, velocidadMediaCabeza: 0.4,
            velocidadMaxBrazoDch: 2.5, velocidadMaxBrazoIzq: 2.3,
            velocidadMediaBrazoDch: 0.6, velocidadMediaBrazoIzq: 0.5,
            alturaMaxBrazoDch: 2.1, alturaMaxBrazoIzq: 2.0,
            alcanceMaxBrazoDch: 0.8, alcanceMaxBrazoIzq: 0.75,
            simetriaBrazos: 0.92,
        });
        const html = m.buildHTML(player, 3);

        // General
        expect(html).toContain('Nivel máximo');
        expect(html).toContain('250');
        expect(html).toContain('medio');
        // Cuerpo
        expect(html).toContain('12.3 m');
        expect(html).toContain('Saltos');
        expect(html).toContain('Rango lateral');
        expect(html).toContain('Área ocupada');
        // Brazos
        expect(html).toContain('Simetría');
        expect(html).toContain('0.92');
        expect(html).toContain('Alcance máximo');
        // Bolas
        expect(html).toContain('esquivadas');
        expect(html).toContain('Naranjas por efecto');
        expect(html).toContain('Racha máxima');
        // Poderes
        expect(html).toContain('Mana total consumido');
        expect(html).toContain('80');
    });
});
