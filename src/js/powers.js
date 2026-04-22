import * as THREE from 'three';

const _up  = new THREE.Vector3(0, 1, 0);

export class Powers {
    constructor(scene, player, ballManager, difficulty) {
        this.scene       = scene;
        this.player      = player;
        this.ballManager = ballManager;
        this.difficulty  = difficulty;
        this._effects    = [];
        this._activeShield = null;

        this.MANA_COSTS = {
            escudo: [[0.20, 0.30, 0.40], 'escudo'],
            sismico:[[0.40, 0.50, 0.60], 'sismico'],
            llama:  [[0.60, 0.70, 0.80], 'llama'],
            viento: [[0.60, 0.80, 1.00], 'viento'],
        };

        this.SHIELD_DURATION = 2.5;
        this.SHIELD_RADIUS   = 1.4;
    }

    _cost(power) {
        const costs = this.MANA_COSTS[power][0];
        const lvl   = Math.min(this.difficulty.nivel - 1, 2);
        return costs[lvl];
    }

    activateEscudo(pos1, pos2) {
        if (!this.player.consumeMana(this._cost('escudo'))) return false;
        this._spawnEscudoFX(pos1, pos2);
        // Escudo activo: durante SHIELD_DURATION s, cualquier bola roja que
        // entre en el radio alrededor de los mandos cae.
        this._activeShield = {
            pos1: pos1.clone(),
            pos2: pos2.clone(),
            remaining: this.SHIELD_DURATION,
        };
        return true;
    }

    activateSismico(playerPos) {
        if (!this.player.consumeMana(this._cost('sismico'))) return false;
        const RADIUS = 75;
        const balls  = this.ballManager.balls.filter(b => b.type === 'red');
        let   killed = 0;
        for (const b of balls) {
            if (playerPos.distanceTo(b.mesh.position) < RADIUS) {
                this._dropBall(b);
                killed++;
            }
        }
        this._spawnSismicoFX(playerPos);
        return killed;
    }

    activateLlama(playerPos, dir) {
        if (!this.player.consumeMana(this._cost('llama'))) return false;
        const ray = new THREE.Ray(playerPos.clone(), dir.clone().normalize());
        const balls = this.ballManager.balls.filter(b => b.type === 'red');
        let killed = 0;
        for (const b of balls) {
            if (ray.distanceToPoint(b.mesh.position) < 0.5) {
                this.ballManager.remove(b);
                killed++;
            }
        }
        this._spawnLlamaFX(playerPos, dir);
        return killed;
    }

    activateViento(playerPos) {
        if (!this.player.consumeMana(this._cost('viento'))) return false;
        const RADIUS = 5.0;
        let thrown = 0;
        for (const b of this.ballManager.balls) {
            if (b.type !== 'red' || b._dropped) continue;
            if (playerPos.distanceTo(b.mesh.position) < RADIUS) {
                this._throwBall(b, playerPos);
                thrown++;
            }
        }
        this._spawnVientoFX(playerPos);
        return thrown;
    }

    _dropBall(ball) {
        if (ball._dropped) return;
        ball._dropped = true;
        ball.velocity.set(
            (Math.random() - 0.5) * 0.05,
            -0.08,
            (Math.random() - 0.5) * 0.05
        );
        setTimeout(() => this.ballManager.remove(ball), 1500);
    }

    // Lanza la bola horizontalmente alejándose del jugador (radial hacia "atrás"
    // desde su punto de vista) y con fuerte componente hacia abajo.
    _throwBall(ball, playerPos) {
        if (ball._dropped) return;
        ball._dropped = true;
        const dx  = ball.mesh.position.x - playerPos.x;
        const dz  = ball.mesh.position.z - playerPos.z;
        const len = Math.hypot(dx, dz) || 1;
        const SPEED = 0.12;
        ball.velocity.set(
            (dx / len) * SPEED,
            -0.06,
            (dz / len) * SPEED
        );
        setTimeout(() => this.ballManager.remove(ball), 1500);
    }

    // ─── Efectos visuales ──────────────────────────────────────────
    //
    // Cada efecto arranca muy pequeño (initScale) y crece de manera
    // uniforme hasta el tamaño final (finalScale) en el momento en que
    // termina su vida. La opacidad se atenúa linealmente con la vida.
    _pushFX(mesh, { rate, initScale, finalScale, baseOpacity }) {
        this._effects.push({
            mesh,
            life: 1.0,
            rate,
            scale: 0,
            initScale,
            finalScale,
            baseOpacity,
        });
    }

