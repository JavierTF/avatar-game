import * as THREE from 'three';

const _prev = new THREE.Vector3();
const _curr = new THREE.Vector3();

export class Player {
    constructor(config = {}) {
        const cfg     = config.player || {};
        this.maxVida  = cfg.maxVida      ?? 5;
        this.vida     = cfg.vidaInicial  ?? this.maxVida;
        this.mana     = 0;
        this.maxMana  = cfg.maxMana      ?? 100;
        this._manaGananciaAzul = cfg.manaGananciaAzul ?? 8;
        this._puntosAzul       = cfg.puntosAzul       ?? 10;
        this.puntos   = 0;
        this.combo    = 0;
        this.maxCombo = 0;
        this.metros   = 0;
        this.vivo     = true;
        this._prevHead = null;
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

    updateMetros(camera) {
        _curr.setFromMatrixPosition(camera.matrixWorld);
        if (this._prevHead) {
            this.metros += _curr.distanceTo(this._prevHead);
        }
        if (!this._prevHead) this._prevHead = new THREE.Vector3();
        this._prevHead.copy(_curr);
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
