import { describe, it, expect, vi } from 'vitest';

vi.mock('three', async () => await import('./_three-mock.js'));

vi.mock('./scene.js', () => ({ BOUNDS: { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 } }));
vi.mock('../js/scene.js', () => ({ BOUNDS: { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 } }));

const { BallManager } = await import('../js/objects.js');
const { Difficulty }  = await import('../js/difficulty.js');

function makeManager(nivel = 1) {
    const scene      = { add() {}, remove() {} };
    const config     = { balls: {
        red:    { speed: 0.008, pattern: 'homing' },
        blue:   { speed: 0.012 },
        orange: { speed: 0.010, pattern: 'straight' },
    } };
    const difficulty = new Difficulty(nivel);
    return new BallManager(scene, config, difficulty);
}

describe('BallManager — pesos de spawn', () => {
    it('nivel 1: 4 azules, 4 naranjas, 5 rojas', () => {
        const m = makeManager(1);
        const w = m._spawnWeights();
        expect(w.blue).toBe(4);
        expect(w.orange).toBe(4);
        expect(w.red).toBe(5);
    });

    it('nivel 11+: 2 azules, 2 naranjas, 8 rojas', () => {
        const m = makeManager(11);
        const w = m._spawnWeights();
        expect(w.blue).toBe(2);
        expect(w.orange).toBe(2);
        expect(w.red).toBe(8);
    });

    it('todos los pesos son no negativos', () => {
        for (const nivel of [1, 3, 5, 7, 10, 15]) {
            const w = makeManager(nivel)._spawnWeights();
            for (const v of Object.values(w)) {
                expect(v).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('azules y naranjas disminuyen al subir el nivel', () => {
        const w1  = makeManager(1)._spawnWeights();
        const w11 = makeManager(11)._spawnWeights();
        expect(w11.blue).toBeLessThanOrEqual(w1.blue);
        expect(w11.orange).toBeLessThanOrEqual(w1.orange);
    });

    it('rojas aumentan al subir el nivel', () => {
        const w1  = makeManager(1)._spawnWeights();
        const w11 = makeManager(11)._spawnWeights();
        expect(w11.red).toBeGreaterThanOrEqual(w1.red);
    });

    it('_pickType sólo devuelve tipos válidos (blue, red, orange)', () => {
        const m     = makeManager(1);
        const tipos = Array.from({ length: 500 }, () => m._pickType());
        for (const t of tipos) {
            expect(['blue', 'red', 'orange']).toContain(t);
        }
        expect(tipos).toContain('orange');  // con 500 muestras debe salir
    });
});

describe('BallManager — bola naranja', () => {
    it('spawn naranja crea una bola con type="orange"', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        expect(ball.type).toBe('orange');
        expect(ball.alive).toBe(true);
    });

    it('naranja NO tiene campos de caos (movimiento recto, no como la roja)', () => {
        const m    = makeManager(1);
        const ball = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        expect(ball._age).toBeUndefined();
        expect(ball._chaosPhase).toBeUndefined();
        expect(ball._chaosFreq).toBeUndefined();
    });

    it('naranja sale detrás del jugador igual que azul (movimiento recto)', () => {
        const m = makeManager(1);
        const b = m.spawn('orange', { x: 0, y: 1.6, z: 0 });
        b.mesh.position.x = 0;
        b.mesh.position.y = 1.0;
        b.mesh.position.z = 1.0;  // detrás del jugador (z>0+0.5)
        b.velocity.set(0, 0, 0);
        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(m.balls.length).toBe(0);
    });
});

describe('BallManager — campos de caos en la roja', () => {
    it('asigna _age=0, _chaosPhase y _chaosFreq al spawnear roja', () => {
        const m    = makeManager(1);
        const ball = m.spawn('red', { x: 0, y: 1.6, z: 0 });
        expect(ball._age).toBe(0);
        expect(typeof ball._chaosPhase).toBe('number');
        expect(typeof ball._chaosFreq).toBe('number');
    });

    it('_chaosFreq está en el rango [7, 13)', () => {
        const m = makeManager(1);
        for (let i = 0; i < 50; i++) {
            const ball = m.spawn('red', { x: 0, y: 1.6, z: 0 });
            expect(ball._chaosFreq).toBeGreaterThanOrEqual(7);
            expect(ball._chaosFreq).toBeLessThan(13);
        }
    });

    it('bolas no rojas no tienen campos de caos', () => {
        const m = makeManager(1);
        for (const type of ['blue', 'orange']) {
            const ball = m.spawn(type, { x: 0, y: 1.6, z: 0 });
            expect(ball._age).toBeUndefined();
            expect(ball._chaosPhase).toBeUndefined();
            expect(ball._chaosFreq).toBeUndefined();
        }
    });
});

describe('BallManager — movimiento loco de la roja', () => {
    it('_moveBall incrementa _age en rojas', () => {
        const m    = makeManager(1);
        const ball = m.spawn('red', { x: 0, y: 1.6, z: 0 });
        const age0 = ball._age;
        m._moveBall(ball, 0.1, { x: 0, y: 1.6, z: 0 });
        expect(ball._age).toBeGreaterThan(age0);
    });

    it('_moveBall sobrescribe velocity.x/y en rojas', () => {
        const m    = makeManager(1);
        const ball = m.spawn('red', { x: 0, y: 1.6, z: 0 });
        ball._chaosPhase = 0.5;
        ball._chaosFreq  = 10;
        ball.velocity.x  = 0;
        ball.velocity.y  = 0;
        m._moveBall(ball, 0.1, { x: 0, y: 1.6, z: 0 });
        // Con fase/freq fijos y delta 0.1, sin/cos producen valores no-cero.
        expect(ball.velocity.x !== 0 || ball.velocity.y !== 0).toBe(true);
    });
});

describe('BallManager — callbacks de métricas', () => {
    it('onBallSpawned se dispara con el tipo cada vez que se crea una bola', () => {
        const m = makeManager(1);
        const spawned = [];
        m.onBallSpawned = (t) => spawned.push(t);
        m.spawn('red',    { x:0, y:1.6, z:0 });
        m.spawn('blue',   { x:0, y:1.6, z:0 });
        m.spawn('orange', { x:0, y:1.6, z:0 });
        expect(spawned).toEqual(['red', 'blue', 'orange']);
    });

    it('onRedEscaped se dispara cuando una roja sale de BOUNDS sin estar _dropped', () => {
        const m = makeManager(1);
        let escaped = 0;
        m.onRedEscaped = () => { escaped++; };

        const ball = m.spawn('red', { x: 0, y: 1.6, z: 0 });
        // Fuerza la bola fuera de BOUNDS (y < -1 según el mock).
        ball.mesh.position.x = 0;
        ball.mesh.position.y = -5;
        ball.mesh.position.z = 0;
        // velocity cero para que no se mueva durante _moveBall.
        ball.velocity.set(0, 0, 0);

        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(escaped).toBe(1);
    });

    it('onRedEscaped NO se dispara si la bola ya estaba _dropped (caída por poder)', () => {
        const m = makeManager(1);
        let escaped = 0;
        m.onRedEscaped = () => { escaped++; };

        const ball = m.spawn('red', { x: 0, y: 1.6, z: 0 });
        ball._dropped = true;
        ball.mesh.position.x = 0;
        ball.mesh.position.y = -5;
        ball.mesh.position.z = 0;
        ball.velocity.set(0, 0, 0);

        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(escaped).toBe(0);
    });

    it('onRedEscaped NO se dispara cuando salen bolas de otro color', () => {
        const m = makeManager(1);
        let escaped = 0;
        m.onRedEscaped = () => { escaped++; };

        for (const type of ['blue', 'orange']) {
            const ball = m.spawn(type, { x: 0, y: 1.6, z: 0 });
            ball.mesh.position.x = 0;
            ball.mesh.position.y = -5;
            ball.mesh.position.z = 0;
            ball.velocity.set(0, 0, 0);
        }
        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(escaped).toBe(0);
    });
});

describe('BallManager — bolas pasan detrás del jugador', () => {
    it('una bola con z > playerZ + 0.5 se elimina', () => {
        const m = makeManager(1);
        const b = m.spawn('blue', { x: 0, y: 1.6, z: 0 });
        b.mesh.position.x = 0;
        b.mesh.position.y = 1.0;
        b.mesh.position.z = 1.0;        // detrás del jugador (z=0)
        b.velocity.set(0, 0, 0);
        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(m.balls.length).toBe(0);
    });

    it('una bola justo delante del jugador NO se elimina', () => {
        const m = makeManager(1);
        const b = m.spawn('blue', { x: 0, y: 1.6, z: 0 });
        b.mesh.position.x = 0;
        b.mesh.position.y = 1.0;
        b.mesh.position.z = -2.0;       // delante del jugador
        b.velocity.set(0, 0, 0);
        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(m.balls.length).toBe(1);
    });
});
