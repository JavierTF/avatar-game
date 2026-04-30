import * as THREE from 'three';

// Panel 3D que aparece al terminar la partida con un resumen de métricas.
// Centrado delante del jugador (X=0), a altura de cara (Y=1.6) y más cerca
// que el countdown (-2.5 frente a -4) para que se lea cómodo.
export const FINAL_PANEL_OFFSET = { x: 0, y: 1.6, z: -2.5 };

const CANVAS_W = 1024;
const CANVAS_H = 768;

function _renderToCanvas(player, nivel, metrics) {
    const canvas = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    // Fondo translúcido oscuro tipo overlay.
    ctx.fillStyle = 'rgba(20, 20, 40, 0.88)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Banda superior con título.
    ctx.fillStyle = '#88aaff';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIN DE PARTIDA', CANVAS_W / 2, 80);

    ctx.fillStyle = '#aaccff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`Nivel máximo: ${nivel}    Puntuación: ${player.puntos}`, CANVAS_W / 2, 150);

    // Cuerpo de la tabla — dos columnas.
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'left';

    const colLeftX  = 80;
    const colRightX = CANVAS_W / 2 + 40;
    let y = 230;
    const lineH = 45;

    const rojasEsquivadas = Math.max(0, metrics.reds.total - metrics.reds.hit);
    const metros = (player.metros || 0).toFixed(1);

    const left = [
        `Combo máximo: x${player.maxCombo}`,
        `Distancia: ${metros} m`,
        `Saltos: ${player.saltos}`,
        `Agachadas: ${player.agachadas}`,
        `Intensidad: ${player.intensidad}`,
        `Mana gastado: ${Math.round(player.manaGastado || 0)}`,
    ];
    const right = [
        `Rojas (esquivadas): ${rojasEsquivadas}/${metrics.reds.total}`,
        `Azules: ${metrics.blues.hit}/${metrics.blues.total}`,
        `Verdes: ${metrics.greens.hit}/${metrics.greens.total}`,
        `Racha máx. sin daño: ${metrics.rachaMaxSinDaño}`,
    ];

    let yL = y;
    for (const line of left) {
        ctx.fillText(line, colLeftX, yL);
        yL += lineH;
    }
    let yR = y;
    for (const line of right) {
        ctx.fillText(line, colRightX, yR);
        yR += lineH;
    }

    // Nota inferior.
    ctx.fillStyle = '#888';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Pulsa "Reiniciar" para volver a jugar', CANVAS_W / 2, CANVAS_H - 50);

    return new THREE.CanvasTexture(canvas);
}

export class FinalMetricsPanel {
    constructor(scene) {
        this.scene   = scene;
        this._sprite = null;
    }

    show(player, nivel, metrics, cameraPos) {
        // Idempotente: si ya hay panel, lo retiramos y re-creamos con datos frescos.
        if (this._sprite) this.hide();

        const tex = _renderToCanvas(player, nivel, metrics);
        const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 1.0, depthTest: false,
        });
        this._sprite = new THREE.Sprite(mat);
        // Aspect 4:3 a escala generosa para verlo bien en VR.
        this._sprite.scale.set(2.4, 1.8, 1);
        this._sprite.position.set(
            cameraPos.x + FINAL_PANEL_OFFSET.x,
            FINAL_PANEL_OFFSET.y,
            cameraPos.z + FINAL_PANEL_OFFSET.z,
        );
        this.scene.add(this._sprite);
    }

    hide() {
        if (!this._sprite) return;
        this.scene.remove(this._sprite);
        if (this._sprite.material.map && typeof this._sprite.material.map.dispose === 'function') {
            this._sprite.material.map.dispose();
        }
        this._sprite.material.dispose();
        this._sprite = null;
    }
}
