import { describe, it, expect, vi } from 'vitest';

vi.mock('three', async () => await import('./_three-mock.js'));

vi.mock('../js/scene.js', () => ({ BOUNDS: { x:3.5, yMin:0.3, yMax:4.5, z:3.5 } }));

const { CollisionSystem } = await import('../js/collision.js');
const { BallManager, GREEN_GRAB_R } = await import('../js/objects.js');
const { Difficulty }      = await import('../js/difficulty.js');

const STD_CONFIG = {
    balls: {
        red:   { speed: 0.008, pattern: 'homing' },
        blue:  { speed: 0.012 },
        green: { speed: 0.010 },
    },
};

function makeScene()  { return { add(){}, remove(){} }; }
function makePlayer() { return { vida:5, maxVida:5 }; }

function makeGreenBallAt(x, y, z) {
    const config = { balls: { red:{speed:0.008,pattern:'homing'}, blue:{speed:0.012}, green:{speed:0.010} } };
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

describe('Bola verde — agarre con cualquier orden de gatillo y cercanía', () => {
    it('apretar gatillo primero y luego acercar el mando: se agarra al entrar en rango', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

        // Frame 1: gatillo apretado pero mando lejos (>0.45m). NO se agarra.
        const c1Far = makeCtrlAt(2, 1.2, 0);
        const c2    = makeCtrlAt(5, 0, 0);
        collision.update(c1Far, c2, cam, true, false);
        expect(ball.grabbed).toBe(false);

        // Frame 2: el mismo gatillo sigue apretado, ahora el mando se acerca.
        // En el primer tick dentro del rango, la bola se agarra.
        const c1Near = makeCtrlAt(0, 1.2, 0);
        collision.update(c1Near, c2, cam, true, false);
        expect(ball.grabbed).toBe(true);
    });

    it('acercar el mando primero y luego apretar el gatillo: se agarra al apretar', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

        // Frame 1: mando ya cerca pero gatillo SUELTO. NO se agarra.
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);
        collision.update(c1, c2, cam, false, false);
        expect(ball.grabbed).toBe(false);

        // Frame 2: el mando sigue cerca, ahora apretamos el gatillo. Se agarra.
        collision.update(c1, c2, cam, true, false);
        expect(ball.grabbed).toBe(true);
    });

    it('mando lejos con gatillo apretado durante varios frames: nunca se agarra', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

        const c1 = makeCtrlAt(2, 1.2, 0);   // distancia 2m, fuera del rango 0.45m
        const c2 = makeCtrlAt(5, 0, 0);
        for (let i = 0; i < 5; i++) {
            collision.update(c1, c2, cam, true, true);
        }
        expect(ball.grabbed).toBe(false);
        expect(ball.ctrlPos).toBe(null);
    });

    it('mando cerca pero ningún gatillo apretado durante varios frames: nunca se agarra', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(0.1, 1.2, 0);
        for (let i = 0; i < 5; i++) {
            collision.update(c1, c2, cam, false, false);
        }
        expect(ball.grabbed).toBe(false);
        expect(ball.ctrlPos).toBe(null);
    });

    it('cualquiera de los dos mandos puede ser el agarrador (c1 con held1, c2 con held2)', () => {
        // Caso A: sólo c1 cerca y sólo held1 → agarra c1.
        const { bm: bmA, ball: ballA } = makeGreenBallAt(0, 1.2, 0);
        const collA = new CollisionSystem(makePlayer(), bmA);
        let idxA = null;
        collA.onGreenGrabbed = (_, idx) => { idxA = idx; };
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };
        collA.update(makeCtrlAt(0, 1.2, 0), makeCtrlAt(5, 0, 0), cam, true, false);
        expect(ballA.grabbed).toBe(true);
        expect(idxA).toBe(1);

        // Caso B: sólo c2 cerca y sólo held2 → agarra c2.
        const { bm: bmB, ball: ballB } = makeGreenBallAt(0, 1.2, 0);
        const collB = new CollisionSystem(makePlayer(), bmB);
        let idxB = null;
        collB.onGreenGrabbed = (_, idx) => { idxB = idx; };
        collB.update(makeCtrlAt(5, 0, 0), makeCtrlAt(0, 1.2, 0), cam, false, true);
        expect(ballB.grabbed).toBe(true);
        expect(idxB).toBe(2);
    });

    it('al agarrar, la bola se teleporta exactamente a la posición del mando y guarda ctrlPos', () => {
        const { bm, ball } = makeGreenBallAt(0.7, 1.5, -0.3);  // bola separada del mando
        const collision = new CollisionSystem(makePlayer(), bm);
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

        // Mando en (0.5, 1.4, -0.2): a unos 0.27m de la bola, dentro del rango 0.45.
        const c1 = makeCtrlAt(0.5, 1.4, -0.2);
        const c2 = makeCtrlAt(5, 0, 0);
        collision.update(c1, c2, cam, true, false);

        expect(ball.grabbed).toBe(true);
        expect(ball.mesh.position.x).toBe(0.5);
        expect(ball.mesh.position.y).toBe(1.4);
        expect(ball.mesh.position.z).toBe(-0.2);
        expect(ball.ctrlPos.x).toBe(0.5);
        expect(ball.ctrlPos.y).toBe(1.4);
        expect(ball.ctrlPos.z).toBe(-0.2);
    });

    it('una bola convertida en muro (_wall) no se puede volver a agarrar', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball._wall = true;
        const collision = new CollisionSystem(makePlayer(), bm);
        const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

        collision.update(makeCtrlAt(0, 1.2, 0), makeCtrlAt(5, 0, 0), cam, true, true);
        expect(ball.grabbed).toBe(false);
    });
});

