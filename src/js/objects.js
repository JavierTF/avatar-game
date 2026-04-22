import * as THREE from 'three';
import { BOUNDS } from './scene.js';

const COLORS = {
    red:    0xff2222,
    blue:   0x2255ff,
    green:  0x22cc55,
    orange: 0xff8800,
};

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
        this._orangeCooldown = 0;
    }

    // Devuelve pesos [red, blue, green, orange] según nivel.
    // La naranja es más frecuente a bajo nivel y más rara a alto.
    _spawnWeights() {
        const t = Math.min((this.difficulty.nivel - 1) / 10, 1);
        const green  = Math.round(4 - 2 * t);              // 4 → 2
        const blue   = Math.round(4 - 2 * t);              // 4 → 2
        const orange = Math.max(1, Math.round(2 - t));     // 2 → 1
        const red    = 20 - green - blue - orange;
        return { red, blue, green, orange };
    }

    // Cooldown entre naranjas: menor a bajo nivel, mayor a alto.
    _orangeCooldownDuration() {
        return 10 + (this.difficulty.nivel - 1) * 2;
    }

    _pickType() {
        const w = this._spawnWeights();
        if (this._orangeCooldown > 0) w.orange = 0;
        const pool = [];
        for (const [type, count] of Object.entries(w)) {
            for (let i = 0; i < count; i++) pool.push(type);
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    update(delta, playerPos) {
        this._orangeCooldown = Math.max(0, this._orangeCooldown - delta);
        const rate = this.difficulty.spawnRate();
        this._spawnTimer += delta;
        if (this._spawnTimer >= rate) {
            this._spawnTimer = 0;
            const type = this._pickType();
            if (type === 'orange') {
                this._orangeCooldown = this._orangeCooldownDuration();
            }
            this.spawn(type, playerPos);
        }

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            this._moveBall(b, delta, playerPos);
            if (this._outOfBounds(b.mesh.position)) {
                this._remove(i);
            }
        }
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
        if (type === 'orange') {
            const effects = ['heal', 'mana', 'points', 'slow'];
            ball.effect      = effects[Math.floor(Math.random() * effects.length)];
            ball._age        = 0;
            ball._chaosPhase = Math.random() * Math.PI * 2;
            ball._chaosFreq  = 7 + Math.random() * 6;
        }
        this.scene.add(mesh);
        this.balls.push(ball);
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
        if (type === 'orange' && cfg.pattern !== 'straight') {
            return this._orangeVelocity(cfg, spawnPos, playerPos, speed);
        }
        _dir.subVectors(playerPos, spawnPos).normalize().multiplyScalar(speed);
        return _dir.clone();
    }

    _orangeVelocity(cfg, spawnPos, playerPos, speed) {
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
        if (ball.grabbed && ball.ctrlPos) {
            ball.mesh.position.copy(ball.ctrlPos);
            return;
        }
        // Movimiento LOCO para la naranja: X e Y oscilan con dos ondas
        // superpuestas de distinta frecuencia; Z se mantiene o hace homing suave.
        if (ball.type === 'orange' && !ball._bounced) {
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
            if (ball.cfg.pattern === 'homing') {
                _target.set(playerPos.x, playerPos.y, playerPos.z);
                _dir.subVectors(_target, ball.mesh.position).normalize()
                    .multiplyScalar(spd);
                ball.velocity.z = _dir.z;
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

    // Level-1 grab hint: bright emissive glow when controller is in grab range
    updateGreenHints(nivel, p1, p2) {
        const GRAB_R = 0.23; // BALL_R + CTRL_R from collision.js
        for (const b of this.balls) {
            if (b.type !== 'green' || b.grabbed) continue;
            const near = nivel === 1 && (
                p1.distanceTo(b.mesh.position) < GRAB_R ||
                p2.distanceTo(b.mesh.position) < GRAB_R
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
