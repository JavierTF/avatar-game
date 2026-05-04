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
        metrosBrazoDch: 8.1, metrosBrazoIzq: 7.5,
        velocidadMaxCabeza: 1.8, velocidadMediaCabeza: 0.4,
        velocidadMaxBrazoDch: 2.5, velocidadMaxBrazoIzq: 2.3,
        velocidadMediaBrazoDch: 0.6, velocidadMediaBrazoIzq: 0.5,
        agachadas: 4, saltos: 2, intensidad: 'medio',
        desplazamientoLateral: 6.4, pctTiempoActivo: 55,
        rangoVertical: 0.45, rangoHorizontalX: 1.8, rangoProfundidadZ: 1.2,
        areaOcupada: 2.16, alturaPromedioCabeza: 1.62,
        alturaMaxBrazoDch: 2.1, alturaMaxBrazoIzq: 2.0,
        alcanceMaxBrazoDch: 0.8, alcanceMaxBrazoIzq: 0.75,
        simetriaBrazos: 0.92,
        ...overrides,
    };
}

function makeMetrics(overrides = {}) {
    return {
        reds:   { hit: 1, total: 5 },
        blues:  { hit: 3, total: 4 },
        greens: { hit: 2, total: 3 },
        rachaMaxSinDaño: 6,
        powers: {
            escudo:  { used: 2, killed: 4 },
            sismico: { used: 1, killed: 3 },
            llama:   { used: 0, killed: 0 },
            viento:  { used: 3, killed: 7 },
        },
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

describe('FinalMetricsPanel — tiempo total y mensaje de pie', () => {
    it('renderiza el tiempo total transcurrido en formato "Xm Ys"', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        const metrics = makeMetrics();
        metrics.startTime = Date.now() - 65 * 1000;  // 65s = 1m 5s atrás
        panel.show(makePlayer(), 3, metrics, { x: 0, y: 1.6, z: 0 });

        const allText = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(allText.toLowerCase()).toContain('tiempo');
        expect(allText).toMatch(/1m\s*5s/);
    });

    it('NO le pide al jugador "pulsar" un botón (no posible sin quitarse el headset)', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        const allText = _fakeCtx._texts.map(t => t.text).join(' ').toLowerCase();
        expect(allText).not.toContain('pulsa');
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

// =============================================================================
// MÉTRICAS COMPLETAS — el panel 3D debe mostrar TODAS las métricas que el
// DOM HTML tradicionalmente mostraba (cuerpo/cabeza, brazos, poderes, etc).
// =============================================================================
describe('FinalMetricsPanel — métricas de cuerpo/cabeza', () => {
    function spawnAndText(overrides) {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(overrides), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        return _fakeCtx._texts.map(t => t.text).join(' ');
    }

    it('renderiza velocidad máxima de cabeza', () => {
        const text = spawnAndText({ velocidadMaxCabeza: 2.7 });
        expect(text).toContain('2.7');
    });

    it('renderiza velocidad media de cabeza', () => {
        const text = spawnAndText({ velocidadMediaCabeza: 0.83 });
        expect(text).toContain('0.83');
    });

    it('renderiza rango vertical Y', () => {
        const text = spawnAndText({ rangoVertical: 0.67 });
        expect(text.toLowerCase()).toContain('vertical');
        expect(text).toContain('0.67');
    });

    it('renderiza rango horizontal X', () => {
        const text = spawnAndText({ rangoHorizontalX: 2.3 });
        expect(text.toLowerCase()).toContain('lateral');
        expect(text).toContain('2.3');
    });

    it('renderiza rango de profundidad Z', () => {
        const text = spawnAndText({ rangoProfundidadZ: 1.55 });
        expect(text.toLowerCase()).toContain('profundidad');
        expect(text).toContain('1.55');
    });

    it('renderiza área ocupada', () => {
        const text = spawnAndText({ areaOcupada: 4.41 });
        expect(text.toLowerCase()).toContain('área');
        expect(text).toContain('4.41');
    });

    it('renderiza altura promedio de cabeza', () => {
        const text = spawnAndText({ alturaPromedioCabeza: 1.65 });
        expect(text.toLowerCase()).toContain('altura');
        expect(text).toContain('1.65');
    });

    it('renderiza desplazamiento lateral total', () => {
        const text = spawnAndText({ desplazamientoLateral: 9.4 });
        expect(text.toLowerCase()).toContain('desplazamiento');
        expect(text).toContain('9.4');
    });

    it('renderiza % tiempo en movimiento', () => {
        const text = spawnAndText({ pctTiempoActivo: 73 });
        expect(text).toContain('73');
        expect(text).toMatch(/%|movimiento/i);
    });
});

describe('FinalMetricsPanel — métricas de brazos', () => {
    function spawnAndText(overrides) {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(overrides), 3, makeMetrics(), { x: 0, y: 1.6, z: 0 });
        return _fakeCtx._texts.map(t => t.text).join(' ');
    }

    it('renderiza distancia recorrida por brazo derecho', () => {
        const text = spawnAndText({ metrosBrazoDch: 12.3 });
        expect(text).toContain('12.3');
    });

    it('renderiza distancia recorrida por brazo izquierdo', () => {
        const text = spawnAndText({ metrosBrazoIzq: 11.7 });
        expect(text).toContain('11.7');
    });

    it('renderiza velocidad máxima brazo derecho', () => {
        const text = spawnAndText({ velocidadMaxBrazoDch: 3.45 });
        expect(text).toContain('3.45');
    });

    it('renderiza velocidad máxima brazo izquierdo', () => {
        const text = spawnAndText({ velocidadMaxBrazoIzq: 3.21 });
        expect(text).toContain('3.21');
    });

    it('renderiza altura máxima brazo derecho', () => {
        const text = spawnAndText({ alturaMaxBrazoDch: 2.45 });
        expect(text).toContain('2.45');
    });

    it('renderiza altura máxima brazo izquierdo', () => {
        const text = spawnAndText({ alturaMaxBrazoIzq: 2.31 });
        expect(text).toContain('2.31');
    });

    it('renderiza alcance máximo brazo derecho', () => {
        const text = spawnAndText({ alcanceMaxBrazoDch: 0.92 });
        expect(text.toLowerCase()).toContain('alcance');
        expect(text).toContain('0.92');
    });

    it('renderiza alcance máximo brazo izquierdo', () => {
        const text = spawnAndText({ alcanceMaxBrazoIzq: 0.87 });
        expect(text).toContain('0.87');
    });

    it('renderiza simetría de brazos D/I', () => {
        const text = spawnAndText({ simetriaBrazos: 0.85 });
        expect(text.toLowerCase()).toContain('simetría');
        expect(text).toContain('0.85');
    });
});

describe('FinalMetricsPanel — tabla de poderes', () => {
    function spawnAndText(metricsOverrides) {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics(metricsOverrides), { x: 0, y: 1.6, z: 0 });
        return _fakeCtx._texts.map(t => t.text).join(' ').toLowerCase();
    }

    it('renderiza nombre y stats de cada poder (escudo, sismico, llama, viento)', () => {
        const text = spawnAndText({
            powers: {
                escudo:  { used: 5, killed: 12 },
                sismico: { used: 3, killed: 9 },
                llama:   { used: 2, killed: 7 },
                viento:  { used: 4, killed: 11 },
            },
        });
        expect(text).toContain('escudo');
        expect(text).toContain('sismico');
        expect(text).toContain('llama');
        expect(text).toContain('viento');
    });

    it('renderiza usos y eliminados de cada poder', () => {
        const scene = makeScene();
        const panel = new FinalMetricsPanel(scene);
        panel.show(makePlayer(), 3, makeMetrics({
            powers: {
                escudo:  { used: 7, killed: 13 },
                sismico: { used: 0, killed: 0 },
                llama:   { used: 0, killed: 0 },
                viento:  { used: 0, killed: 0 },
            },
        }), { x: 0, y: 1.6, z: 0 });
        const text = _fakeCtx._texts.map(t => t.text).join(' ');
        expect(text).toContain('7');
        expect(text).toContain('13');
    });
});
