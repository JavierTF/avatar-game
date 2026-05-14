import { describe, it, expect, vi } from 'vitest';

vi.mock('three', async () => await import('./_three-mock.js'));
vi.mock('./scene.js',    () => ({ BOUNDS: { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 } }));
vi.mock('../js/scene.js',() => ({ BOUNDS: { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 } }));

const { BallManager, ORANGE_GRAB_R } = await import('../js/objects.js');
const { Difficulty }                 = await import('../js/difficulty.js');

function makeMgr() {
    const scene  = { add() {}, remove() {} };
    const config = { balls: {
        red:    { speed: 0.008, pattern: 'homing' },
        blue:   { speed: 0.012 },
        orange: { speed: 0.010, pattern: 'straight' },
    }};
    return new BallManager(scene, config, new Difficulty(1));
}

function makeCtrlAt(x, y, z) {
    return { getWorldPosition(v) { v.x = x; v.y = y; v.z = z; } };
}

function makeOrangeAt(mgr, x, y, z) {
    const ball = mgr.spawn('orange', { x: 0, y: 1.6, z: 0 });
    ball.mesh.position.x = x;
    ball.mesh.position.y = y;
    ball.mesh.position.z = z;
    ball.velocity.set(0, 0, 0);
    return ball;
}

describe('ORANGE_GRAB_R — radio de agarre exportado', () => {
    it('está definido y es positivo', () => {
        expect(typeof ORANGE_GRAB_R).toBe('number');
        expect(ORANGE_GRAB_R).toBeGreaterThan(0);
    });
});

describe('BallManager.tryGrabOrange — agarre inmediato', () => {
    it('agarra una naranja en rango y devuelve la bola', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        const ctrl = makeCtrlAt(0, 1.2, 0);
        const g = m.tryGrabOrange(ctrl, 1, false);
        expect(g).toBe(b);
        expect(b.grabbed).toBe(true);
        expect(b.ctrlPos).toBeTruthy();
    });

    it('NO agarra si está fuera del rango', () => {
        const m = makeMgr();
        makeOrangeAt(m, 5, 1.2, 0);                 // lejos
        const ctrl = makeCtrlAt(0, 1.2, 0);
        expect(m.tryGrabOrange(ctrl, 1, false)).toBeNull();
    });

    it('NO agarra si el mando ya tiene una bola (alreadyGrabbed=true)', () => {
        const m = makeMgr();
        makeOrangeAt(m, 0, 1.2, 0);
        const ctrl = makeCtrlAt(0, 1.2, 0);
        expect(m.tryGrabOrange(ctrl, 1, true)).toBeNull();
    });

    it('NO agarra rojas ni azules aunque estén en rango', () => {
        const m = makeMgr();
        const r = m.spawn('red', { x:0, y:1.6, z:0 });
        r.mesh.position.set(0, 1.2, 0); r.velocity.set(0,0,0);
        const b = m.spawn('blue', { x:0, y:1.6, z:0 });
        b.mesh.position.set(0, 1.2, 0); b.velocity.set(0,0,0);
        const ctrl = makeCtrlAt(0, 1.2, 0);
        expect(m.tryGrabOrange(ctrl, 1, false)).toBeNull();
    });

    it('strict < ORANGE_GRAB_R: distancia exacta NO agarra', () => {
        const m = makeMgr();
        makeOrangeAt(m, 0, 1.2, 0);
        const ctrl = makeCtrlAt(ORANGE_GRAB_R, 1.2, 0);   // dist == R
        expect(m.tryGrabOrange(ctrl, 1, false)).toBeNull();
    });

    it('estado tras grab: la bola se pega al mando (position == ctrlPos)', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        const ctrl = makeCtrlAt(0.1, 1.3, -0.1);
        m.tryGrabOrange(ctrl, 1, false);
        expect(b.mesh.position.x).toBe(0.1);
        expect(b.mesh.position.y).toBe(1.3);
        expect(b.mesh.position.z).toBe(-0.1);
    });
});

describe('BallManager — drag de naranja agarrada', () => {
    it('una bola agarrada sigue al mando (ctrlPos) en _moveBall', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        b.grabbed = true;
        b.ctrlPos = { x: 0.5, y: 1.6, z: -0.3 };
        m._moveBall(b, 0.016, { x:0, y:1.6, z:0 });
        expect(b.mesh.position.x).toBe(0.5);
        expect(b.mesh.position.y).toBe(1.6);
        expect(b.mesh.position.z).toBe(-0.3);
    });

    it('una bola naranja agarrada NO se elimina aunque esté detrás del jugador', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 2.0);   // detrás
        b.grabbed = true;
        b.ctrlPos = { x: 0, y: 1.2, z: 2.0 };
        m.update(0.016, { x: 0, y: 1.6, z: 0 });
        expect(m.balls.length).toBe(1);
    });
});

