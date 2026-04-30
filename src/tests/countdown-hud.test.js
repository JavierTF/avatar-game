// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';

const _fakeCtx = {
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
    fillText(text) { this._lastText = text; },
    fillRect() {},
    clearRect() {},
};
const _fakeCanvas = { width: 0, height: 0, getContext() { return _fakeCtx; } };

beforeAll(() => {
    vi.spyOn(document, 'createElement').mockImplementation((tag) =>
        tag === 'canvas' ? _fakeCanvas : document.createElement(tag)
    );
});

vi.mock('three', () => ({
    CanvasTexture: class {
        constructor() { this.needsUpdate = false; }
        dispose() {}
    },
    SpriteMaterial: class {
        constructor(opts) {
            this.map = (opts && opts.map) || { dispose() {} };
            this.opacity = 1;
            this.transparent = !!(opts && opts.transparent);
            this.depthTest = !!(opts && opts.depthTest);
        }
        dispose() {}
    },
    Sprite: class {
        constructor(mat) {
            this.position = {
                x: 0, y: 0, z: 0,
                set(x, y, z) { this.x = x; this.y = y; this.z = z; },
            };
            this.scale = { set() {} };
            this.material = mat;
        }
    },
}));

const { CountdownHUD, COUNTDOWN_OFFSET } = await import('../js/countdown-hud.js');

function makeScene() {
    const _added = [], _removed = [];
    return {
        _added, _removed,
        add(o)    { _added.push(o); },
        remove(o) { _removed.push(o); _added.splice(_added.indexOf(o), 1); },
    };
}

describe('CountdownHUD — offset (a la izquierda del popup vida/mana en +1.5)', () => {
    it('COUNTDOWN_OFFSET es {x: -1.5, y: 2.4, z: -4.0}', () => {
        expect(COUNTDOWN_OFFSET.x).toBe(-1.5);
        expect(COUNTDOWN_OFFSET.y).toBe(2.4);
        expect(COUNTDOWN_OFFSET.z).toBe(-4.0);
    });
});

describe('CountdownHUD — ciclo de vida del sprite', () => {
    it('al construir añade un sprite a la escena', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        expect(scene._added.length).toBe(1);
        expect(scene._added[0]).toBe(hud._sprite);
    });

    it('dispose elimina el sprite de la escena', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        const sprite = hud._sprite;
        hud.dispose();
        expect(scene._removed).toContain(sprite);
        expect(scene._added.includes(sprite)).toBe(false);
    });

    it('dispose es idempotente (llamarlo dos veces no rompe ni elimina extra)', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        hud.dispose();
        const removedAfterFirst = scene._removed.length;
        expect(() => hud.dispose()).not.toThrow();
        expect(scene._removed.length).toBe(removedAfterFirst);
    });

    it('update tras dispose no rompe (no-op silencioso)', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        hud.dispose();
        expect(() => hud.update(45, { x: 0, y: 0, z: 0 })).not.toThrow();
    });
});

describe('CountdownHUD — posición del sprite tras update', () => {
    it('aplica el offset RELATIVO a la posición de la cámara', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);

        hud.update(60, { x: 5, y: 1.6, z: 10 });

        expect(hud._sprite.position.x).toBe(5 + COUNTDOWN_OFFSET.x);
        expect(hud._sprite.position.y).toBe(COUNTDOWN_OFFSET.y);
        expect(hud._sprite.position.z).toBe(10 + COUNTDOWN_OFFSET.z);
    });

    it('el sprite queda a la IZQUIERDA del jugador con un offset significativo (no marginal)', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        hud.update(60, { x: 2, y: 1.6, z: 0 });
        // Espera que el offset sea de al menos 1m a la izquierda — no sólo
        // "un poco menos que cameraPos.x" que admitiría offsets ridículos.
        expect(hud._sprite.position.x).toBeLessThanOrEqual(2 - 1.0);
        expect(COUNTDOWN_OFFSET.x).toBeLessThan(0);  // ratifica lateralidad
    });

    it('la altura es fija (Y=2.4) sin importar la altura de la cámara', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        hud.update(60, { x: 0, y: 0.5, z: 0 });
        expect(hud._sprite.position.y).toBe(2.4);
        hud.update(60, { x: 0, y: 3.0, z: 0 });
        expect(hud._sprite.position.y).toBe(2.4);
    });

    it('la profundidad es 4m delante (z = camZ - 4)', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        hud.update(60, { x: 0, y: 1.6, z: 0 });
        expect(hud._sprite.position.z).toBe(-4);
        hud.update(60, { x: 0, y: 1.6, z: 5 });
        expect(hud._sprite.position.z).toBe(1);
    });
});

describe('CountdownHUD — formato del texto del contador', () => {
    it('muestra los segundos como entero (60, 30, 1, 0)', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);

        hud.update(60, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('60');

        hud.update(30, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('30');

        hud.update(1, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('1');

        hud.update(0, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('0');
    });

    it('valores fraccionarios suben al entero superior (ceil) — evita salto a 0 prematuro', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);

        hud.update(30.4, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('31');

        hud.update(0.5, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('1');

        hud.update(0.001, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('1');
    });

    it('valores negativos se clampan a "0" (no muestra "-1")', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);
        hud.update(-5, { x: 0, y: 0, z: 0 });
        expect(hud.currentText).toBe('0');
    });
});

describe('CountdownHUD — eficiencia: no regenera textura si el segundo no cambia', () => {
    it('dos updates con el mismo segundo entero conservan la misma instancia de map', () => {
        const scene = makeScene();
        const hud   = new CountdownHUD(scene);

        hud.update(45, { x: 0, y: 0, z: 0 });
        const tex1 = hud._sprite.material.map;

        hud.update(45.3, { x: 0, y: 0, z: 0 });  // ceil(45.3) = 46 — distinto, regenera
        const tex2 = hud._sprite.material.map;
        expect(tex2).not.toBe(tex1);

        hud.update(45.7, { x: 0, y: 0, z: 0 });  // ceil(45.7) = 46 — igual a tex2, no regenera
        const tex3 = hud._sprite.material.map;
        expect(tex3).toBe(tex2);
    });
});
