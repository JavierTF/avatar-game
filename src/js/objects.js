import * as THREE from 'three';
import { BOUNDS } from './scene.js';

const COLORS = {
    red:   0xff2222,
    blue:  0x2255ff,
    green: 0x22cc55,
};

const WALL_MAX_Y          = 1.50;  // alto máximo donde se puede soltar la bola
const WALL_MIN_FRONT_DIST = 0.20;  // mínima distancia frontal al jugador

// Radio de agarre de la verde — fuente única de verdad.
// Lo importan collision.js (detección) y main.js (selectstart).
export const GREEN_GRAB_R = 0.45;

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
        const green = Math.round(4 - 2 * t);   // 4 → 2
        const blue  = Math.round(4 - 2 * t);   // 4 → 2
        const red   = Math.round(5 + 3 * t);   // 5 → 8
        return { blue, green, red };
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

        // Auto-drop: bolas verdes con timer expirado caen al suelo como muro.
        for (const b of this.balls) {
            if (b._autoDropAt && now >= b._autoDropAt) this._commitAutoDrop(b);
        }

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            // Las bolas con _wall (muro verde) son estáticas — no se mueven.
            if (!b._wall) {
                this._moveBall(b, delta, playerPos);
            }
            // Bolas que ya pasaron detrás del jugador se eliminan inmediatamente
            // (excepto las agarradas y las del muro). Las agarradas tampoco
            // caducan por out-of-bounds — siguen al mando aunque éste salga
            // del área de juego, para no dejar grabbedBall1/2 colgando.
            const behind = !b.grabbed && !b._wall &&
                           b.mesh.position.z > playerPos.z + 0.5;
            const oob    = !b.grabbed && this._outOfBounds(b.mesh.position);
            if (oob || behind) {
                if (b.type === 'red' && !b._dropped && this.onRedEscaped) {
                    this.onRedEscaped();
                }
                this._remove(i);
            }
        }
    }

    // Intenta agarrar una verde en rango con el controlador `ctrl`. Si el
    // mando ya tiene una bola (alreadyGrabbed=true), no agarra nada.
    // En éxito: la bola se pega al mando (visible, sigue al mando vía drag).
    tryGrabGreen(ctrl, idx, alreadyGrabbed) {
        if (alreadyGrabbed) return null;
        const cp = new THREE.Vector3();
        ctrl.getWorldPosition(cp);
        for (const ball of this.balls) {
            if (ball.type !== 'green' || ball.grabbed || ball._wall) continue;
            if (cp.distanceTo(ball.mesh.position) < GREEN_GRAB_R) {
                ball.grabbed = true;
                ball.ctrlPos = cp.clone();
                ball.mesh.position.copy(cp);
                return ball;
            }
        }
        return null;
    }

    // Agenda el auto-drop al suelo: oculta la bola del mando inmediatamente y
    // la hace aparecer 1s después en el suelo (x/z del ctrlPos actual, y=0.15).
    // Idempotente: si ya estaba agendada, ignora. Lo dispara main.js cuando el
    // mando baja a y < 1.5m durante el drag.
    scheduleAutoDrop(ball, now = Date.now()) {
        if (ball._autoDropAt) return;
        ball.mesh.visible = false;
        ball._autoDropAt  = now + 1000;
        ball._autoDropPos = {
            x: ball.ctrlPos.x,
            y: 0.15,
            z: ball.ctrlPos.z,
        };
    }

    // Trackea la altura del mando para una bola agarrada y dispara el
    // auto-drop sólo en la transición arriba→abajo (>1.5m → <1.5m). Si el
    // mando nunca estuvo arriba, NO dispara aunque esté abajo (evita drop
    // espurio al hacer grab a chest height típico).
    trackHeightAndMaybeDrop(ball, currentY, now = Date.now()) {
        if (!ball.grabbed || ball._autoDropAt) return;
        if (currentY > 1.5) ball._wasAboveThreshold = true;
        if (ball._wasAboveThreshold && currentY < 1.5) {
            this.scheduleAutoDrop(ball, now);
        }
    }

    // Aplica el auto-drop a una bola cuyo timer ya expiró: la coloca en el
    // suelo, la marca como muro, la hace visible.
    _commitAutoDrop(ball) {
        ball.mesh.position.set(
            ball._autoDropPos.x,
            ball._autoDropPos.y,
            ball._autoDropPos.z,
        );
        ball.mesh.visible = true;
        ball._wall        = true;
        ball.grabbed      = false;
        ball.ctrlPos      = null;
        ball._autoDropAt  = null;
        ball._autoDropPos = null;
    }

    // Convierte una bola verde agarrada en un ladrillo del muro, si el
    // mando está bajo (y ≤ 1.5m) y delante del jugador (frontDist ≥ 0.5m).
    // En cualquier otro caso (alto, demasiado cerca, o detrás), descarta la
    // bola eliminándola del manager.
    // Devuelve true si la bola se quedó como muro, false si se descartó.
    // Lanza si la bola no está agarrada o ya es muro — contrato explícito.
    dropAsWall(ball, ctrlPos, playerPos) {
        if (!ball.grabbed) throw new Error('dropAsWall: la bola no está agarrada');
        if (ball._wall)    throw new Error('dropAsWall: la bola ya es muro');

        const frontDist = playerPos.z - ctrlPos.z;
        const tooHigh   = ctrlPos.y > WALL_MAX_Y;
        const tooClose  = frontDist < WALL_MIN_FRONT_DIST;

        if (tooHigh || tooClose) {
            this.remove(ball);
            return false;
        }

        ball._wall   = true;
        ball.grabbed = false;
        ball.ctrlPos = null;
        ball.velocity.set(0, 0, 0);
        ball.mesh.position.copy(ctrlPos);
        return true;
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
        // sigue al mando; si por algún motivo ctrlPos es null, se queda quieta
        // (no cae a la rama de velocity).
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

    // Hint visual: brillo verde cuando el mando está en rango de agarre.
    // Bolas agarradas o convertidas en muro se fuerzan a emissive APAGADO
    // (en vez de saltarlas, que las dejaba "congeladas" con el último glow).
    updateGreenHints(p1, p2) {
        for (const b of this.balls) {
            if (b.type !== 'green') continue;
            if (b.grabbed || b._wall) {
                b.mesh.material.emissive.setHex(0x000000);
                b.mesh.material.emissiveIntensity = 0.2;
                continue;
            }
            const near = (
                p1.distanceTo(b.mesh.position) < GREEN_GRAB_R ||
                p2.distanceTo(b.mesh.position) < GREEN_GRAB_R
            );
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