describe('Bola verde — sigue al mando exactamente mientras está agarrada', () => {
    it('la bola se teletransporta exactamente a ctrlPos en cada llamada de _moveBall', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const playerPos = { x: 0, y: 1.6, z: 0 };

        const trayectoria = [
            { x:  0.5, y: 1.6, z: -0.1 },
            { x: -0.3, y: 1.0, z: -0.5 },
            { x:  1.2, y: 1.8, z:  0.2 },
            { x:  0.0, y: 2.4, z: -1.5 },
            { x:  2.0, y: 0.5, z: -3.0 },  // mando muy lejos: la bola lo sigue igual
        ];

        for (const p of trayectoria) {
            ball.ctrlPos = p;
            bm._moveBall(ball, 0.016, playerPos);
            expect(ball.mesh.position.x).toBe(p.x);
            expect(ball.mesh.position.y).toBe(p.y);
            expect(ball.mesh.position.z).toBe(p.z);
        }
    });

    it('la velocidad propia de la bola se ignora por completo mientras está agarrada', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball.ctrlPos = { x: 0.5, y: 1.5, z: -0.2 };
        ball.velocity.set(99, -99, 99);  // velocidad absurda

        bm._moveBall(ball, 0.016, { x: 0, y: 1.6, z: 0 });

        // Acaba donde el mando, no donde la velocidad la habría llevado.
        expect(ball.mesh.position.x).toBe(0.5);
        expect(ball.mesh.position.y).toBe(1.5);
        expect(ball.mesh.position.z).toBe(-0.2);
    });

    it('grabbed=true con ctrlPos=null NO aplica velocity (queda quieta donde estaba)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball.ctrlPos = null;
        ball.mesh.position.set(0.4, 1.3, -0.1);
        // Velocidad NO-cero: si la rama "grabbed" no protege, la bola se moverá.
        ball.velocity.set(0.5, 0.5, 0.5);

        bm._moveBall(ball, 0.016, { x: 0, y: 1.6, z: 0 });

        // Estar agarrada IMPLICA no moverse, aunque ctrlPos haya quedado null
        // por algún glitch. La invariante grabbed=true ⇒ ball quieta debe
        // mantenerse independientemente de ctrlPos.
        expect(ball.mesh.position.x).toBe(0.4);
        expect(ball.mesh.position.y).toBe(1.3);
        expect(ball.mesh.position.z).toBe(-0.1);
    });

    it('un cambio de ctrlPos entre frames se refleja inmediatamente en la posición', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const playerPos = { x: 0, y: 1.6, z: 0 };

        ball.ctrlPos = { x: 0.1, y: 1.2, z: 0 };
        bm._moveBall(ball, 0.016, playerPos);
        expect(ball.mesh.position.x).toBe(0.1);

        // Mismo frame conceptual: el render loop reasigna ctrlPos antes de
        // llamar _moveBall, así que el siguiente _moveBall ve el nuevo valor.
        ball.ctrlPos = { x: -0.4, y: 1.2, z: 0 };
        bm._moveBall(ball, 0.016, playerPos);
        expect(ball.mesh.position.x).toBe(-0.4);
    });

    it('una bola agarrada con el mando detrás del jugador NO se elimina por la regla "behind"', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball.ctrlPos = { x: 0, y: 1.6, z: 1.5 };  // detrás del jugador (z > 0.5)
        ball.velocity.set(0, 0, 0);

        bm.update(0.016, { x: 0, y: 1.6, z: 0 });

        expect(bm.balls.length).toBe(1);
        expect(bm.balls[0].mesh.position.z).toBe(1.5);
    });
});

describe('Bola verde agarrada — robusta contra out-of-bounds', () => {
    it('una bola agarrada con position fuera de bounds NO se elimina (sigue al mando)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball.ctrlPos = { x: 10, y: 1.6, z: -10 };  // (10, ., -10) está fuera de bounds (BOUNDS.x=3.5+2=5.5)
        // Forzamos también la posición del mesh fuera de bounds (otra dimensión).
        ball.mesh.position.set(10, 8, -10);  // y=8 > BOUNDS.yMax (4.5) + 2 = 6.5
        ball.velocity.set(0, 0, 0);

        bm.update(0.016, { x: 0, y: 1.6, z: 0 });

        // No se elimina: queda viva porque está agarrada.
        expect(bm.balls.includes(ball)).toBe(true);
        expect(bm.balls.length).toBe(1);
    });

    it('bola NO agarrada con position fuera de bounds SÍ se elimina (no afecta el comportamiento normal)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = false;
        ball.mesh.position.set(0, 8, 0);  // fuera de bounds
        ball.velocity.set(0, 0, 0);

        bm.update(0.016, { x: 0, y: 1.6, z: 0 });

        expect(bm.balls.includes(ball)).toBe(false);
        expect(bm.balls.length).toBe(0);
    });
});

