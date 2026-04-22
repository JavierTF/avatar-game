import * as THREE from 'three';

const _head = new THREE.Vector3();
const _prevHead = new THREE.Vector3();
const _prevC1   = new THREE.Vector3();
const _prevC2   = new THREE.Vector3();

export class Player {
    constructor(config = {}) {
        const cfg     = config.player || {};
        this.maxVida  = cfg.maxVida      ?? 5;
        this.vida     = cfg.vidaInicial  ?? this.maxVida;
        this.maxMana  = cfg.maxMana      ?? 100;
        this.mana     = cfg.manaInicial  ?? 0;
        this._manaGananciaAzul = cfg.manaGananciaAzul ?? 8;
        this._puntosAzul       = cfg.puntosAzul       ?? 10;
        this.puntos   = 0;
        this.combo    = 0;
        this.maxCombo = 0;
        this.vivo     = true;
        this.manaGastado = 0;

        // Métricas de movimiento
        this.metros                = 0;
        this.metrosBrazoDch        = 0;
        this.metrosBrazoIzq        = 0;
        this.velocidadMaxCabeza    = 0;
        this.velocidadMaxBrazoDch  = 0;
        this.velocidadMaxBrazoIzq  = 0;
        this.agachadas             = 0;
        this.saltos                = 0;
        this.desplazamientoLateral = 0;
        this.tiempoActivo          = 0;
        this.tiempoTotal           = 0;

        // Rangos y altura de cabeza
        this._headYMax  = -Infinity;
        this._headYMin  =  Infinity;
        this._headXMax  = -Infinity;
        this._headXMin  =  Infinity;
        this._headZMax  = -Infinity;
        this._headZMin  =  Infinity;
        this._headYSum    = 0;
        this._headSamples = 0;

        // Altura máxima y alcance máximo por cada brazo
        this._c1YMax     = -Infinity;
        this._c2YMax     = -Infinity;
        this._c1ReachMax = 0;
        this._c2ReachMax = 0;

        // Estado interno de tracking
        this._headInit     = false;
        this._c1Init       = false;
        this._c2Init       = false;
        this._headYHigh    = null;
        this._inSquat      = false;
        this._headYNeutral = null;
        this._inJump       = false;
    }

    addMana(v) {
        this.mana = Math.min(this.maxMana, this.mana + v);
    }

    consumeMana(pct) {
        const cost = this.maxMana * pct;
        if (this.mana < cost) return false;
        this.mana -= cost;
        this.manaGastado += cost;
        return true;
    }

    hit() {
        this.vida--;
        this.combo = 0;
        if (this.vida <= 0) this.vivo = false;
    }

    heal() {
        this.vida = Math.min(this.maxVida, this.vida + 1);
    }

    hitBlue() {
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        const mult = 1 + Math.floor(this.combo / 3) * 0.5;
        this.puntos += Math.round(this._puntosAzul * mult);
        this.addMana(this._manaGananciaAzul);
    }

    // Llamar cada frame con la cámara, posiciones de mandos y delta de tiempo
    updateMovimiento(camera, c1pos, c2pos, delta) {
        _head.setFromMatrixPosition(camera.matrixWorld);

        // ── Cabeza ──────────────────────────────────────────────────
        if (this._headInit) {
            const dHead = _head.distanceTo(_prevHead);
            this.metros += dHead;

            if (delta > 0) {
                const v = dHead / delta;
                if (v > this.velocidadMaxCabeza) this.velocidadMaxCabeza = v;
            }

            this.desplazamientoLateral += Math.abs(_head.x - _prevHead.x);

            // Tiempo activo: movimiento combinado > umbral
            const movC1 = (this._c1Init && c1pos) ? c1pos.distanceTo(_prevC1) : 0;
            const movC2 = (this._c2Init && c2pos) ? c2pos.distanceTo(_prevC2) : 0;
            this.tiempoTotal += delta;
            if (dHead + movC1 + movC2 > 0.005) this.tiempoActivo += delta;
        }

        // Rangos X/Y/Z
        if (_head.y > this._headYMax) this._headYMax = _head.y;
        if (_head.y < this._headYMin) this._headYMin = _head.y;
        if (_head.x > this._headXMax) this._headXMax = _head.x;
        if (_head.x < this._headXMin) this._headXMin = _head.x;
        if (_head.z > this._headZMax) this._headZMax = _head.z;
        if (_head.z < this._headZMin) this._headZMin = _head.z;

        // Altura promedio (muestreo continuo)
        this._headYSum += _head.y;
        this._headSamples++;

        // Agachadas — referencia: altura máxima vista hasta ahora
        if (this._headYHigh === null) this._headYHigh = _head.y;
        if (_head.y > this._headYHigh) this._headYHigh = _head.y;
        if (!this._inSquat && _head.y < this._headYHigh - 0.30) {
            this._inSquat = true;
        } else if (this._inSquat && _head.y > this._headYHigh - 0.15) {
            this.agachadas++;
            this._inSquat = false;
        }

        // Saltos — referencia: "altura neutral" con media móvil lenta
        if (this._headYNeutral === null) this._headYNeutral = _head.y;
        if (!this._inJump) {
            // baseline se actualiza sólo cuando no está saltando
            this._headYNeutral = this._headYNeutral * 0.995 + _head.y * 0.005;
        }
        if (!this._inJump && _head.y > this._headYNeutral + 0.25) {
            this._inJump = true;
        } else if (this._inJump && _head.y < this._headYNeutral + 0.08) {
            this.saltos++;
            this._inJump = false;
        }

        _prevHead.copy(_head);
        this._headInit = true;

        // ── Brazos ───────────────────────────────────────────────────
        if (c1pos) {
            if (this._c1Init) {
                const d = c1pos.distanceTo(_prevC1);
                this.metrosBrazoDch += d;
                if (delta > 0) {
                    const v = d / delta;
                    if (v > this.velocidadMaxBrazoDch) this.velocidadMaxBrazoDch = v;
                }
            }
            if (c1pos.y > this._c1YMax) this._c1YMax = c1pos.y;
            const reach1 = _head.distanceTo(c1pos);
            if (reach1 > this._c1ReachMax) this._c1ReachMax = reach1;
            _prevC1.copy(c1pos);
            this._c1Init = true;
        }

        if (c2pos) {
            if (this._c2Init) {
                const d = c2pos.distanceTo(_prevC2);
                this.metrosBrazoIzq += d;
                if (delta > 0) {
                    const v = d / delta;
                    if (v > this.velocidadMaxBrazoIzq) this.velocidadMaxBrazoIzq = v;
                }
            }
            if (c2pos.y > this._c2YMax) this._c2YMax = c2pos.y;
            const reach2 = _head.distanceTo(c2pos);
            if (reach2 > this._c2ReachMax) this._c2ReachMax = reach2;
            _prevC2.copy(c2pos);
            this._c2Init = true;
        }
    }

