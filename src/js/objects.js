import * as THREE from 'three';
import { BOUNDS } from './scene.js';

const COLORS = {
    red:    0xff2222,
    blue:   0x2255ff,
    orange: 0x22cc55,
};

// Radio de agarre de la naranja — fuente única de verdad.
// Lo importan collision.js (detección) y main.js (selectstart).
export const ORANGE_GRAB_R = 0.45;

function randomGeo() {
    const r = THREE.MathUtils.lerp(0.1, 0.25, Math.random());
    return new THREE.SphereGeometry(r, 12, 12);
}

const _target = new THREE.Vector3();
const _dir    = new THREE.Vector3();

export class BallManager {
    constructor(scene, config, difficulty) {
        this.scene      = scene;
        this.config     = config;
        this.difficulty = difficulty;
        this.balls      = [];
        this._spawnTimer = 0;
        this.onBallSpawned = null;   // (type) => void
        this.onRedEscaped  = null;   // () => void
    }

    // Pesos de spawn. Las rojas (movimiento caótico + homing) son las más
    // abundantes a niveles altos para subir la dificultad.
    _spawnWeights() {
        const t = Math.min((this.difficulty.nivel - 1) / 10, 1);
        const blue   = Math.round(4 - 2 * t);   // 4 → 2
        const orange = Math.round(4 - 2 * t);   // 4 → 2
        const red    = Math.round(5 + 3 * t);   // 5 → 8
        return { blue, orange, red };
    }

