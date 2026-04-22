// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';

const _fakeCtx = {
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
    fillText(){}, fillRect(){},
    createRadialGradient(){ return { addColorStop(){} }; },
};
const _fakeCanvas = { width:0, height:0, getContext(){ return _fakeCtx; } };
beforeAll(() => {
    vi.spyOn(document, 'createElement').mockImplementation((tag) =>
        tag === 'canvas' ? _fakeCanvas : document.createElement(tag)
    );
});

vi.mock('three', () => ({
    TorusGeometry: class { dispose() {} },
    MeshBasicMaterial: class {
        constructor() { this.opacity = 0.9; }
        dispose() {}
    },
    Mesh: class {
        constructor() {
            this.position = { copy() {}, y: 0 };
            this.rotation = { x: 0 };
            this.scale    = { setScalar(v) { this._s = v; } };
            this.material = { opacity: 0.9, dispose() {} };
            this.geometry = { dispose() {} };
        }
    },
    CanvasTexture: class { dispose() {} },
    SpriteMaterial: class { constructor() { this.opacity = 1; this.map = { dispose(){} }; } dispose() {} },
    Sprite: class {
        constructor() {
            this.position = {
                x: 0, y: 0, z: 0,
                set(x, y, z) { this.x = x; this.y = y; this.z = z; },
                copy(v)      { this.x = v.x; this.y = v.y; this.z = v.z; },
            };
            this.scale    = { set(){} };
            this.material = { opacity: 1, map: { dispose(){} }, dispose(){} };
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

const pos = { x: 0, y: 1.6, z: 0, copy() {} };

describe('PlayerFeedback — spawn', () => {
    it('añade un anillo a la escena al hacer spawn', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red', pos);
        expect(scene.added.length).toBe(1);
    });

    it('con texto añade halo + sprite (2 objetos)', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red', pos, '♥ 3');
        expect(scene.added.length).toBe(2);
    });

    it('sin texto solo añade el halo (1 objeto)', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('blue', pos);
        expect(scene.added.length).toBe(1);
    });

    it('cada spawn añade un efecto independiente', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red',   pos, '♥ 3');
        fb.spawn('blue',  pos, 'x2');
        fb.spawn('green', pos, '+♥');
        expect(fb._effects.length).toBe(3);
    });

    it('acepta tipos red, blue y green sin errores', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        expect(() => fb.spawn('red',   pos, '♥ 3')).not.toThrow();
        expect(() => fb.spawn('blue',  pos, 'x4' )).not.toThrow();
        expect(() => fb.spawn('green', pos, '+♥' )).not.toThrow();
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
        fb.update(2.0);
        expect(scene.added.length).toBe(0);
        expect(fb._effects.length).toBe(0);
    });

    it('el sprite de texto también se elimina al expirar', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('red', pos, '♥ 2');
        expect(scene.added.length).toBe(2);
        fb.update(2.0);
        expect(scene.added.length).toBe(0);
    });

    it('el sprite flota hacia arriba con el tiempo', () => {
        const scene = makeScene();
        const fb    = new PlayerFeedback(scene);
        fb.spawn('blue', pos, 'x3');
        const yInicial = fb._effects[0].sprite.position.y;
        fb.update(0.2);
        expect(fb._effects[0].sprite.position.y).toBeGreaterThan(yInicial);
    });
});
