import * as THREE from 'three';

const TRAIL_COLOR  = 0xeeeeff;  // blanquecino
const POINT_LIFE   = 0.28;       // duración de cada punto (segundos)
const SPAWN_DELAY  = 0.15;       // espera antes de que aparezca la estela
const POINT_RADIUS = 0.018;      // tamaño de cada bolita

// Estela pequeña y blanquecina que persigue cada mando mientras ambos
// gatillos están presionados (modo de activación de poderes).
export class ControllerTrail {
    constructor(scene) {
        this.scene     = scene;
        this._points   = [];
        this._holdTime = 0;
    }

    update(delta, bothHeld, pos1, pos2) {
        if (bothHeld) {
            this._holdTime += delta;
            if (this._holdTime >= SPAWN_DELAY) {
                if (pos1) this._spawnPoint(pos1);
                if (pos2) this._spawnPoint(pos2);
            }
        } else {
            this._holdTime = 0;
        }

        for (let i = this._points.length - 1; i >= 0; i--) {
            const p = this._points[i];
            p.life -= delta;
            const t = Math.max(0, p.life) / POINT_LIFE; // 1 → 0
            p.mesh.material.opacity = t * 0.75;
            p.mesh.scale.setScalar(0.6 + 0.4 * (1 - t));
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this._points.splice(i, 1);
            }
        }
    }

    _spawnPoint(pos) {
        const geo = new THREE.SphereGeometry(POINT_RADIUS, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: TRAIL_COLOR,
            transparent: true,
            opacity: 0.75,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);
        this._points.push({ mesh, life: POINT_LIFE });
    }
}