describe('Bola verde — tryGrabGreen (agarre inmediato en selectstart)', () => {
    const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

    it('agarra la verde más cercana en rango cuando alreadyGrabbed=false', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const ctrl = makeCtrlAt(0, 1.2, 0);

        const grabbed = bm.tryGrabGreen(ctrl, 1, false);

        expect(grabbed).toBe(ball);
        expect(ball.grabbed).toBe(true);
        expect(ball.ctrlPos.x).toBe(0);
        expect(ball.ctrlPos.y).toBe(1.2);
        expect(ball.ctrlPos.z).toBe(0);
        // Mesh teleportada al mando en el mismo evento.
        expect(ball.mesh.position.x).toBe(0);
        expect(ball.mesh.position.y).toBe(1.2);
        expect(ball.mesh.position.z).toBe(0);
    });

    it('NO agarra si alreadyGrabbed=true (mando ya ocupado)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const ctrl = makeCtrlAt(0, 1.2, 0);

        const grabbed = bm.tryGrabGreen(ctrl, 1, true);

        expect(grabbed).toBe(null);
        expect(ball.grabbed).toBe(false);
    });

    it('NO agarra si no hay verde en rango', () => {
        const { bm, ball } = makeGreenBallAt(2, 1.2, 0);  // lejos
        const ctrl = makeCtrlAt(0, 1.2, 0);

        const grabbed = bm.tryGrabGreen(ctrl, 1, false);

        expect(grabbed).toBe(null);
        expect(ball.grabbed).toBe(false);
    });

    it('skipea bolas ya agarradas y muros (busca la siguiente disponible)', () => {
        const { bm } = makeGreenBallAt(0, 1.2, 0);
        const ballA = bm.balls[0];
        ballA.grabbed = true;  // ya agarrada por el otro mando

        const ballB = bm.spawn('green', { x: 0, y: 1.6, z: 0 });
        ballB.mesh.position.set(0.1, 1.2, 0);  // también en rango

        const ctrl = makeCtrlAt(0, 1.2, 0);

        const grabbed = bm.tryGrabGreen(ctrl, 1, false);

        expect(grabbed).toBe(ballB);
        expect(ballB.grabbed).toBe(true);
        expect(ballA.grabbed).toBe(true);  // sigue siendo de otro
    });

    it('skipea bolas no verdes', () => {
        const { bm } = makeGreenBallAt(5, 5, 5);  // green lejos, fuera del rango
        const blue = bm.spawn('blue', { x: 0, y: 1.6, z: 0 });
        blue.mesh.position.set(0, 1.2, 0);  // en rango pero azul

        const ctrl = makeCtrlAt(0, 1.2, 0);

        const grabbed = bm.tryGrabGreen(ctrl, 1, false);

        expect(grabbed).toBe(null);
        expect(blue.grabbed).toBeFalsy();
    });
});

describe('Bola verde — un mando no agarra dos bolas a la vez', () => {
    const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

    it('mando con bola ya agarrada NO agarra una segunda bola en rango', () => {
        const { bm } = makeGreenBallAt(0, 1.2, 0);
        const ballA = bm.balls[0];
        ballA.grabbed = true;
        ballA.ctrlPos = { x: 0, y: 1.2, z: 0 };

        const ballB = bm.spawn('green', { x: 0, y: 1.6, z: 0 });
        ballB.mesh.position.set(0.1, 1.2, 0);  // dentro del rango del mando 1

        const collision = new CollisionSystem(makePlayer(), bm);
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);

        // Mando 1 ocupado: el sexto y séptimo argumento marcan ctrlXBusy.
        collision.update(c1, c2, cam, true, false, true, false);

        expect(ballB.grabbed).toBe(false);
        // ballA sigue siendo la única agarrada.
        expect(ballA.grabbed).toBe(true);
    });

    it('cada mando puede agarrar su propia bola simultáneamente (mandos independientes)', () => {
        const { bm } = makeGreenBallAt(-0.3, 1.2, 0);
        const ballA = bm.balls[0];
        const ballB = bm.spawn('green', { x: 0, y: 1.6, z: 0 });
        ballB.mesh.position.set(0.3, 1.2, 0);

        const collision = new CollisionSystem(makePlayer(), bm);
        const grabs = [];
        collision.onGreenGrabbed = (b, idx) => { grabs.push({ ball: b, idx }); };
        const c1 = makeCtrlAt(-0.3, 1.2, 0);
        const c2 = makeCtrlAt( 0.3, 1.2, 0);

        collision.update(c1, c2, cam, true, true, false, false);

        // Ambos mandos pudieron agarrar — no se solapan.
        expect(ballA.grabbed).toBe(true);
        expect(ballB.grabbed).toBe(true);
        const idxs = grabs.map(g => g.idx).sort();
        expect(idxs).toEqual([1, 2]);
    });

    it('si tras soltar (ctrl ya no busy) hay otra bola en rango, sí se agarra', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const c1 = makeCtrlAt(0, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);

        // ctrl1 NO ocupado (el jugador acaba de soltar la anterior).
        collision.update(c1, c2, cam, true, false, false, false);
        expect(ball.grabbed).toBe(true);
    });
});

