import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
    class Vector3 {
        constructor(x=0, y=0, z=0) { this.x=x; this.y=y; this.z=z; }
        copy(v)           { this.x=v.x; this.y=v.y; this.z=v.z; return this; }
        clone()           { return new Vector3(this.x, this.y, this.z); }
        set(x, y, z)      { this.x=x; this.y=y; this.z=z; return this; }
        distanceTo(v)     { return Math.hypot(this.x-v.x, this.y-v.y, this.z-v.z); }
        setFromMatrixPosition(m) { this.x=m.x||0; this.y=m.y||0; this.z=m.z||0; return this; }
        subVectors(a, b)  { this.x=a.x-b.x; this.y=a.y-b.y; this.z=a.z-b.z; return this; }
        normalize() {
            const l = Math.hypot(this.x, this.y, this.z) || 1;
            this.x /= l; this.y /= l; this.z /= l;
            return this;
        }
        multiplyScalar(s) { this.x*=s; this.y*=s; this.z*=s; return this; }
        add(v)            { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }
    }
    return {
        Vector3,
        MathUtils: { lerp:(a,b,t)=>a+(b-a)*t, degToRad:(d)=>d*Math.PI/180 },
        SphereGeometry:       class { dispose(){} },
        MeshStandardMaterial: class { dispose(){} constructor(){ this.emissive={multiplyScalar(){},setHex(){}}; this.emissiveIntensity=0.2; } },
        Mesh: class {
            constructor(geo, mat) {
                this.position   = new Vector3();
                this.castShadow = false;
                this.rotation   = {};
                this.material   = mat || { emissive: { multiplyScalar(){}, setHex(){} }, emissiveIntensity: 0.2 };
                this.geometry   = geo || { dispose(){} };
            }
        },
        Color: class { multiplyScalar(){ return this; } },
    };
});

vi.mock('../js/scene.js', () => ({ BOUNDS: { x:3.5, yMin:0.3, yMax:4.5, z:3.5 } }));

const { CollisionSystem } = await import('../js/collision.js');
const { BallManager }     = await import('../js/objects.js');
const { Difficulty }      = await import('../js/collision.js').then(() => import('../js/difficulty.js'));

function makeScene()  { return { add(){}, remove(){} }; }
function makePlayer() { return { vida:5, maxVida:5 }; }

function makeOrangeBallAt(x, y, z) {
    const config = { balls: { red:{speed:0.015}, blue:{speed:0.012}, green:{speed:0.010}, orange:{speed:0.008, pattern:'straight', effect:'heal'} } };
    const bm = new BallManager(makeScene(), config, new Difficulty(1));
    const ball = bm.spawn('orange', { x:0, y:1.6, z:0 });
    ball.mesh.position.set(x, y, z);
    return { bm, ball };
}

function makeCtrlAt(x, y, z) {
    const pos = { x, y, z };
    return {
        getWorldPosition(v) { v.x = x; v.y = y; v.z = z; },
        matrixWorld: pos,
    };
}

describe('Bola naranja — rebote y callback', () => {
    it('al golpearla dispara onOrangeHit con (effect, hitPos)', () => {
        const { bm, ball } = makeOrangeBallAt(0, 1.2, 0);
        ball.effect = 'heal';

        const collision = new CollisionSystem(makePlayer(), bm);
        let calledEffect, calledPos;
        collision.onOrangeHit = (effect, hitPos) => {
            calledEffect = effect;
            calledPos    = hitPos;
        };

        const c1  = makeCtrlAt(0, 1.2, 0);
        const c2  = makeCtrlAt(5, 0, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };
        collision.update(c1, c2, cam, false, false);

        expect(calledEffect).toBe('heal');
        expect(calledPos).toBeDefined();
        expect(calledPos.x).toBe(0);
        expect(calledPos.y).toBe(1.2);
    });

    it('marca la bola como _bounced=true', () => {
        const { bm, ball } = makeOrangeBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        collision.onOrangeHit = () => {};
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };
        collision.update(c1, c2, cam, false, false);
        expect(ball._bounced).toBe(true);
    });

    it('una bola ya rebotada NO vuelve a disparar onOrangeHit', () => {
        const { bm, ball } = makeOrangeBallAt(0, 1.2, 0);
        ball._bounced = true;
        const collision = new CollisionSystem(makePlayer(), bm);
        let called = 0;
        collision.onOrangeHit = () => { called++; };
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };
        collision.update(c1, c2, cam, false, false);
        expect(called).toBe(0);
    });

    it('usa ball.effect (aleatorio) antes que ball.cfg.effect', () => {
        const { bm, ball } = makeOrangeBallAt(0, 1.2, 0);
        ball.effect = 'slow';          // efecto aleatorio asignado al spawnear
        ball.cfg    = { effect: 'heal' }; // fallback del config distinto
        const collision = new CollisionSystem(makePlayer(), bm);
        let calledEffect;
        collision.onOrangeHit = (effect) => { calledEffect = effect; };
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };
        collision.update(c1, c2, cam, false, false);
        expect(calledEffect).toBe('slow');
    });

    it('cae al cfg.effect si ball.effect es falsy', () => {
        const { bm, ball } = makeOrangeBallAt(0, 1.2, 0);
        ball.effect = undefined;
        ball.cfg    = { effect: 'points' };
        const collision = new CollisionSystem(makePlayer(), bm);
        let calledEffect;
        collision.onOrangeHit = (effect) => { calledEffect = effect; };
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };
        collision.update(c1, c2, cam, false, false);
        expect(calledEffect).toBe('points');
    });

    it('tras el rebote, la velocidad apunta en la dirección contraria al mando', () => {
        // Mando desde abajo-izquierda → la bola debe ir hacia arriba-derecha.
        const { bm, ball } = makeOrangeBallAt(1, 1.5, 0);  // bola arriba-derecha
        const collision = new CollisionSystem(makePlayer(), bm);
        collision.onOrangeHit = () => {};
        const c1 = makeCtrlAt(1, 1.5, 0);   // mismo sitio que la bola para triggerear
        const c2 = makeCtrlAt(5, 0, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };

        // Colocamos el mando justo abajo-izquierda de la bola (dentro del
        // radio de colisión BALL_R+CTRL_R ≈ 0.23).
        c1.getWorldPosition = (v) => { v.x = 0.95; v.y = 1.45; v.z = 0; };
        collision.update(c1, c2, cam, false, false);

        // bounceDir = ball - ctrl = (0.05, 0.05, 0) → x>0, y>0
        expect(ball.velocity.x).toBeGreaterThan(0);
        expect(ball.velocity.y).toBeGreaterThan(0);
    });
});