    // Escudo Ártico: columna vertical blanco-azulada que se alza entre las manos.
    _spawnEscudoFX(pos1, pos2) {
        const geo = new THREE.CylinderGeometry(0.45, 0.45, 1, 20, 1, true);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xbbeeff, transparent: true, opacity: 0.55,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            (pos1.x + pos2.x) / 2,
            (pos1.y + pos2.y) / 2 + 0.6,
            (pos1.z + pos2.z) / 2
        );
        this.scene.add(mesh);
        this._pushFX(mesh, {
            rate: 0.5,
            initScale:  [0.25, 0.4, 0.25],
            finalScale: [1.8,  4.2, 1.8],
            baseOpacity: 0.30,
        });
    }

    // Pulso Sísmico: anillo naranja plano que se expande por el suelo.
    _spawnSismicoFX(pos) {
        const geo = new THREE.RingGeometry(0.6, 0.9, 48);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff8833, transparent: true, opacity: 0.9,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, 0.02, pos.z);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this._pushFX(mesh, {
            rate: 0.7,
            initScale:  [0.25, 0.25, 1],
            finalScale: [5.5,  5.5,  1],
            baseOpacity: 0.50,
        });
    }

    // Llama Dragón: rayo amarillo-naranja alargado hacia la dirección de la cámara.
    _spawnLlamaFX(pos, dir) {
        const geo = new THREE.CylinderGeometry(0.12, 0.04, 1, 12);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffcc22, transparent: true, opacity: 0.85,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const d = dir.clone().normalize();
        // La base del cilindro en la cabeza del jugador, el extremo hacia adelante.
        mesh.position.set(pos.x + d.x * 0.5, pos.y + d.y * 0.5, pos.z + d.z * 0.5);
        mesh.quaternion.setFromUnitVectors(_up, d);
        this.scene.add(mesh);
        this._pushFX(mesh, {
            rate: 0.8,
            initScale:  [0.25, 0.4, 0.25],
            finalScale: [1.2,  6.5, 1.2],
            baseOpacity: 0.50,
        });
    }

    // Viento Eterno: onda esférica verde-celeste que se expande alrededor.
    _spawnVientoFX(pos) {
        const geo = new THREE.SphereGeometry(1, 20, 12);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xbbffdd, transparent: true, opacity: 0.45,
            wireframe: true,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        this.scene.add(mesh);
        this._pushFX(mesh, {
            rate: 0.55,
            initScale:  [0.25, 0.25, 0.25],
            finalScale: [4.5,  4.5,  4.5],
            baseOpacity: 0.30,
        });
    }

    update(delta) {
        // Escudo vivo: tira cualquier bola roja que entre en su radio.
        if (this._activeShield) {
            const s = this._activeShield;
            s.remaining -= delta;
            for (const b of this.ballManager.balls) {
                if (b.type !== 'red' || b._dropped) continue;
                const d1 = s.pos1.distanceTo(b.mesh.position);
                const d2 = s.pos2.distanceTo(b.mesh.position);
                if (d1 < this.SHIELD_RADIUS || d2 < this.SHIELD_RADIUS) {
                    this._dropBall(b);
                }
            }
            if (s.remaining <= 0) this._activeShield = null;
        }

        for (let i = this._effects.length - 1; i >= 0; i--) {
            const e = this._effects[i];
            e.life -= delta * e.rate;
            // progreso 0 (recién invocado) → 1 (terminándose)
            e.scale = Math.min(1, Math.max(0, 1 - e.life));

            const sx = e.initScale[0] + (e.finalScale[0] - e.initScale[0]) * e.scale;
            const sy = e.initScale[1] + (e.finalScale[1] - e.initScale[1]) * e.scale;
            const sz = e.initScale[2] + (e.finalScale[2] - e.initScale[2]) * e.scale;
            e.mesh.scale.set(sx, sy, sz);
            e.mesh.material.opacity = Math.max(0, e.baseOpacity * Math.max(0, e.life));

            if (e.life <= 0) {
                this.scene.remove(e.mesh);
                e.mesh.geometry.dispose();
                e.mesh.material.dispose();
                this._effects.splice(i, 1);
            }
        }
    }
}
