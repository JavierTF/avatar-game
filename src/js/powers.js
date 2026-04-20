import * as THREE from 'three';

export class Powers {
    constructor(scene, player, ballManager, difficulty) {
        this.scene       = scene;
        this.player      = player;
        this.ballManager = ballManager;
        this.difficulty  = difficulty;
        this._effects    = [];

        this.MANA_COSTS = {
            escudo: [[0.20, 0.30, 0.40], 'escudo'],
            sismico:[[0.40, 0.50, 0.60], 'sismico'],
            llama:  [[0.60, 0.70, 0.80], 'llama'],
            viento: [[0.60, 0.80, 1.00], 'viento'],
        };
    }

    _cost(power) {
        const costs = this.MANA_COSTS[power][0];
        const lvl   = Math.min(this.difficulty.nivel - 1, 2);
        return costs[lvl];
    }

    activateEscudo(pos1, pos2) {
        if (!this.player.consumeMana(this._cost('escudo'))) return false;
        this._spawnHalo(pos1);
        this._spawnHalo(pos2);
        setTimeout(() => {
            const balls = this.ballManager.balls.filter(b => b.type === 'red');
            for (const b of balls) {
                if (pos1.distanceTo(b.mesh.position) < 1.2 || pos2.distanceTo(b.mesh.position) < 1.2) {
                    this._dropBall(b);
                }
            }
        }, 600);
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
        this._spawnRing(playerPos);
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
        this._spawnBeam(playerPos, dir);
        return killed;
    }

    activateViento(playerPos) {
        if (!this.player.consumeMana(this._cost('viento'))) return false;
        const balls = [...this.ballManager.balls.filter(b => b.type === 'red')];
        for (const b of balls) this.ballManager.remove(b);
        this._spawnWave(playerPos);
        return balls.length;
    }

    _dropBall(ball) {
        ball.velocity.set(
            (Math.random() - 0.5) * 0.02,
            -0.03,
            (Math.random() - 0.5) * 0.02
        );
        setTimeout(() => this.ballManager.remove(ball), 1500);
    }

    _spawnHalo(pos) {
        const geo  = new THREE.TorusGeometry(0.3, 0.03, 8, 32);
        const mat  = new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this._effects.push({ mesh, life: 1.0, type: 'fade' });
    }

    _spawnRing(pos) {
        const geo  = new THREE.RingGeometry(0.1, 0.3, 32);
        const mat  = new THREE.MeshBasicMaterial({ color: 0xaa8833, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this._effects.push({ mesh, life: 1.0, type: 'expand', scale: 1.0 });
    }

    _spawnWave(pos) {
        const geo  = new THREE.SphereGeometry(0.5, 16, 16);
        const mat  = new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.6, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this._effects.push({ mesh, life: 1.0, type: 'wave' });
    }

    _spawnBeam(pos, dir) {
        const length = 6;
        const geo    = new THREE.CylinderGeometry(0.05, 0.05, length, 8);
        const mat    = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
        const mesh   = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos).addScaledVector(dir, length / 2);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        this.scene.add(mesh);
        this._effects.push({ mesh, life: 0.5, type: 'fade' });
    }

    update(delta) {
        for (let i = this._effects.length - 1; i >= 0; i--) {
            const e = this._effects[i];
            e.life -= delta * 1.5;
            if (e.type === 'fade') {
                e.mesh.material.opacity = Math.max(0, e.life * 0.8);
            } else if (e.type === 'expand') {
                e.scale += delta * 8;
                e.mesh.scale.setScalar(e.scale);
                e.mesh.material.opacity = Math.max(0, e.life * 0.7);
            } else if (e.type === 'wave') {
                e.scale = (e.scale || 1) + delta * 10;
                e.mesh.scale.setScalar(e.scale);
                e.mesh.material.opacity = Math.max(0, e.life * 0.5);
            }
            if (e.life <= 0) {
                this.scene.remove(e.mesh);
                e.mesh.geometry.dispose();
                e.mesh.material.dispose();
                this._effects.splice(i, 1);
            }
        }
    }
}
