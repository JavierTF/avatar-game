import * as THREE from 'three';

// Offset relativo a la cámara — el contador queda fijo en mundo, en una
// posición a la izquierda del jugador (los popups de vida/mana van a +1.5
// en X; este va a -1.5 para no obstruirlos), arriba (Y=2.4) y 4m delante.
export const COUNTDOWN_OFFSET = { x: -1.5, y: 2.4, z: -4.0 };

const CANVAS_W = 256;
const CANVAS_H = 128;

function _makeTextTexture(text, hexColor) {
    const canvas  = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = `#${hexColor.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 96px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    return new THREE.CanvasTexture(canvas);
}

export class CountdownHUD {
    constructor(scene) {
        this.scene = scene;
        this.currentText = '';
        const tex = _makeTextTexture('60', 0xffffff);
        const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 1.0, depthTest: false,
        });
        this._sprite = new THREE.Sprite(mat);
        this._sprite.scale.set(0.9, 0.45, 1);
        this._sprite.position.set(
            COUNTDOWN_OFFSET.x,
            COUNTDOWN_OFFSET.y,
            COUNTDOWN_OFFSET.z,
        );
        this.currentText = '60';
        scene.add(this._sprite);
    }

    update(remainingSeconds, cameraPos) {
        if (!this._sprite) return;  // ya disposed → no-op
        const secs = Math.max(0, Math.ceil(remainingSeconds));
        const text = String(secs);

        // Posición fija relativa a la cámara — recalculada cada frame.
        this._sprite.position.set(
            cameraPos.x + COUNTDOWN_OFFSET.x,
            COUNTDOWN_OFFSET.y,
            cameraPos.z + COUNTDOWN_OFFSET.z,
        );

        if (text === this.currentText) return;
        // Cambió el segundo — regenera la textura.
        const oldMap = this._sprite.material.map;
        const newMap = _makeTextTexture(text, 0xffffff);
        this._sprite.material.map = newMap;
        this._sprite.material.needsUpdate = true;
        if (oldMap && typeof oldMap.dispose === 'function') oldMap.dispose();
        this.currentText = text;
    }

    dispose() {
        if (!this._sprite) return;  // idempotente
        this.scene.remove(this._sprite);
        if (this._sprite.material.map && typeof this._sprite.material.map.dispose === 'function') {
            this._sprite.material.map.dispose();
        }
        this._sprite.material.dispose();
        this._sprite = null;
    }
}