describe('Bola verde — drop como muro tras agarrar', () => {
    // playerPos a {0, 1.6, 0}. Frontal positivo = z negativo (delante).
    const PLAYER = { x: 0, y: 1.6, z: 0 };

    it('mando bajo y delante de los pies del jugador: la bola queda como muro donde se soltó', () => {
        const { bm, ball } = makeGreenBallAt(0.5, 1.4, -0.2);  // estado tras agarrar
        ball.grabbed = true;
        ball.ctrlPos = { x: 0, y: 0.15, z: -1.0 };

        // Mando bajo (15cm) y delante (1m). Esto representa "a los pies, al frente".
        const dropPos = { x: 0, y: 0.15, z: -1.0 };

        const ok = bm.dropAsWall(ball, dropPos, PLAYER);

        expect(ok).toBe(true);
        // La bola se transforma en muro estático.
        expect(ball._wall).toBe(true);
        expect(ball.grabbed).toBe(false);
        expect(ball.ctrlPos).toBe(null);
        // Velocidad reseteada — no se mueve más.
        expect(ball.velocity.x).toBe(0);
        expect(ball.velocity.y).toBe(0);
        expect(ball.velocity.z).toBe(0);
        // Queda exactamente donde el jugador soltó el mando, en el suelo.
        expect(ball.mesh.position.x).toBe(0);
        expect(ball.mesh.position.y).toBe(0.15);
        expect(ball.mesh.position.z).toBe(-1.0);
        // Sigue formando parte del manager (no se elimina).
        expect(bm.balls.includes(ball)).toBe(true);
    });

    it('drop válido a distintos X (a izquierda, centro, derecha): la bola queda exactamente donde se soltó', () => {
        for (const x of [-1.5, -0.4, 0, 0.7, 1.8]) {
            const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
            ball.grabbed = true;
            const dropPos = { x, y: 0.2, z: -1.0 };
            const ok = bm.dropAsWall(ball, dropPos, PLAYER);
            expect(ok).toBe(true);
            expect(ball.mesh.position.x).toBe(x);
            expect(ball.mesh.position.y).toBe(0.2);
            expect(ball.mesh.position.z).toBe(-1.0);
        }
    });

    it('mando demasiado alto (y > 1.5m): la bola se descarta y desaparece del manager', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const dropPos = { x: 0, y: 1.8, z: -1.0 };  // 1.8m: por encima del techo de muro

        const ok = bm.dropAsWall(ball, dropPos, PLAYER);

        expect(ok).toBe(false);
        expect(ball._wall).toBeFalsy();
        expect(bm.balls.includes(ball)).toBe(false);
    });

    it('mando demasiado cerca del jugador (frontDist < 0.2m): la bola se descarta', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const dropPos = { x: 0, y: 0.2, z: -0.1 };  // sólo 0.1m delante: pegada a los pies

        const ok = bm.dropAsWall(ball, dropPos, PLAYER);

        expect(ok).toBe(false);
        expect(ball._wall).toBeFalsy();
        expect(bm.balls.includes(ball)).toBe(false);
    });

    it('mando detrás del jugador: la bola se descarta', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const dropPos = { x: 0, y: 0.2, z: 1.0 };  // z>0 con player en z=0 → detrás

        const ok = bm.dropAsWall(ball, dropPos, PLAYER);

        expect(ok).toBe(false);
        expect(bm.balls.includes(ball)).toBe(false);
    });

    it('justo en el límite y=1.5 y frontDist=0.2: válido (los límites son INclusivos)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const dropPos = { x: 0, y: 1.5, z: -0.2 };

        const ok = bm.dropAsWall(ball, dropPos, PLAYER);

        expect(ok).toBe(true);
        expect(ball._wall).toBe(true);
        expect(ball.mesh.position.y).toBe(1.5);
        expect(ball.mesh.position.z).toBe(-0.2);
    });

    it('dropAsWall lanza si la bola no está agarrada (contrato explícito)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        // ball.grabbed por defecto es false (recién spawneada).
        const drop = { x: 0, y: 0.2, z: -1.0 };
        expect(() => bm.dropAsWall(ball, drop, PLAYER)).toThrow();
        // El estado de la bola no cambia.
        expect(ball._wall).toBeFalsy();
        expect(bm.balls.includes(ball)).toBe(true);
    });

    it('dropAsWall lanza si la bola ya es muro (no se re-walla)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        ball._wall   = true;
        const drop = { x: 0, y: 0.2, z: -1.0 };
        expect(() => bm.dropAsWall(ball, drop, PLAYER)).toThrow();
    });

    it('un drop fallido NO toca el estado de las otras bolas', () => {
        const { bm, ball: bad } = makeGreenBallAt(0, 1.2, 0);
        bad.grabbed = true;
        const otherGreen = bm.spawn('green', PLAYER);
        const blue       = bm.spawn('blue', PLAYER);
        const lengthAntes = bm.balls.length;

        bm.dropAsWall(bad, { x: 0, y: 1.8, z: -1.0 }, PLAYER);  // alto → descarta

        expect(bm.balls.includes(bad)).toBe(false);
        expect(bm.balls.includes(otherGreen)).toBe(true);
        expect(bm.balls.includes(blue)).toBe(true);
        expect(bm.balls.length).toBe(lengthAntes - 1);
    });
});

