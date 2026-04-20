import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
    class Vector3 {
        constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
        copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this; }
        clone() { return new Vector3(this.x,this.y,this.z); }
        set(x,y,z) { this.x=x; this.y=y; this.z=z; return this; }
        distanceTo(v) { return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z); }
        setFromMatrixPosition(m) { this.x=m.x||0; this.y=m.y||0; this.z=m.z||0; return this; }
        subVectors(a,b) { this.x=a.x-b.x; this.y=a.y-b.y; this.z=a.z-b.z; return this; }
        normalize() { return this; }
        multiplyScalar() { return this; }
        add() { return this; }
    }
    return {
        Vector3,
        MathUtils: { lerp:(a,b,t)=>a+(b-a)*t, degToRad:(d)=>d*Math.PI/180 },
        SphereGeometry:       class { dispose(){} },
        MeshStandardMaterial: class { dispose(){} constructor(){ this.emissive={multiplyScalar(){},setHex(){}}; this.emissiveIntensity=0.2; } },
        Mesh: class {
            constructor(geo, mat) {
                this.position = new Vector3();
                this.castShadow = false;
                this.rotation = {};
                this.material = mat || { emissive: { multiplyScalar(){}, setHex(){} }, emissiveIntensity: 0.2 };
                this.geometry = geo || { dispose(){} };
            }
        },
        Color: class { multiplyScalar(){ return this; } },
    };
});

vi.mock('../js/scene.js', () => ({ BOUNDS: { x:3.5, yMin:0.3, yMax:4.5, z:3.5 } }));

const { CollisionSystem } = await import('../js/collision.js');
const { BallManager }     = await import('../js/objects.js');
const { Difficulty }      = await import('../js/difficulty.js');

function makeScene()  { return { add(){}, remove(){} }; }
function makePlayer() { return { vida:5, maxVida:5 }; }

function makeGreenBallAt(x, y, z) {
    const config = { balls: { red:{speed:0.015}, blue:{speed:0.012}, green:{speed:0.010}, orange:{speed:0.008,pattern:'straight'} } };
    const bm = new BallManager(makeScene(), config, new Difficulty(1));
    const playerPos = { x:0, y:1.6, z:0 };
    const ball = bm.spawn('green', playerPos);
    ball.mesh.position.set(x, y, z);
    return { bm, ball };
}

function makeCtrlAt(x, y, z) {
    const pos = { x, y, z };
    return {
        getWorldPosition(v) { v.x=x; v.y=y; v.z=z; },
        matrixWorld: pos,
        _pos: pos,
    };
}

describe('Bola verde — agarrar con grip', () => {
    it('se marca como grabbed al tocarla con grip pulsado', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.mesh.position.set(0, 1.2, 0);

        const collision = new CollisionSystem(makePlayer(), bm);
        let grabbed = false;
        collision.onGreenGrabbed = () => { grabbed = true; };

        const c1 = makeCtrlAt(0, 1.2, 0); // mismo lugar que la bola
        const c2 = makeCtrlAt(1, 1.2, 0); // lejos
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };

        collision.update(c1, c2, cam, true, false); // held1=true
        expect(grabbed).toBe(true);
        expect(ball.grabbed).toBe(true);
    });

    it('NO se agarra si el grip no está pulsado', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        let grabbed = false;
        collision.onGreenGrabbed = () => { grabbed = true; };

        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(1, 1.2, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };

        collision.update(c1, c2, cam, false, false); // held=false
        expect(grabbed).toBe(false);
        expect(ball.grabbed).toBe(false);
    });

    it('una bola ya agarrada no se agarra dos veces', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        let count = 0;
        collision.onGreenGrabbed = () => { count++; };

        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(1, 1.2, 0);
        const cam = { matrixWorld: { x:0, y:1.6, z:0 } };

        collision.update(c1, c2, cam, true, false);
        collision.update(c1, c2, cam, true, false);
        expect(count).toBe(1);
    });
});

describe('Bola verde — seguir al mando', () => {
    it('la bola sigue la posición del mando mientras está agarrada', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball.ctrlPos = { x: 0.5, y: 1.8, z: 0 };

        bm._moveBall(ball, 0.016, { x:0, y:1.6, z:0 });

        expect(ball.mesh.position.x).toBeCloseTo(0.5);
        expect(ball.mesh.position.y).toBeCloseTo(1.8);
    });

    it('la bola no se mueve sola si está agarrada', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball.ctrlPos = { x: 0, y: 1.6, z: 0 };
        const yAntes = ball.mesh.position.y;

        bm._moveBall(ball, 0.016, { x:0, y:1.6, z:0 });

        expect(ball.mesh.position.y).toBe(1.6); // sigue al ctrl, no su velocidad
    });
});

describe('Bola verde — halo de ayuda nivel 1', () => {
    function makeVec(x, y, z) {
        return { x, y, z, distanceTo(v) { return Math.hypot(x-v.x, y-v.y, z-v.z); } };
    }

    it('activa el emissive cuando el mando está en rango (nivel 1)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        bm.updateGreenHints(1, makeVec(0, 1.2, 0), makeVec(2, 0, 0));
        expect(hexValues[0]).toBe(0x88ffaa);
    });

    it('no activa el emissive si el mando está lejos', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        bm.updateGreenHints(1, makeVec(5, 0, 0), makeVec(5, 0, 0));
        expect(hexValues[0]).toBe(0x000000);
    });

    it('no activa el emissive en nivel > 1 aunque esté cerca', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        bm.updateGreenHints(2, makeVec(0, 1.2, 0), makeVec(0, 1.2, 0));
        expect(hexValues[0]).toBe(0x000000);
    });
});
