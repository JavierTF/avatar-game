import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    Ray: class {
        distanceToPoint() { return 0; }
    },
    Vector3: class {
        constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
        set() { return this; }
        copy() { return this; }
        clone() { return new this.constructor(); }
        subVectors() { return this; }
        normalize() { return this; }
        multiplyScalar() { return this; }
        addScaledVector() { return this; }
        distanceTo() { return 999; }
    },
    TorusGeometry:    class { },
    RingGeometry:     class { },
    SphereGeometry:   class { },
    CylinderGeometry: class { },
    Mesh: class {
        constructor() {
            const self = this;
            this.position = {
                x: 0, y: 0, z: 0,
                copy(){ return self.position; },
                addScaledVector(){ return self.position; },
                set(x, y, z) { self.position.x = x; self.position.y = y; self.position.z = z; return self.position; },
            };
            this.rotation = { x: 0 };
            this.material = { opacity: 1, dispose(){} };
            this.geometry = { dispose(){} };
            this.quaternion = { setFromUnitVectors(){} };
            this.scale = {
                x: 1, y: 1, z: 1,
                setScalar(v) { this.x = this.y = this.z = v; return this; },
                set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
            };
        }
    },
    MeshBasicMaterial: class { constructor() { this.opacity = 1; } dispose() {} },
    DoubleSide: 1,
}));

const { Powers }     = await import('../js/powers.js');
const { Difficulty } = await import('../js/difficulty.js');

function makeMockPlayer(mana = 100) {
    return {
        mana,
        maxMana: 100,
        consumeMana(pct) {
            const cost = 100 * pct;
            if (this.mana < cost) return false;
            this.mana -= cost;
            return true;
        }
    };
}

function makeMockScene() {
    const added = [];
    const removed = [];
    return {
        added,
        removed,
        add(obj)    { added.push(obj); },
        remove(obj) { removed.push(obj); added.splice(added.indexOf(obj), 1); },
    };
}

function makeMockBalls(type = 'red', count = 3) {
    return {
        balls: Array.from({ length: count }, () => ({
            type,
            mesh: { position: { distanceTo: () => 0.1 } },
            velocity: { set() {}, normalize() { return this; }, multiplyScalar() { return this; }, lerp() {} },
            cfg: { speed: 0.01 }
        })),
        remove(b) { this.balls = this.balls.filter(x => x !== b); }
    };
}

describe('Powers — costes de mana (tabla del documento)', () => {
    const cases = [
        // [poder, nivel, costeEsperado]
        ['escudo',  1, 20], ['escudo',  2, 30], ['escudo',  3, 40],
        ['sismico', 1, 40], ['sismico', 2, 50], ['sismico', 3, 60],
        ['llama',   1, 60], ['llama',   2, 70], ['llama',   3, 80],
        ['viento',  1, 60], ['viento',  2, 80], ['viento',  3, 100],
    ];

    for (const [poder, nivel, pct] of cases) {
        it(`${poder} nivel ${nivel} consume ${pct}% de mana`, () => {
            const difficulty = new Difficulty(nivel);
            const player     = makeMockPlayer(100);
            const powers     = new Powers(makeMockScene(), player, makeMockBalls(), difficulty);

            const manaAntes = player.mana;
            const mockVec = { x:0,y:0,z:0, clone(){ return this; }, normalize(){ return this; }, multiplyScalar(){ return this; }, subVectors(){ return this; }, distanceTo(){ return 0; } };
            if (poder === 'escudo')  powers.activateEscudo(mockVec, mockVec);
            if (poder === 'sismico') powers.activateSismico(mockVec);
            if (poder === 'llama')   powers.activateLlama(mockVec, mockVec);
            if (poder === 'viento')  powers.activateViento(mockVec);

            expect(manaAntes - player.mana).toBeCloseTo(pct);
        });
    }

    it('no activa poder si no hay mana suficiente', () => {
        const difficulty = new Difficulty(1);
        const player     = makeMockPlayer(10);
        const powers     = new Powers(makeMockScene(), player, makeMockBalls(), difficulty);
        const result     = powers.activateViento({ distanceTo: () => 0 });
        expect(result).toBe(false);
        expect(player.mana).toBe(10);
    });
});

const mockVec = { x:0,y:0,z:0, clone(){ return this; }, normalize(){ return this; }, multiplyScalar(){ return this; }, subVectors(){ return this; }, distanceTo(){ return 0; } };

describe('Powers — efectos visuales: se añaden a la escena', () => {
    it('activateEscudo añade la columna de escudo', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateEscudo(mockVec, mockVec);
        expect(scene.added.length).toBe(1);
    });

    it('activateSismico añade un anillo de onda', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateSismico(mockVec);
        expect(scene.added.length).toBe(1);
    });

    it('activateLlama añade un rayo (beam)', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateLlama(mockVec, mockVec);
        expect(scene.added.length).toBe(1);
    });

    it('activateViento añade una onda esférica', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateViento(mockVec);
        expect(scene.added.length).toBe(1);
    });

    it('no añade nada si no hay mana', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(0), makeMockBalls(), new Difficulty(1));
        powers.activateEscudo(mockVec, mockVec);
        powers.activateSismico(mockVec);
        powers.activateLlama(mockVec, mockVec);
        powers.activateViento(mockVec);
        expect(scene.added.length).toBe(0);
    });
});

describe('Powers — efectos visuales: ciclo de vida', () => {
    it('los efectos se eliminan de la escena al expirar', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateEscudo(mockVec, mockVec);
        expect(scene.added.length).toBe(1);
        // Avanzar suficiente tiempo para que expiren (life=1.0, rate=0.5 → 2s).
        powers.update(2.5);
        expect(scene.added.length).toBe(0);
    });

    it('los efectos fade reducen opacidad con el tiempo', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateEscudo(mockVec, mockVec);
        const opacidadInicial = powers._effects[0].mesh.material.opacity;
        powers.update(0.3);
        const opacidadDespues = powers._effects[0].mesh.material.opacity;
        expect(opacidadDespues).toBeLessThan(opacidadInicial);
    });

    it('los efectos expand crecen de escala con el tiempo', () => {
        const scene  = makeMockScene();
        const powers = new Powers(scene, makeMockPlayer(), makeMockBalls(), new Difficulty(1));
        powers.activateSismico(mockVec);
        const escalaInicial = powers._effects[0].scale;
        powers.update(0.1);
        expect(powers._effects[0].scale).toBeGreaterThan(escalaInicial);
    });
});
