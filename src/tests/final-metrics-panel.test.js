// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const _fakeCtx = {
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
    _texts: [],
    fillText(text, x, y) { this._texts.push({ text, x, y }); },
    fillRect() {},
    clearRect() {},
};
const _fakeCanvas = { width: 0, height: 0, getContext() { return _fakeCtx; } };

beforeAll(() => {
    vi.spyOn(document, 'createElement').mockImplementation((tag) =>
        tag === 'canvas' ? _fakeCanvas : document.createElement(tag)
    );
});

beforeEach(() => {
    _fakeCtx._texts = [];
    _fakeCanvas.width  = 0;
    _fakeCanvas.height = 0;
});

vi.mock('three', () => ({
    CanvasTexture: class { constructor() { this.needsUpdate = false; } dispose() {} },
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
            this.scale = {
                x: 1, y: 1, z: 1,
                set(x, y, z) { this.x = x; this.y = y; this.z = z; },
            };
            this.material = mat;
        }
    },
}));

const { FinalMetricsPanel, FINAL_PANEL_OFFSET } =
    await import('../js/final-metrics-panel.js');

function makeScene() {
    const _added = [], _removed = [];
    return {
        _added, _removed,
        add(o)    { _added.push(o); },
        remove(o) { _removed.push(o); _added.splice(_added.indexOf(o), 1); },
    };
}

function makePlayer(overrides = {}) {
    return {
        vida: 5, maxVida: 5, mana: 50, puntos: 250, combo: 0, maxCombo: 5,
        manaGastado: 80, metros: 12.3,
        agachadas: 4, saltos: 2, intensidad: 'medio',
        ...overrides,
    };
}

function makeMetrics(overrides = {}) {
    return {
        reds:   { hit: 1, total: 5 },
        blues:  { hit: 3, total: 4 },
        greens: { hit: 2, total: 3 },
        rachaMaxSinDaño: 6,
        powers: {},
        ...overrides,
    };
}

describe('FinalMetricsPanel — offset', () => {
    it('FINAL_PANEL_OFFSET centrado, a altura de cara, más cerca que el countdown (z=-4)', () => {
        expect(FINAL_PANEL_OFFSET.x).toBe(0);
        expect(FINAL_PANEL_OFFSET.y).toBeGreaterThan(1);
        expect(FINAL_PANEL_OFFSET.y).toBeLessThan(2.5);
        // z negativo (delante) y > -4 (más cerca que el countdown)
        expect(FINAL_PANEL_OFFSET.z).toBeLessThan(0);
        expect(FINAL_PANEL_OFFSET.z).toBeGreaterThan(-4);
    });
});

describe('FinalMetricsPanel — ciclo de vida', () => {
    it('al construir NO añade el panel a la escena (dormant)', () => {
        const scene = makeScene();
        new FinalMetricsPanel(scene);
        expect(scene._added.length).toBe(0);
    });

    it('show() añade el sprite a la escena', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        expect(scene._added.length).toBe(1);
    });

    it('hide() elimina el sprite de la escena', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const sprite = scene._added[0];
        panel.hide();
        expect(scene._removed).toContain(sprite);
        expect(scene._added.includes(sprite)).toBe(false);
    });

    it('hide() es seguro si nunca se llamó show() (no rompe ni añade nada raro)', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        expect(() => panel.hide()).not.toThrow();
        expect(scene._added.length).toBe(0);
        expect(scene._removed.length).toBe(0);
    });

    it('hide() múltiples veces no rompe', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        panel.hide();
        expect(() => panel.hide()).not.toThrow();
    });

    it('show() consecutivo no duplica el panel — solo queda 1 sprite activo', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        panel.show(makePlayer(), 5, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        expect(scene._added.length).toBe(1);
    });
});

describe('FinalMetricsPanel — posición exacta', () => {
    it('show() posiciona el sprite usando el offset relativo a la cámara', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 5, y: 1.6, z: 10 });

        const sprite = scene._added[0];
        expect(sprite.position.x).toBe(5 + FINAL_PANEL_OFFSET.x);
        expect(sprite.position.y).toBe(FINAL_PANEL_OFFSET.y);
        expect(sprite.position.z).toBe(10 + FINAL_PANEL_OFFSET.z);
    });

    it('el panel se queda en el mundo donde se mostró — show() no llama set() después', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const sprite = scene._added[0];
        const xInicial = sprite.position.x;
        const zInicial = sprite.position.z;
        // No hay update() — la pos se queda fija (no sigue al jugador).
        expect(sprite.position.x).toBe(xInicial);
        expect(sprite.position.z).toBe(zInicial);
    });
});

describe('FinalMetricsPanel — contenido renderizado', () => {
    it('renderiza la puntuación del jugador', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer({ puntos: 1234 }), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText).toContain('1234');
    });

    it('renderiza el nivel máximo', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 7, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText).toContain('7');
    });

    it('renderiza un título de fin de partida', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ').toUpperCase();
        expect(allText).toContain('FIN');
    });

    it('renderiza etiquetas de las tres bolas (rojas, azules, verdes)', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ').toLowerCase();
        expect(allText).toContain('roja');
        expect(allText).toContain('azul');
        expect(allText).toContain('verde');
    });

    it('renderiza el ratio "hit/total" para azules y verdes', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics({
            blues:  { hit: 3, total: 4 },
            greens: { hit: 2, total: 3 },
        }), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText).toContain('3/4');
        expect(allText).toContain('2/3');
    });

    it('renderiza la racha máxima sin daño', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics({ rachaMaxSinDaño: 42 }), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText).toContain('42');
    });

    it('renderiza saltos y agachadas del jugador', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer({ saltos: 9, agachadas: 11 }), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText).toContain('9');
        expect(allText).toContain('11');
    });

    it('renderiza la distancia recorrida', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer({ metros: 27.4 }), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText).toContain('27.4');
    });

    it('renderiza la intensidad estimada', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer({ intensidad: 'alto' }), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ').toLowerCase();
        expect(allText).toContain('alto');
    });

    it('canvas tiene resolución alta (≥1024×512) para ser legible en VR', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        expect(_fakeCanvas.width).toBeGreaterThanOrEqual(1024);
        expect(_fakeCanvas.height).toBeGreaterThanOrEqual(512);
    });
});

describe('FinalMetricsPanel — escala del sprite', () => {
    it('el sprite tiene escala suficiente para ser visible (>= 1.5 en X)', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const sprite = scene._added[0];
        expect(sprite.scale.x).toBeGreaterThanOrEqual(1.5);
        expect(sprite.scale.y).toBeGreaterThanOrEqual(1.0);
    });
});
