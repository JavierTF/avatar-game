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

        // Métricas de movimiento
        this.metros                = 0;
        this.metrosBrazoDch        = 0;
        this.metrosBrazoIzq        = 0;
        this.velocidadMaxCabeza    = 0;
        this.velocidadMaxBrazoDch  = 0;
        this.velocidadMaxBrazoIzq  = 0;
        this.agachadas             = 0;
        this.desplazamientoLateral = 0;
        this.tiempoActivo          = 0;
        this.tiempoTotal           = 0;

        // Estado interno de tracking
        this._headInit  = false;
        this._c1Init    = false;
        this._c2Init    = false;
        this._headYMax  = -Infinity;
        this._headYMin  =  Infinity;
        this._headYHigh = null;
        this._inSquat   = false;
    }

    addMana(v) {
        this.mana = Math.min(this.maxMana, this.mana + v);
    }

    consumeMana(pct) {
        const cost = this.maxMana * pct;
        if (this.mana < cost) return false;
        this.mana -= cost;
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

        // Rango vertical
        if (_head.y > this._headYMax) this._headYMax = _head.y;
        if (_head.y < this._headYMin) this._headYMin = _head.y;

        // Agachadas
        if (this._headYHigh === null) this._headYHigh = _head.y;
        if (_head.y > this._headYHigh) this._headYHigh = _head.y;
        if (!this._inSquat && _head.y < this._headYHigh - 0.30) {
            this._inSquat = true;
        } else if (this._inSquat && _head.y > this._headYHigh - 0.15) {
            this.agachadas++;
            this._inSquat = false;
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
            _prevC2.copy(c2pos);
            this._c2Init = true;
        }
    }

    get rangoVertical() {
        return this._headYMax === -Infinity ? 0 :
            Math.round((this._headYMax - this._headYMin) * 100) / 100;
    }

    get pctTiempoActivo() {
        return this.tiempoTotal > 0
            ? Math.round((this.tiempoActivo / this.tiempoTotal) * 100)
            : 0;
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
