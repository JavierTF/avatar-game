import * as THREE from 'three';

const COLORS = {
    red:   0xff2222,
    blue:  0x2255ff,
    green: 0x22cc55,
};

function makeTextSprite(text, hexColor) {
    const canvas  = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `#${hexColor.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1.0, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.6, 0.3, 1);
    return sprite;
}

export class PlayerFeedback {
    constructor(scene) {
        this.scene    = scene;
        this._effects = [];
    }

    spawn(type, playerPos, text = '') {
        const color = COLORS[type] ?? 0xffffff;

        // Halo expansivo
        const geo  = new THREE.TorusGeometry(0.5, 0.04, 8, 48);
        const mat  = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.45, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(playerPos);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);

        // Texto flotante con la métrica
        let sprite = null;
        if (text) {
            sprite = makeTextSprite(text, color);
            sprite.position.set(playerPos.x, playerPos.y + 0.4, playerPos.z);
            this.scene.add(sprite);
        }

        this._effects.push({ mesh, sprite, life: 1.0, scale: 1.0 });
    }

    update(delta) {
        for (let i = this._effects.length - 1; i >= 0; i--) {
            const e = this._effects[i];
            e.life  -= delta * 2.5;
            e.scale += delta * 6;

            e.mesh.scale.setScalar(e.scale);
            e.mesh.material.opacity = Math.max(0, e.life * 0.45);

            if (e.sprite) {
                e.sprite.position.y += delta * 0.8; // flota hacia arriba
                e.sprite.material.opacity = Math.max(0, e.life);
            }

            if (e.life <= 0) {
                this.scene.remove(e.mesh);
                e.mesh.geometry.dispose();
                e.mesh.material.dispose();
                if (e.sprite) {
                    this.scene.remove(e.sprite);
                    e.sprite.material.map.dispose();
                    e.sprite.material.dispose();
                }
                this._effects.splice(i, 1);
            }
        }
    }
}
