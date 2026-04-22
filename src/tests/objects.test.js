import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    SphereGeometry:       class { dispose() {} },
    MeshStandardMaterial: class { dispose() {} constructor() { this.emissive = { multiplyScalar() {} }; } },
    Mesh: class {
        constructor() {
            this.position = {
                x: 0, y: 0, z: 0,
                copy(v) { if (v) { this.x = v.x; this.y = v.y; this.z = v.z; } return this; },
                set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
                add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; },
            };
            this.castShadow = false;
            this.rotation = { x: 0, y: 0, z: 0 };
        }
    },
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

describe('BallManager — naranja: cooldown en update()', () => {
    it('activa el cooldown cuando sale una naranja', () => {
        const m = makeManager(1);
        m._pickType   = () => 'orange';   // forzar naranja
        m._spawnTimer = 99;                // forzar spawn
        expect(m._orangeCooldown).toBe(0);
        m.update(0, { x: 0, y: 1.6, z: 0 });
        expect(m._orangeCooldown).toBeGreaterThan(0);
    });

    it('no activa el cooldown si sale otro tipo', () => {
        const m = makeManager(1);
        m._pickType   = () => 'red';
        m._spawnTimer = 99;
        m.update(0, { x: 0, y: 1.6, z: 0 });
        expect(m._orangeCooldown).toBe(0);
    });

    it('decrementa el cooldown con el delta', () => {
        const m = makeManager(1);
        m._orangeCooldown = 5;
        m.update(0.1, { x: 0, y: 1.6, z: 0 });
        expect(m._orangeCooldown).toBeCloseTo(4.9, 5);
    });

    it('el cooldown no baja de 0', () => {
        const m = makeManager(1);
        m._orangeCooldown = 0.05;
        m.update(0.5, { x: 0, y: 1.6, z: 0 });
        expect(m._orangeCooldown).toBe(0);
    });

    it('duración del cooldown es mayor a nivel más alto', () => {
        const low  = makeManager(1);
        const high = makeManager(10);
        expect(high._orangeCooldownDuration())
            .toBeGreaterThan(low._orangeCooldownDuration());
    });

    it('duración base en nivel 1 es de 10 segundos', () => {
        const m = makeManager(1);
        expect(m._orangeCooldownDuration()).toBe(10);
    });
});

describe('BallManager — naranja: efecto aleatorio y campos de caos', () => {
    it('asigna un effect de la lista válida', () => {
        const m = makeManager(1);
        const posibles = new Set(['heal', 'mana', 'points', 'slow']);
        for (let i = 0; i < 30; i++) {
            const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
            expect(posibles.has(ball.effect)).toBe(true);
        }
    });

    it('asigna _age inicializado a 0, _chaosPhase y _chaosFreq', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        expect(ball._age).toBe(0);
        expect(typeof ball._chaosPhase).toBe('number');
        expect(typeof ball._chaosFreq).toBe('number');
    });

    it('_chaosFreq está en el rango [7, 13)', () => {
        const m = makeManager(1);
        for (let i = 0; i < 50; i++) {
            const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
            expect(ball._chaosFreq).toBeGreaterThanOrEqual(7);
            expect(ball._chaosFreq).toBeLessThan(13);
        }
    });

    it('bolas no naranjas no tienen effect ni campos de caos', () => {
        const m = makeManager(1);
        for (const type of ['red', 'blue', 'green']) {
            const ball = m.spawn(type, { x: 0, y: 1.6, z: 0 });
            expect(ball.effect).toBeUndefined();
            expect(ball._age).toBeUndefined();
            expect(ball._chaosPhase).toBeUndefined();
            expect(ball._chaosFreq).toBeUndefined();
        }
    });
});

describe('BallManager — movimiento loco de la naranja', () => {
    it('_moveBall incrementa _age en naranjas no rebotadas', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        const age0 = ball._age;
        m._moveBall(ball, 0.1, { x: 0, y: 1.6, z: 0 });
        expect(ball._age).toBeGreaterThan(age0);
    });

    it('_moveBall NO incrementa _age si la bola está _bounced', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        ball._bounced = true;
        const age0 = ball._age;
        m._moveBall(ball, 0.1, { x: 0, y: 1.6, z: 0 });
        expect(ball._age).toBe(age0);
    });

    it('_moveBall NO sobrescribe velocity si la bola está _bounced', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        ball._bounced = true;
        ball.velocity.x = 0.12;
        ball.velocity.y = -0.08;
        m._moveBall(ball, 0.1, { x: 0, y: 1.6, z: 0 });
        expect(ball.velocity.x).toBe(0.12);
        expect(ball.velocity.y).toBe(-0.08);
    });

    it('_moveBall sobrescribe velocity.x/y en naranjas no rebotadas', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        ball._chaosPhase = 0.5;
        ball._chaosFreq  = 10;
        ball.velocity.x  = 0;
        ball.velocity.y  = 0;
        m._moveBall(ball, 0.1, { x: 0, y: 1.6, z: 0 });
        // Con fase/freq fijos y delta 0.1, sin/cos producen valores no-cero.
        expect(ball.velocity.x !== 0 || ball.velocity.y !== 0).toBe(true);
    });
});
