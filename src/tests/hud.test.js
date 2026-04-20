// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { HUD } from '../js/hud.js';

function makePlayer(overrides = {}) {
    return { vida: 5, maxVida: 5, mana: 50, puntos: 120, combo: 0, ...overrides };
}

beforeEach(() => {
    document.body.innerHTML = `
        <div id="hud" style="display:none">
            <div id="hud-vida"></div>
            <div id="hud-mana"></div>
            <div id="hud-pts"></div>
        </div>
        <div id="hud-nivel" style="display:none"></div>
        <div id="hud-combo" style="display:none"></div>
    `;
});

describe('HUD — show()', () => {
    it('muestra el contenedor del HUD', () => {
        const hud = new HUD();
        hud.show();
        expect(document.getElementById('hud').style.display).toBe('flex');
    });

    it('muestra nivel y combo', () => {
        const hud = new HUD();
        hud.show();
        expect(document.getElementById('hud-nivel').style.display).toBe('block');
        expect(document.getElementById('hud-combo').style.display).toBe('block');
    });
});

describe('HUD — refresh()', () => {
    it('muestra corazones llenos con vida máxima', () => {
        const hud = new HUD();
        hud.refresh(makePlayer(), 1);
        expect(document.getElementById('hud-vida').textContent).toBe('♥♥♥♥♥');
    });

    it('muestra corazones vacíos cuando pierde vida', () => {
        const hud = new HUD();
        hud.refresh(makePlayer({ vida: 3 }), 1);
        expect(document.getElementById('hud-vida').textContent).toBe('♥♥♥♡♡');
    });

    it('muestra mana redondeado', () => {
        const hud = new HUD();
        hud.refresh(makePlayer({ mana: 33.7 }), 1);
        expect(document.getElementById('hud-mana').textContent).toBe('Mana: 34%');
    });

    it('muestra puntuación', () => {
        const hud = new HUD();
        hud.refresh(makePlayer({ puntos: 250 }), 1);
        expect(document.getElementById('hud-pts').textContent).toBe('Pts: 250');
    });

    it('muestra nivel actual', () => {
        const hud = new HUD();
        hud.refresh(makePlayer(), 3);
        expect(document.getElementById('hud-nivel').textContent).toBe('Nivel 3');
    });

    it('no muestra combo con combo <= 1', () => {
        const hud = new HUD();
        hud.refresh(makePlayer({ combo: 1 }), 1);
        expect(document.getElementById('hud-combo').textContent).toBe('');
    });

    it('muestra combo cuando es > 1', () => {
        const hud = new HUD();
        hud.refresh(makePlayer({ combo: 4 }), 1);
        expect(document.getElementById('hud-combo').textContent).toBe('x4 COMBO');
    });
});