describe('Bola verde — hint visual', () => {
    function makeVec(x, y, z) {
        return { x, y, z, distanceTo(v) { return Math.hypot(x-v.x, y-v.y, z-v.z); } };
    }

    it('activa el emissive cuando el mando está en rango', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        bm.updateGreenHints(makeVec(0, 1.2, 0), makeVec(2, 0, 0));
        expect(hexValues[0]).toBe(0x88ffaa);
    });

    it('no activa el emissive si el mando está lejos', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        bm.updateGreenHints(makeVec(5, 0, 0), makeVec(5, 0, 0));
        expect(hexValues[0]).toBe(0x000000);
    });

    it('al pasar de "near" a "agarrada" el emissive se apaga (no se queda glowing)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        // Frame 1: mando cerca → glow encendido.
        bm.updateGreenHints(makeVec(0, 1.2, 0), makeVec(5, 0, 0));
        expect(hexValues[hexValues.length - 1]).toBe(0x88ffaa);

        // Frame 2: la bola se agarra. El hint debe APAGAR el emissive,
        // no dejarla glowing como si siguiera siendo agarrable.
        ball.grabbed = true;
        bm.updateGreenHints(makeVec(0, 1.2, 0), makeVec(5, 0, 0));
        expect(hexValues[hexValues.length - 1]).toBe(0x000000);
        expect(ball.mesh.material.emissiveIntensity).toBe(0.2);
    });

    it('al pasar de "near" a "muro" el emissive se apaga (ladrillo no debe brillar)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const hexValues = [];
        ball.mesh.material.emissive.setHex = (v) => hexValues.push(v);

        bm.updateGreenHints(makeVec(0, 1.2, 0), makeVec(5, 0, 0));
        expect(hexValues[hexValues.length - 1]).toBe(0x88ffaa);

        ball._wall = true;
        bm.updateGreenHints(makeVec(0, 1.2, 0), makeVec(5, 0, 0));
        expect(hexValues[hexValues.length - 1]).toBe(0x000000);
        expect(ball.mesh.material.emissiveIntensity).toBe(0.2);
    });
});

// =============================================================================
// FLUJO RIGUROSO DE LA BOLA VERDE — battery completa de tests integrales.
// =============================================================================

describe('Bola verde — flujo completo end-to-end', () => {
    const PLAYER = { x: 0, y: 1.6, z: 0 };
    const cam    = { matrixWorld: { ...PLAYER } };

    it('spawn → grab → drag (4 puntos) → drop válido → permanece estática indefinidamente', () => {
        const bm = new BallManager(makeScene(), STD_CONFIG, new Difficulty(1));
        const collision = new CollisionSystem(makePlayer(), bm);

        // 1) SPAWN ─ estado inicial limpio
        const ball = bm.spawn('green', PLAYER);
        ball.mesh.position.set(0.3, 1.4, -0.5);
        expect(ball.grabbed).toBe(false);
        expect(ball._wall).toBeFalsy();
        expect(ball.ctrlPos).toBe(null);
        expect(ball.alive).toBe(true);
        expect(bm.balls.includes(ball)).toBe(true);

        // 2) GRAB ─ vía collision.update con mando en rango y gatillo apretado
        let grabbedCb = null;
        collision.onGreenGrabbed = (b, idx) => { grabbedCb = { b, idx }; };
        const c1 = makeCtrlAt(0.3, 1.4, -0.5);
        const c2 = makeCtrlAt(5, 0, 0);
        collision.update(c1, c2, cam, true, false, false, false);
        expect(ball.grabbed).toBe(true);
        expect(grabbedCb.b).toBe(ball);
        expect(grabbedCb.idx).toBe(1);

        // 3) DRAG ─ posición copia ctrlPos exacto en cada frame
        const path = [
            { x:  0.5, y: 1.6, z: -0.3 },
            { x:  0.0, y: 0.8, z: -0.7 },
            { x: -0.5, y: 0.4, z: -1.2 },
            { x:  0.7, y: 0.2, z: -1.0 },
        ];
        for (const p of path) {
            ball.ctrlPos = p;
            bm._moveBall(ball, 0.016, PLAYER);
            expect(ball.mesh.position.x).toBe(p.x);
            expect(ball.mesh.position.y).toBe(p.y);
            expect(ball.mesh.position.z).toBe(p.z);
        }

        // 4) DROP ─ mando bajo y delante → la bola se queda en el suelo
        const ok = bm.dropAsWall(ball, { x: 0.7, y: 0.2, z: -1.0 }, PLAYER);
        expect(ok).toBe(true);
        expect(ball._wall).toBe(true);
        expect(ball.grabbed).toBe(false);
        expect(ball.ctrlPos).toBe(null);
        expect(ball.velocity.x).toBe(0);
        expect(ball.velocity.y).toBe(0);
        expect(ball.velocity.z).toBe(0);

        // 5) PERSISTE ─ aunque pase mucho tiempo y haya rojas alrededor, la
        // bola dropeada permanece visible (sin destrucción por rojas).
        for (let i = 0; i < 20; i++) bm.update(0.016, PLAYER);
        const red = bm.spawn('red', PLAYER);
        red.mesh.position.set(0.7, 0.2, -1.0);  // sobre la verde
        bm.update(0.016, PLAYER);

        expect(bm.balls.includes(ball)).toBe(true);
        expect(ball._wall).toBe(true);
        expect(ball.mesh.position.x).toBe(0.7);
        expect(ball.mesh.position.y).toBe(0.2);
        expect(ball.mesh.position.z).toBe(-1.0);
    });

    it('spawn → grab → drop con mando alto → bola descartada', () => {
        const bm = new BallManager(makeScene(), STD_CONFIG, new Difficulty(1));
        const ball = bm.spawn('green', PLAYER);
        ball.mesh.position.set(0, 1.4, -0.5);
        ball.grabbed = true;
        ball.ctrlPos = { x: 0, y: 1.4, z: -0.5 };

        // Drop demasiado alto (y > 1.5) — bola se descarta
        const ok = bm.dropAsWall(ball, { x: 0, y: 1.8, z: -1.0 }, PLAYER);
        expect(ok).toBe(false);
        expect(ball._wall).toBeFalsy();
        expect(bm.balls.includes(ball)).toBe(false);
    });
});

