import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    SphereGeometry:       class { dispose() {} },
    MeshStandardMaterial: class { dispose() {} constructor() { this.emissive = { multiplyScalar() {} }; } },
    Mesh:  class { constructor() { this.position = { copy(){} }; this.castShadow = false; this.rotation = {}; } },
    Color: class { constructor() {} multiplyScalar() { return this; } },
    Vector3: class {
        constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
        set(x,y,z) { this.x=x; this.y=y; this.z=z; return this; }
        copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this; }
        clone() { return Object.assign(new this.constructor(), this); }
        subVectors(a,b) { this.x=a.x-b.x; this.y=a.y-b.y; this.z=a.z-b.z; return this; }
        normalize() { return this; }
        multiplyScalar() { return this; }
        add(v) { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
        distanceTo() { return 0; }
    },
    MathUtils: { lerp: (a, b, t) => a + (b - a) * t, degToRad: (d) => d * Math.PI / 180 },
    BufferGeometry: class { setFromPoints() { return this; } },
    LineBasicMaterial: class { },
    Line: class { constructor() { this.scale = {}; } clone() { return this; } },
}));

vi.mock('./scene.js', () => ({ BOUNDS: { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 } }));
vi.mock('../js/scene.js', () => ({ BOUNDS: { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 } }));

const { BallManager } = await import('../js/objects.js');
const { Difficulty }  = await import('../js/difficulty.js');

function makeManager(nivel = 1) {
    const scene      = { add() {}, remove() {} };
    const config     = { balls: { red: { speed: 0.015 }, blue: { speed: 0.012 }, green: { speed: 0.010 }, orange: { speed: 0.008, pattern: 'straight' } } };
    const difficulty = new Difficulty(nivel);
    return new BallManager(scene, config, difficulty);
}

describe('BallManager — pesos de spawn', () => {
    it('nivel 1: 4 verdes, 4 azules, 2 naranjas de 20', () => {
        const m = makeManager(1);
        const w = m._spawnWeights();
        expect(w.green).toBe(4);
        expect(w.blue).toBe(4);
        expect(w.orange).toBe(2);
        expect(w.red + w.blue + w.green + w.orange).toBe(20);
    });

    it('nivel 11+: 2 verdes, 2 azules, 1 naranja de 20', () => {
        const m = makeManager(11);
        const w = m._spawnWeights();
        expect(w.green).toBe(2);
        expect(w.blue).toBe(2);
        expect(w.orange).toBe(1);
        expect(w.red + w.blue + w.green + w.orange).toBe(20);
    });

    it('los pesos siempre suman 20', () => {
        for (const nivel of [1, 3, 5, 7, 10, 15]) {
            const m = makeManager(nivel);
            const w = m._spawnWeights();
            expect(w.red + w.blue + w.green + w.orange).toBe(20);
        }
    });

    it('verdes y azules disminuyen al subir el nivel', () => {
        const w1  = makeManager(1)._spawnWeights();
        const w11 = makeManager(11)._spawnWeights();
        expect(w11.green).toBeLessThanOrEqual(w1.green);
        expect(w11.blue).toBeLessThanOrEqual(w1.blue);
    });

    it('naranjas disminuyen al subir el nivel', () => {
        const w1  = makeManager(1)._spawnWeights();
        const w11 = makeManager(11)._spawnWeights();
        expect(w11.orange).toBeLessThanOrEqual(w1.orange);
    });

    it('_pickType devuelve un tipo válido', () => {
        const m     = makeManager(1);
        const tipos = new Set();
        for (let i = 0; i < 100; i++) tipos.add(m._pickType());
        for (const t of tipos) {
            expect(['red', 'blue', 'green', 'orange']).toContain(t);
        }
    });

    it('mientras el cooldown está activo no genera naranja', () => {
        const m = makeManager(1);
        m._orangeCooldown = 5;
        const tipos = Array.from({ length: 200 }, () => m._pickType());
        expect(tipos).not.toContain('orange');
    });
});
