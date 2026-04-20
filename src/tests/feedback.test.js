import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    TorusGeometry: class { dispose() {} },
    MeshBasicMaterial: class {
        constructor() { this.opacity = 0.9; }
        dispose() {}
    },
    Mesh: class {
        constructor() {
            this.position = { copy() {} };
            this.rotation = { x: 0 };
            this.scale    = { setScalar(v) { this._s = v; } };
            this.material = { opacity: 0.9, dispose() {} };
            this.geometry = { dispose() {} };
        }
    },
    DoubleSide: 1,
}));

const { PlayerFeedback } = await import('../js/feedback.js');

function makeScene() {
    const added = [], removed = [];
    return {
        added, removed,
        add(o)    { added.push(o); },
        remove(o) { removed.push(o); added.splice(added.indexOf(o), 1); },
    };
}

const pos = { copy() {} };

describe('PlayerFeedback — spawn', () => {
    it('añade un anillo a la escena al hacer spawn', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red', pos);
        expect(scene.added.length).toBe(1);
    });

    it('cada spawn añade un efecto independiente', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red',   pos);
        fb.spawn('blue',  pos);
        fb.spawn('green', pos);
        expect(scene.added.length).toBe(3);
        expect(fb._effects.length).toBe(3);
    });

    it('acepta tipos red, blue y green sin errores', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        expect(() => fb.spawn('red',   pos)).not.toThrow();
        expect(() => fb.spawn('blue',  pos)).not.toThrow();
        expect(() => fb.spawn('green', pos)).not.toThrow();
    });
});

describe('PlayerFeedback — update / ciclo de vida', () => {
    it('el efecto se expande (scale crece) con el tiempo', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red', pos);
        const escalaInicial = fb._effects[0].scale;
        fb.update(0.1);
        expect(fb._effects[0].scale).toBeGreaterThan(escalaInicial);
    });

    it('la opacidad disminuye con el tiempo', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('blue', pos);
        const opInicial = fb._effects[0].mesh.material.opacity;
        fb.update(0.2);
        expect(fb._effects[0].mesh.material.opacity).toBeLessThan(opInicial);
    });

    it('el efecto se elimina de la escena al expirar', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('green', pos);
        expect(scene.added.length).toBe(1);
        fb.update(2.0); // suficiente para que expire (life=1, baja a 2.5*delta)
        expect(scene.added.length).toBe(0);
        expect(fb._effects.length).toBe(0);
    });
});