describe('Bola verde — invariantes de cada estado', () => {
    const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

    it('estado SPAWN: type, grabbed=false, _wall=falsy, ctrlPos=null, alive=true, en bm.balls', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        expect(ball.type).toBe('green');
        expect(ball.grabbed).toBe(false);
        expect(ball._wall).toBeFalsy();
        expect(ball.ctrlPos).toBe(null);
        expect(ball.alive).toBe(true);
        expect(ball.mesh).toBeDefined();
        expect(ball.velocity).toBeDefined();
        expect(bm.balls.includes(ball)).toBe(true);
    });

    it('estado GRABBED: grabbed=true, _wall=falsy, ctrlPos no-null, en bm.balls', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        collision.update(makeCtrlAt(0, 1.2, 0), makeCtrlAt(5, 0, 0), cam, true, false);

        expect(ball.grabbed).toBe(true);
        expect(ball._wall).toBeFalsy();
        expect(ball.ctrlPos).not.toBe(null);
        expect(typeof ball.ctrlPos.x).toBe('number');
        expect(typeof ball.ctrlPos.y).toBe('number');
        expect(typeof ball.ctrlPos.z).toBe('number');
        expect(bm.balls.includes(ball)).toBe(true);
    });

    it('estado WALL: grabbed=false, _wall=true, ctrlPos=null, velocity=(0,0,0), en bm.balls', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        bm.dropAsWall(ball, { x: 0, y: 0.2, z: -1.0 }, { x: 0, y: 1.6, z: 0 });

        expect(ball.grabbed).toBe(false);
        expect(ball._wall).toBe(true);
        expect(ball.ctrlPos).toBe(null);
        expect(ball.velocity.x).toBe(0);
        expect(ball.velocity.y).toBe(0);
        expect(ball.velocity.z).toBe(0);
        expect(bm.balls.includes(ball)).toBe(true);
    });

    it('estado REMOVED: bola descartada por drop inválido — no en bm.balls', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const ok = bm.dropAsWall(ball, { x: 0, y: 2.5, z: -1.0 }, { x: 0, y: 1.6, z: 0 });

        expect(ok).toBe(false);
        expect(bm.balls.includes(ball)).toBe(false);
        expect(ball._wall).toBeFalsy();
    });
});

describe('Bola verde — boundaries estrictos del agarre (GREEN_GRAB_R)', () => {
    const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };

    it('collision.update: distancia EXACTAMENTE GREEN_GRAB_R → NO agarra (strict <)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const c1 = makeCtrlAt(GREEN_GRAB_R, 1.2, 0);  // distancia = exactamente 0.45
        const c2 = makeCtrlAt(5, 0, 0);
        collision.update(c1, c2, cam, true, false);
        expect(ball.grabbed).toBe(false);
    });

    it('collision.update: distancia justo dentro (GREEN_GRAB_R - epsilon) → SÍ agarra', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const collision = new CollisionSystem(makePlayer(), bm);
        const c1 = makeCtrlAt(GREEN_GRAB_R - 0.001, 1.2, 0);
        const c2 = makeCtrlAt(5, 0, 0);
        collision.update(c1, c2, cam, true, false);
        expect(ball.grabbed).toBe(true);
    });

    it('tryGrabGreen también respeta el strict < en GREEN_GRAB_R', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        const ctrl = makeCtrlAt(GREEN_GRAB_R, 1.2, 0);
        const grabbed = bm.tryGrabGreen(ctrl, 1, false);
        expect(grabbed).toBe(null);
        expect(ball.grabbed).toBe(false);
    });
});