describe('BallManager.updateOrangeHints — emisivo según proximidad', () => {
    function makeVec(x, y, z) { return { distanceTo(v) { return Math.hypot(x-v.x, y-v.y, z-v.z); } }; }

    it('encendido cuando un mando está dentro del rango', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        let hex = null;
        b.mesh.material.emissive.setHex = (h) => { hex = h; };
        m.updateOrangeHints({ x:0, y:1.2, z:0 }, { x:5, y:5, z:5 });
        expect(hex).not.toBe(0x000000);
    });

    it('apagado cuando ningún mando está cerca', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        let hex = null;
        b.mesh.material.emissive.setHex = (h) => { hex = h; };
        m.updateOrangeHints({ x:5, y:5, z:5 }, { x:5, y:5, z:5 });
        expect(hex).toBe(0x000000);
    });

    it('apagado si la bola ya está agarrada', () => {
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        b.grabbed = true;
        let hex = null;
        b.mesh.material.emissive.setHex = (h) => { hex = h; };
        m.updateOrangeHints({ x:0, y:1.2, z:0 }, { x:5, y:5, z:5 });
        expect(hex).toBe(0x000000);
    });

    it('no toca el material de las rojas/azules', () => {
        const m = makeMgr();
        const r = m.spawn('red', { x:0, y:1.6, z:0 });
        r.mesh.position.set(0, 1.2, 0);
        let touched = false;
        r.mesh.material.emissive.setHex = () => { touched = true; };
        m.updateOrangeHints({ x:0, y:1.2, z:0 }, { x:5, y:5, z:5 });
        expect(touched).toBe(false);
    });
});

describe('CollisionSystem — detección de agarre naranja vía evento', () => {
    it('collision dispara onOrangeGrabbed cuando un mando con held está en rango', async () => {
        const { CollisionSystem } = await import('../js/collision.js');
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        const collision = new CollisionSystem({}, m);
        const grabs = [];
        collision.onOrangeGrabbed = (ball, idx) => grabs.push({ ball, idx });
        const c1 = { getWorldPosition(v) { v.x = 0; v.y = 1.2; v.z = 0; } };
        const c2 = { getWorldPosition(v) { v.x = 5; v.y = 5; v.z = 5; } };
        const camera = { matrixWorld: { x: 0, y: 1.6, z: 0 } };
        collision.update(c1, c2, camera, /*held1*/true, /*held2*/false);
        expect(grabs).toHaveLength(1);
        expect(grabs[0].ball).toBe(b);
        expect(grabs[0].idx).toBe(1);
    });

    it('NO dispara si el mando no tiene gatillo pulsado', async () => {
        const { CollisionSystem } = await import('../js/collision.js');
        const m = makeMgr();
        makeOrangeAt(m, 0, 1.2, 0);
        const collision = new CollisionSystem({}, m);
        let fired = false;
        collision.onOrangeGrabbed = () => { fired = true; };
        const c1 = { getWorldPosition(v) { v.x = 0; v.y = 1.2; v.z = 0; } };
        const c2 = { getWorldPosition(v) { v.x = 5; v.y = 5; v.z = 5; } };
        const camera = { matrixWorld: { x: 0, y: 1.6, z: 0 } };
        collision.update(c1, c2, camera, false, false);
        expect(fired).toBe(false);
    });

    it('NO dispara para una bola ya agarrada', async () => {
        const { CollisionSystem } = await import('../js/collision.js');
        const m = makeMgr();
        const b = makeOrangeAt(m, 0, 1.2, 0);
        b.grabbed = true;
        const collision = new CollisionSystem({}, m);
        let fired = false;
        collision.onOrangeGrabbed = () => { fired = true; };
        const c1 = { getWorldPosition(v) { v.x = 0; v.y = 1.2; v.z = 0; } };
        const c2 = { getWorldPosition(v) { v.x = 5; v.y = 5; v.z = 5; } };
        const camera = { matrixWorld: { x: 0, y: 1.6, z: 0 } };
        collision.update(c1, c2, camera, true, true);
        expect(fired).toBe(false);
    });

    it('una bola roja en rango sigue siendo letal — no la agarra', async () => {
        const { CollisionSystem } = await import('../js/collision.js');
        const m = makeMgr();
        const r = m.spawn('red', { x:0, y:1.6, z:0 });
        r.mesh.position.set(0, 1.2, 0); r.velocity.set(0,0,0);
        const collision = new CollisionSystem({}, m);
        let redHits = 0;
        collision.onRedHit = () => { redHits++; };
        const c1 = { getWorldPosition(v) { v.x = 0; v.y = 1.2; v.z = 0; } };
        const c2 = { getWorldPosition(v) { v.x = 5; v.y = 5; v.z = 5; } };
        const camera = { matrixWorld: { x: 0, y: 1.6, z: 0 } };
        collision.update(c1, c2, camera, true, false);
        expect(redHits).toBe(1);
    });
});
