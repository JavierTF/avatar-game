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
    }

    // Devuelve pesos [red, blue, green, orange] según nivel.
    // Nivel 1 (fácil): de 20 → 12 roja, 4 azul, 4 verde, 0 naranja
    // Nivel 11+ (difícil): de 20 → 14 roja, 2 azul, 2 verde, 2 naranja
    _spawnWeights() {
        const t = Math.min((this.difficulty.nivel - 1) / 10, 1);
        const green  = Math.round(4 - 2 * t);   // 4 → 2
        const blue   = Math.round(4 - 2 * t);   // 4 → 2
        const orange = Math.round(2 * t);        // 0 → 2
        const red    = 20 - green - blue - orange;
        return { red, blue, green, orange };
    }

    _pickType() {
        const w = this._spawnWeights();
        const pool = [];
        for (const [type, count] of Object.entries(w)) {
            for (let i = 0; i < count; i++) pool.push(type);
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    update(delta, playerPos) {
        const rate = this.difficulty.spawnRate();
        this._spawnTimer += delta;
        if (this._spawnTimer >= rate) {
            this._spawnTimer = 0;
            this.spawn(this._pickType(), playerPos);
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
        if (ball.type === 'orange' && ball.cfg.pattern === 'homing' && !ball._bounced) {
            _target.set(playerPos.x, playerPos.y, playerPos.z);
            _dir.subVectors(_target, ball.mesh.position).normalize()
                .multiplyScalar(ball.cfg.speed * this.difficulty.speedMult);
            ball.velocity.lerp(_dir, 0.02);
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