describe('Bola verde — boundaries estrictos del drop (WALL_MAX_Y, WALL_MIN_FRONT_DIST)', () => {
    const PLAYER = { x: 0, y: 1.6, z: 0 };

    it('y EXACTAMENTE 1.5 → válido (la condición es y > 1.5)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const ok = bm.dropAsWall(ball, { x: 0, y: 1.5, z: -1.0 }, PLAYER);
        expect(ok).toBe(true);
        expect(ball._wall).toBe(true);
        expect(ball.mesh.position.y).toBe(1.5);
    });

    it('y justo por encima (1.50001) → descartado', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const ok = bm.dropAsWall(ball, { x: 0, y: 1.50001, z: -1.0 }, PLAYER);
        expect(ok).toBe(false);
    });

    it('frontDist EXACTAMENTE 0.2 → válido (la condición es frontDist < 0.2)', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        // playerPos.z=0, ctrlPos.z=-0.2 → frontDist = 0 - (-0.2) = 0.2
        const ok = bm.dropAsWall(ball, { x: 0, y: 0.2, z: -0.2 }, PLAYER);
        expect(ok).toBe(true);
        expect(ball._wall).toBe(true);
        expect(ball.mesh.position.z).toBe(-0.2);
    });

    it('frontDist justo por debajo (0.19999) → descartado', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        const ok = bm.dropAsWall(ball, { x: 0, y: 0.2, z: -0.19999 }, PLAYER);
        expect(ok).toBe(false);
    });
});

describe('Bola verde — concurrencia entre dos mandos', () => {
    const cam = { matrixWorld: { x: 0, y: 1.6, z: 0 } };
    const PLAYER = { x: 0, y: 1.6, z: 0 };

    it('cada mando agarra y suelta su propia bola sin interferir (mismo frame)', () => {
        const bm = new BallManager(makeScene(), STD_CONFIG, new Difficulty(1));
        const ballA = bm.spawn('green', PLAYER);
        const ballB = bm.spawn('green', PLAYER);
        ballA.mesh.position.set(-0.5, 1.2, 0);
        ballB.mesh.position.set( 0.5, 1.2, 0);

        const collision = new CollisionSystem(makePlayer(), bm);
        const grabs = [];
        collision.onGreenGrabbed = (b, idx) => { grabs.push({ b, idx }); };

        // Ambos mandos agarran su bola en el mismo update
        collision.update(makeCtrlAt(-0.5, 1.2, 0), makeCtrlAt(0.5, 1.2, 0),
                         cam, true, true, false, false);
        expect(ballA.grabbed).toBe(true);
        expect(ballB.grabbed).toBe(true);
        expect(grabs.length).toBe(2);
        expect(new Set(grabs.map(g => g.idx))).toEqual(new Set([1, 2]));

        // Drag independiente
        ballA.ctrlPos = { x: -1.0, y: 0.3, z: -1.5 };
        ballB.ctrlPos = { x:  1.5, y: 1.0, z: -0.6 };
        bm._moveBall(ballA, 0.016, PLAYER);
        bm._moveBall(ballB, 0.016, PLAYER);
        expect(ballA.mesh.position.x).toBe(-1.0);
        expect(ballB.mesh.position.x).toBe(1.5);

        // c1 dropea válido, c2 dropea muy alto → descartado
        const okA = bm.dropAsWall(ballA, { x: -1.0, y: 0.3, z: -1.5 }, PLAYER);
        const okB = bm.dropAsWall(ballB, { x:  1.5, y: 1.8, z: -0.6 }, PLAYER);

        expect(okA).toBe(true);
        expect(ballA._wall).toBe(true);
        expect(bm.balls.includes(ballA)).toBe(true);

        expect(okB).toBe(false);
        expect(bm.balls.includes(ballB)).toBe(false);
    });

    it('uno dropea como muro mientras el otro sigue agarrando — sin contagio de estado', () => {
        const bm = new BallManager(makeScene(), STD_CONFIG, new Difficulty(1));
        const ballA = bm.spawn('green', PLAYER);
        const ballB = bm.spawn('green', PLAYER);
        ballA.mesh.position.set(-0.5, 1.2, 0);
        ballB.mesh.position.set( 0.5, 1.2, 0);
        ballA.grabbed = true;
        ballB.grabbed = true;
        ballA.ctrlPos = { x: -0.5, y: 1.2, z: 0 };
        ballB.ctrlPos = { x:  0.5, y: 1.2, z: 0 };

        bm.dropAsWall(ballA, { x: -0.5, y: 0.2, z: -1.0 }, PLAYER);

        // ballA es muro
        expect(ballA._wall).toBe(true);
        expect(ballA.grabbed).toBe(false);
        // ballB sigue agarrada con su estado intacto
        expect(ballB._wall).toBeFalsy();
        expect(ballB.grabbed).toBe(true);
        expect(ballB.ctrlPos.x).toBe(0.5);

        // ballB sigue al mando normalmente
        ballB.ctrlPos = { x: 1.0, y: 1.5, z: -0.3 };
        bm._moveBall(ballB, 0.016, PLAYER);
        expect(ballB.mesh.position.x).toBe(1.0);
        expect(ballB.mesh.position.y).toBe(1.5);
        expect(ballB.mesh.position.z).toBe(-0.3);
    });
});

