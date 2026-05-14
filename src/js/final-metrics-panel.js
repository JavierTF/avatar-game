import * as THREE from 'three';

// Panel 3D que aparece al terminar la partida con un resumen completo de
// métricas. Centrado delante del jugador (X=0), a altura de cara (Y=1.6) y
// más cerca que el countdown (z=-2.5) para que se lea cómodo.
export const FINAL_PANEL_OFFSET = { x: 0, y: 1.6, z: -2.5 };

const CANVAS_W = 1600;
const CANVAS_H = 1200;

function _r1(n) { return Math.round(n * 10) / 10; }
function _r2(n) { return Math.round(n * 100) / 100; }

function _renderToCanvas(player, nivel, metrics) {
    const canvas = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    // Fondo translúcido oscuro tipo overlay.
    ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Banda superior con título.
    ctx.fillStyle = '#88aaff';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIN DE PARTIDA', CANVAS_W / 2, 60);

    // Subtítulo: Nivel + Puntos + Tiempo.
    const elapsed = Math.max(0, Math.round((Date.now() - (metrics.startTime || Date.now())) / 1000));
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    ctx.fillStyle = '#aaccff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(
        `Nivel máximo: ${nivel}    Puntuación: ${player.puntos}    Tiempo: ${mins}m ${secs}s`,
        CANVAS_W / 2, 115
    );

    // 3 columnas: Cuerpo / Brazos / Bolas+Poderes
    const colW = CANVAS_W / 3;
    const col1 = 40;
    const col2 = colW + 40;
    const col3 = colW * 2 + 40;
    const headY = 175;
    const lineH = 32;

    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';

    // ── COLUMNA 1: General + Cuerpo / cabeza ───────────────────────────
    ctx.fillStyle = '#88ffaa';
    ctx.fillText('GENERAL', col1, headY);
    ctx.fillStyle = '#eeeeee';
    ctx.font = '24px Arial';
    let y = headY + lineH;
    ctx.fillText(`Combo máximo: x${player.maxCombo}`, col1, y); y += lineH;
    ctx.fillText(`Intensidad: ${player.intensidad}`, col1, y); y += lineH;
    ctx.fillText(`Mana gastado: ${Math.round(player.manaGastado || 0)}`, col1, y); y += lineH;

    y += lineH * 0.5;
    ctx.fillStyle = '#88ffaa';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('CUERPO / CABEZA', col1, y); y += lineH;
    ctx.fillStyle = '#eeeeee';
    ctx.font = '24px Arial';
    ctx.fillText(`Distancia: ${_r1(player.metros || 0)} m`, col1, y); y += lineH;
    ctx.fillText(`Velocidad máx: ${_r2(player.velocidadMaxCabeza || 0)} m/s`, col1, y); y += lineH;
    ctx.fillText(`Velocidad media: ${_r2(player.velocidadMediaCabeza || 0)} m/s`, col1, y); y += lineH;
    ctx.fillText(`Altura promedio: ${_r2(player.alturaPromedioCabeza || 0)} m`, col1, y); y += lineH;
    ctx.fillText(`Rango vertical (Y): ${_r2(player.rangoVertical || 0)} m`, col1, y); y += lineH;
    ctx.fillText(`Rango lateral (X): ${_r2(player.rangoHorizontalX || 0)} m`, col1, y); y += lineH;
    ctx.fillText(`Rango profundidad (Z): ${_r2(player.rangoProfundidadZ || 0)} m`, col1, y); y += lineH;
    ctx.fillText(`Área ocupada: ${_r2(player.areaOcupada || 0)} m²`, col1, y); y += lineH;
    ctx.fillText(`Saltos: ${player.saltos}`, col1, y); y += lineH;
    ctx.fillText(`Agachadas: ${player.agachadas}`, col1, y); y += lineH;
    ctx.fillText(`Desplazamiento lateral: ${_r1(player.desplazamientoLateral || 0)} m`, col1, y); y += lineH;
    ctx.fillText(`Tiempo en movimiento: ${player.pctTiempoActivo || 0}%`, col1, y); y += lineH;

    // ── COLUMNA 2: Brazos ──────────────────────────────────────────────
    ctx.fillStyle = '#88ffaa';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BRAZOS', col2, headY);
    ctx.fillStyle = '#eeeeee';
    ctx.font = '22px Arial';
    y = headY + lineH;
    ctx.fillText(`              Derecho   Izquierdo`, col2, y); y += lineH;
    ctx.fillText(`Distancia:    ${_r1(player.metrosBrazoDch || 0)} m     ${_r1(player.metrosBrazoIzq || 0)} m`, col2, y); y += lineH;
    ctx.fillText(`Vel. máxima:  ${_r2(player.velocidadMaxBrazoDch || 0)} m/s   ${_r2(player.velocidadMaxBrazoIzq || 0)} m/s`, col2, y); y += lineH;
    ctx.fillText(`Vel. media:   ${_r2(player.velocidadMediaBrazoDch || 0)} m/s  ${_r2(player.velocidadMediaBrazoIzq || 0)} m/s`, col2, y); y += lineH;
    ctx.fillText(`Altura máx:   ${_r2(player.alturaMaxBrazoDch || 0)} m     ${_r2(player.alturaMaxBrazoIzq || 0)} m`, col2, y); y += lineH;
    ctx.fillText(`Alcance máx:  ${_r2(player.alcanceMaxBrazoDch || 0)} m     ${_r2(player.alcanceMaxBrazoIzq || 0)} m`, col2, y); y += lineH;
    ctx.font = '24px Arial';
    ctx.fillText(`Simetría D/I: ${_r2(player.simetriaBrazos || 0)}`, col2, y); y += lineH;

    // ── COLUMNA 3: Bolas + Poderes ─────────────────────────────────────
    ctx.fillStyle = '#88ffaa';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('BOLAS', col3, headY);
    ctx.fillStyle = '#eeeeee';
    ctx.font = '24px Arial';
    y = headY + lineH;
    const rojasEsquivadas = Math.max(0, metrics.reds.total - metrics.reds.hit);
    ctx.fillText(`Rojas (esquivadas): ${rojasEsquivadas}/${metrics.reds.total}`, col3, y); y += lineH;
    ctx.fillText(`Azules: ${metrics.blues.hit}/${metrics.blues.total}`, col3, y); y += lineH;
    ctx.fillText(`Racha máx. sin daño: ${metrics.rachaMaxSinDaño}`, col3, y); y += lineH;

    y += lineH * 0.5;
    ctx.fillStyle = '#88ffaa';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('PODERES', col3, y); y += lineH;
    ctx.fillStyle = '#eeeeee';
    ctx.font = '22px Arial';
    ctx.fillText(`              Usado  Eliminados`, col3, y); y += lineH;
    const powers = metrics.powers || {};
    for (const name of ['escudo', 'sismico', 'llama', 'viento']) {
        const p = powers[name] || { used: 0, killed: 0 };
        const padded = name.padEnd(13, ' ');
        ctx.fillText(`${padded} ${p.used}      ${p.killed}`, col3, y);
        y += lineH;
    }

    // Pie.
    ctx.fillStyle = '#888';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sesión finalizada', CANVAS_W / 2, CANVAS_H - 30);

    return new THREE.CanvasTexture(canvas);
}

export class FinalMetricsPanel {
    constructor(scene) {
        this.scene   = scene;
        this._sprite = null;
    }

    show(player, nivel, metrics, cameraPos) {
        if (this._sprite) this.hide();

        const tex = _renderToCanvas(player, nivel, metrics);
        const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 1.0, depthTest: false,
        });
        this._sprite = new THREE.Sprite(mat);
        // Aspect 4:3 más grande para que se lean los 3 columnas.
        this._sprite.scale.set(3.6, 2.7, 1);
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
