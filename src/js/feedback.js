import * as THREE from 'three';

const COLORS = {
    red:   0xff2222,
    blue:  0x2255ff,
    green: 0x22cc55,
};

function hexToRGB(hex) {
    return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

// Destello circular con degradado radial, siempre de cara a la cámara.
function makeGlowSprite(hexColor) {
    const canvas  = document.createElement('canvas');
    canvas.width  = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const { r, g, b } = hexToRGB(hexColor);

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, `rgba(${r},${g},${b},0.85)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex    = new THREE.CanvasTexture(canvas);
    const mat    = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.6, 0.6, 1);
    return sprite;
}

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

    // `hitPos` es la última posición en la que el jugador vio la bola.
    spawn(type, hitPos, text = '') {
        const color = COLORS[type] ?? 0xffffff;

        const halo = makeGlowSprite(color);
        halo.position.copy(hitPos);
        this.scene.add(halo);

        let textSprite = null;
        if (text) {
            textSprite = makeTextSprite(text, color);
            textSprite.position.set(hitPos.x, hitPos.y + 0.35, hitPos.z);
            this.scene.add(textSprite);
        }

        // Conservamos `mesh`/`sprite` como alias hacia halo/text por
        // compatibilidad con el resto de consumidores y los tests.
        this._effects.push({
            mesh:   halo,
            sprite: textSprite,
            halo,
            text:   textSprite,
            life:   1.0,
            scale:  0.6,
        });
    }

    update(delta) {
        for (let i = this._effects.length - 1; i >= 0; i--) {
            const e = this._effects[i];
            e.life  -= delta * 2.5;
            e.scale += delta * 1.2; // expansión suave del destello

            e.halo.scale.set(e.scale, e.scale, 1);
            e.halo.material.opacity = Math.max(0, e.life * 0.9);

            if (e.text) {
                e.text.position.y += delta * 0.6;
                e.text.material.opacity = Math.max(0, e.life);
            }

            if (e.life <= 0) {
                this.scene.remove(e.halo);
                e.halo.material.map.dispose();
                e.halo.material.dispose();
                if (e.text) {
                    this.scene.remove(e.text);
                    e.text.material.map.dispose();
                    e.text.material.dispose();
                }
                this._effects.splice(i, 1);
            }
        }
    }
}