    _pickType() {
        const w = this._spawnWeights();
        const pool = [];
        for (const [type, count] of Object.entries(w)) {
            for (let i = 0; i < count; i++) pool.push(type);
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    update(delta, playerPos, now = Date.now()) {
        const rate = this.difficulty.spawnRate();
        this._spawnTimer += delta;
        if (this._spawnTimer >= rate) {
            this._spawnTimer = 0;
            this.spawn(this._pickType(), playerPos);
        }

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            this._moveBall(b, delta, playerPos);
            // Bolas que ya pasaron detrás del jugador se eliminan inmediatamente.
            // Las naranjas agarradas tampoco caducan por out-of-bounds — siguen
            // al mando aunque éste salga del área de juego, para no dejar
            // referencias colgando.
            const behind = !b.grabbed && b.mesh.position.z > playerPos.z + 0.5;
            const oob    = !b.grabbed && this._outOfBounds(b.mesh.position);
            if (oob || behind) {
                if (b.type === 'red' && !b._dropped && this.onRedEscaped) {
                    this.onRedEscaped();
                }
                this._remove(i);
            }
        }
    }

    // Intenta agarrar una naranja en rango con el controlador `ctrl`. Si el
    // mando ya tiene una bola (alreadyGrabbed=true), no agarra nada. En éxito
    // la bola se pega al mando (sigue al mando vía drag en _moveBall).
    tryGrabOrange(ctrl, idx, alreadyGrabbed) {
        if (alreadyGrabbed) return null;
        const cp = new THREE.Vector3();
        ctrl.getWorldPosition(cp);
        for (const ball of this.balls) {
            if (ball.type !== 'orange' || ball.grabbed) continue;
            if (cp.distanceTo(ball.mesh.position) < ORANGE_GRAB_R) {
                ball.grabbed = true;
                ball.ctrlPos = { x: cp.x, y: cp.y, z: cp.z };
                ball.mesh.position.copy(ball.ctrlPos);
                return ball;
            }
        }
        return null;
    }

    spawn(type, playerPos) {
        const cfg = this.config.balls[type];
        const mat = new THREE.MeshStandardMaterial({
            color: COLORS[type], roughness: 0.5, metalness: 0.3,
            emissive: new THREE.Color(COLORS[type]).multiplyScalar(0.2)
        });
        const mesh = new THREE.Mesh(randomGeo(), mat);
        mesh.castShadow = true;

        const spawnPos = this._spawnPosition(cfg, playerPos);
        mesh.position.copy(spawnPos);

        const vel = this._velocity(type, cfg, spawnPos, playerPos);

        const ball = { mesh, type, velocity: vel, cfg, alive: true, grabbed: false, ctrlPos: null };
        if (type === 'red') {
            ball._age        = 0;
            ball._chaosPhase = Math.random() * Math.PI * 2;
            ball._chaosFreq  = 7 + Math.random() * 6;
        }
        this.scene.add(mesh);
        this.balls.push(ball);
        if (this.onBallSpawned) this.onBallSpawned(type);
        return ball;
    }

    _spawnPosition(cfg, playerPos) {
        const dist = 4.5;
        return new THREE.Vector3(
            playerPos.x + (Math.random() - 0.5) * 3.5,
            Math.random() * 1.5 + 0.5,
            playerPos.z - dist
        );
    }

    _velocity(type, cfg, spawnPos, playerPos) {
        const speed = cfg.speed * this.difficulty.speedMult;
        if (type === 'red' && cfg.pattern !== 'straight') {
            return this._chaosVelocity(cfg, spawnPos, playerPos, speed);
        }
        _dir.subVectors(playerPos, spawnPos).normalize().multiplyScalar(speed);
        return _dir.clone();
    }

    _chaosVelocity(cfg, spawnPos, playerPos, speed) {
        if (cfg.pattern === 'homing') {
            return new THREE.Vector3()
                .subVectors(playerPos, spawnPos)
                .normalize()
                .multiplyScalar(speed);
        }
        if (cfg.pattern === 'zigzag') {
            const base = new THREE.Vector3()
                .subVectors(playerPos, spawnPos)
                .normalize()
                .multiplyScalar(speed);
            base.x += (Math.random() - 0.5) * speed * 2;
            return base;
        }
        return new THREE.Vector3(
            (Math.random() - 0.5) * speed * 2,
            (Math.random() - 0.5) * speed,
            -speed
        );
    }

    _moveBall(ball, delta, playerPos) {
        // Una bola agarrada NO se mueve por su velocidad. Si tiene ctrlPos,
        // sigue al mando; si por algún motivo ctrlPos es null, se queda quieta.
        if (ball.grabbed) {
            if (ball.ctrlPos) ball.mesh.position.copy(ball.ctrlPos);
            return;
        }
        // Movimiento LOCO para la roja: X e Y oscilan con dos ondas
        // superpuestas de distinta frecuencia; Z se mantiene o hace homing suave.
        if (ball.type === 'red') {
            ball._age += delta;
            const spd = ball.cfg.speed * this.difficulty.speedMult;
            const f   = ball._chaosFreq;
            const p   = ball._chaosPhase;
            ball.velocity.x = (
                Math.sin(ball._age * f + p) * 2.5 +
                Math.sin(ball._age * f * 1.7 + p * 1.3) * 1.0
            ) * spd;
            ball.velocity.y = (
                Math.cos(ball._age * f * 0.7 + p) * 1.8 +
                Math.cos(ball._age * f * 2.3 + p * 0.6) * 0.6
            ) * spd;
            const beyondPlayer = ball.mesh.position.z >= playerPos.z;
            if (ball.cfg.pattern === 'homing' && !beyondPlayer) {
                _target.set(playerPos.x, playerPos.y, playerPos.z);
                _dir.subVectors(_target, ball.mesh.position).normalize()
                    .multiplyScalar(spd);
                ball.velocity.z = _dir.z;
            } else if (beyondPlayer) {
                // Una vez detrás del jugador, deja de perseguirlo: empuja Z hacia
                // adelante para que cumpla la condición behind y se elimine.
                ball.velocity.z = spd;
            }
        }
        ball.mesh.position.add(ball.velocity);
        ball.mesh.rotation.x += 0.02;
        ball.mesh.rotation.y += 0.015;
    }

    _outOfBounds(p) {
        return (
            Math.abs(p.x) > BOUNDS.x + 2 ||
            Math.abs(p.z) > BOUNDS.z + 2 ||
            p.y < -1 || p.y > BOUNDS.yMax + 2
        );
    }

    remove(ball) {
        const i = this.balls.indexOf(ball);
        if (i !== -1) this._remove(i);
    }

    _remove(i) {
        const b = this.balls[i];
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.balls.splice(i, 1);
    }

    removeAll() {
        for (let i = this.balls.length - 1; i >= 0; i--) this._remove(i);
    }

    // Hint visual: brillo naranja cuando el mando está en rango de agarre.
    // Bolas agarradas se fuerzan a emissive APAGADO (en vez de saltarlas, lo
    // que las dejaba "congeladas" con el último glow).
    updateOrangeHints(p1, p2) {
        for (const b of this.balls) {
            if (b.type !== 'orange') continue;
            if (b.grabbed) {
                b.mesh.material.emissive.setHex(0x000000);
                b.mesh.material.emissiveIntensity = 0.2;
                continue;
            }
            const dx1 = Math.hypot(p1.x - b.mesh.position.x, p1.y - b.mesh.position.y, p1.z - b.mesh.position.z);
            const dx2 = Math.hypot(p2.x - b.mesh.position.x, p2.y - b.mesh.position.y, p2.z - b.mesh.position.z);
            const near = dx1 < ORANGE_GRAB_R || dx2 < ORANGE_GRAB_R;
            b.mesh.material.emissive.setHex(near ? 0x88ffaa : 0x000000);
            b.mesh.material.emissiveIntensity = near ? 2.0 : 0.2;
        }
    }

    getBallPositions() {
        return this.balls.map(b => ({
            type: b.type,
            x: b.mesh.position.x,
            y: b.mesh.position.y,
            z: b.mesh.position.z,
        }));
    }

    applySpeedMultiplier() {
        for (const b of this.balls) {
            b.velocity.normalize().multiplyScalar(b.cfg.speed * this.difficulty.speedMult);
        }
    }
}