describe('Bola verde — persistencia del muro tras drop válido', () => {
    const PLAYER = { x: 0, y: 1.6, z: 0 };

    it('un muro permanece quieto a través de 50 frames de update()', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        bm.dropAsWall(ball, { x: 0.7, y: 0.3, z: -1.5 }, PLAYER);

        for (let i = 0; i < 50; i++) bm.update(0.016, PLAYER);

        expect(bm.balls.includes(ball)).toBe(true);
        expect(ball._wall).toBe(true);
        expect(ball.mesh.position.x).toBe(0.7);
        expect(ball.mesh.position.y).toBe(0.3);
        expect(ball.mesh.position.z).toBe(-1.5);
    });

    it('un muro NO se elimina por la regla "behind" si el jugador camina y queda detrás', () => {
        const { bm, ball } = makeGreenBallAt(0, 1.2, 0);
        ball.grabbed = true;
        bm.dropAsWall(ball, { x: 0, y: 0.3, z: -1.0 }, PLAYER);

        // Jugador avanza hasta z=-3 → muro queda detrás (z=-1 > -3 + 0.5 = -2.5)
        bm.update(0.016, { x: 0, y: 1.6, z: -3 });

        expect(bm.balls.includes(ball)).toBe(true);
        expect(ball.mesh.position.z).toBe(-1.0);
    });
});

// La mecánica antigua "una roja toca el muro y lo destruye" se eliminó —
// ahora la bola dropeada es decoración estática permanente, no un muro
// destructible. Los tests de _checkWallCollisions / onWallHit se borraron.

describe('Bola verde — la bola dropeada es estática y permanente (no destruible)', () => {
    const PLAYER = { x: 0, y: 1.6, z: 0 };

    function placeDropped(bm, x, y, z) {
        const w = bm.spawn('green', PLAYER);
        w.grabbed = true;
        bm.dropAsWall(w, { x, y, z }, PLAYER);
        return w;
    }

    it('una roja superpuesta sobre la verde dropeada NO la elimina', () => {
        const bm = new BallManager(makeScene(), STD_CONFIG, new Difficulty(1));
        const w  = placeDropped(bm, 0, 0.2, -1);
        const red = bm.spawn('red', PLAYER);
        red.mesh.position.set(0, 0.2, -1);

        bm.update(0.016, PLAYER);

        expect(bm.balls.includes(w)).toBe(true);
        expect(w._wall).toBe(true);
    });

    it('múltiples verdes dropeadas conviven (no se destruyen entre sí)', () => {
        const bm = new BallManager(makeScene(), STD_CONFIG, new Difficulty(1));
        placeDropped(bm, -1, 0.2, -1);
        placeDropped(bm,  0, 0.2, -1);
        placeDropped(bm,  1, 0.2, -1);

        bm.update(0.016, PLAYER);

        expect(bm.balls.filter(b => b._wall).length).toBe(3);
    });
});

describe('Bola verde — limpieza de recursos al eliminar', () => {
    it('remove() llama scene.remove(mesh) y dispose en geometry y material', () => {
        const removed = [];
        const scene = { add() {}, remove(o) { removed.push(o); } };
        const bm = new BallManager(scene, STD_CONFIG, new Difficulty(1));

        const ball = bm.spawn('green', { x: 0, y: 1.6, z: 0 });
        let geoDisposed = false, matDisposed = false;
        ball.mesh.geometry.dispose = () => { geoDisposed = true; };
        ball.mesh.material.dispose = () => { matDisposed = true; };

        bm.remove(ball);

        expect(removed).toContain(ball.mesh);
        expect(geoDisposed).toBe(true);
        expect(matDisposed).toBe(true);
        expect(bm.balls.includes(ball)).toBe(false);
    });

    it('removeAll() limpia todas las bolas verdes (mesh + dispose por cada una)', () => {
        const removed = [];
        const scene = { add() {}, remove(o) { removed.push(o); } };
        const bm = new BallManager(scene, STD_CONFIG, new Difficulty(1));

        const balls = [
            bm.spawn('green', { x: 0, y: 1.6, z: 0 }),
            bm.spawn('green', { x: 0, y: 1.6, z: 0 }),
            bm.spawn('green', { x: 0, y: 1.6, z: 0 }),
        ];
        let geoCount = 0, matCount = 0;
        for (const b of balls) {
            b.mesh.geometry.dispose = () => { geoCount++; };
            b.mesh.material.dispose = () => { matCount++; };
        }

        bm.removeAll();

        expect(bm.balls.length).toBe(0);
        expect(geoCount).toBe(3);
        expect(matCount).toBe(3);
        expect(removed.length).toBe(3);
    });

    it('un drop fallido también llama scene.remove + dispose', () => {
        const removed = [];
        const scene = { add() {}, remove(o) { removed.push(o); } };
        const bm = new BallManager(scene, STD_CONFIG, new Difficulty(1));

        const ball = bm.spawn('green', { x: 0, y: 1.6, z: 0 });
        ball.grabbed = true;
        let geoDisposed = false, matDisposed = false;
        ball.mesh.geometry.dispose = () => { geoDisposed = true; };
        ball.mesh.material.dispose = () => { matDisposed = true; };

        // Drop demasiado alto → bola se descarta
        bm.dropAsWall(ball, { x: 0, y: 2.5, z: -1.0 }, { x: 0, y: 1.6, z: 0 });

        expect(removed).toContain(ball.mesh);
        expect(geoDisposed).toBe(true);
        expect(matDisposed).toBe(true);
    });
});
