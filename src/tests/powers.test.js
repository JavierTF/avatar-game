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
            this.position = { copy(){ return self.position; }, addScaledVector(){ return self.position; } };
            this.rotation = { x: 0 };
            this.material = { opacity: 1, dispose(){} };
            this.geometry = { dispose(){} };
            this.quaternion = { setFromUnitVectors(){} };
            this.scale = { setScalar(){} };
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
    return { add() {}, remove() {} };
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
            if (poder === 'escudo')  powers.activateEscudo({ distanceTo: () => 0 }, { distanceTo: () => 0 });
            if (poder === 'sismico') powers.activateSismico({ distanceTo: () => 0 });
            const mockVec = { x:0,y:0,z:0, clone(){ return this; }, normalize(){ return this; }, multiplyScalar(){ return this; }, subVectors(){ return this; }, distanceTo(){ return 0; } };
        if (poder === 'llama')   powers.activateLlama(mockVec, mockVec);
            if (poder === 'viento')  powers.activateViento({ distanceTo: () => 0 });

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