    get rangoVertical() {
        return this._headYMax === -Infinity ? 0 :
            Math.round((this._headYMax - this._headYMin) * 100) / 100;
    }

    get rangoHorizontalX() {
        return this._headXMax === -Infinity ? 0 :
            Math.round((this._headXMax - this._headXMin) * 100) / 100;
    }

    get rangoProfundidadZ() {
        return this._headZMax === -Infinity ? 0 :
            Math.round((this._headZMax - this._headZMin) * 100) / 100;
    }

    get areaOcupada() {
        return Math.round(this.rangoHorizontalX * this.rangoProfundidadZ * 100) / 100;
    }

    get alturaPromedioCabeza() {
        return this._headSamples > 0
            ? Math.round((this._headYSum / this._headSamples) * 100) / 100
            : 0;
    }

    get velocidadMediaCabeza() {
        return this.tiempoTotal > 0 ? this.metros / this.tiempoTotal : 0;
    }

    get velocidadMediaBrazoDch() {
        return this.tiempoTotal > 0 ? this.metrosBrazoDch / this.tiempoTotal : 0;
    }

    get velocidadMediaBrazoIzq() {
        return this.tiempoTotal > 0 ? this.metrosBrazoIzq / this.tiempoTotal : 0;
    }

    get alturaMaxBrazoDch() {
        return this._c1YMax === -Infinity ? 0 : Math.round(this._c1YMax * 100) / 100;
    }

    get alturaMaxBrazoIzq() {
        return this._c2YMax === -Infinity ? 0 : Math.round(this._c2YMax * 100) / 100;
    }

    get alcanceMaxBrazoDch() {
        return Math.round(this._c1ReachMax * 100) / 100;
    }

    get alcanceMaxBrazoIzq() {
        return Math.round(this._c2ReachMax * 100) / 100;
    }

    // Ratio 0-1: 1 = simetría perfecta; menor si un brazo se movió bastante más que el otro.
    get simetriaBrazos() {
        const d = this.metrosBrazoDch;
        const i = this.metrosBrazoIzq;
        if (d === 0 && i === 0) return 1.0;
        const min = Math.min(d, i);
        const max = Math.max(d, i);
        return max > 0 ? Math.round((min / max) * 100) / 100 : 1.0;
    }

    get pctTiempoActivo() {
        return this.tiempoTotal > 0
            ? Math.round((this.tiempoActivo / this.tiempoTotal) * 100)
            : 0;
    }

    // Cualitativa: "bajo" (<40%), "medio" (40-70%), "alto" (>70%)
    get intensidad() {
        const pct = this.pctTiempoActivo;
        if (pct > 70) return 'alto';
        if (pct > 40) return 'medio';
        return 'bajo';
    }

    getState() {
        return {
            vida:   this.vida,
            mana:   Math.round(this.mana),
            puntos: this.puntos,
            combo:  this.combo,
            metros: Math.round(this.metros * 10) / 10,
        };
    }
}
