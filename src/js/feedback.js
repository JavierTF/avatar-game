import * as THREE from 'three';

const COLORS = {
    red:   0xff2222,
    blue:  0x2255ff,
    green: 0x22cc55,
};

export class PlayerFeedback {
    constructor(scene) {
        this.scene    = scene;
        this._effects = [];
    }

    spawn(type, playerPos) {
        const color = COLORS[type] ?? 0xffffff;

        const geo  = new THREE.TorusGeometry(0.5, 0.04, 8, 48);
        const mat  = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.9, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(playerPos);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);

        this._effects.push({ mesh, life: 1.0, scale: 1.0 });
    }

    update(delta) {
        for (let i = this._effects.length - 1; i >= 0; i--) {
            const e = this._effects[i];
            e.life  -= delta * 2.5;
            e.scale += delta * 6;
            e.mesh.scale.setScalar(e.scale);
            e.mesh.material.opacity = Math.max(0, e.life * 0.9);

            if (e.life <= 0) {
                this.scene.remove(e.mesh);
                e.mesh.geometry.dispose();
                e.mesh.material.dispose();
                this._effects.splice(i, 1);
            }
        }
    }
}
