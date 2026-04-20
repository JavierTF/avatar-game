import * as THREE from 'three';

const _prev1  = new THREE.Vector3();
const _prev2  = new THREE.Vector3();
const _curr1  = new THREE.Vector3();
const _curr2  = new THREE.Vector3();
const _delta1 = new THREE.Vector3();
const _delta2 = new THREE.Vector3();

export class GestureDetector {
    constructor(config) {
        this.config       = config;
        this._init1       = false;
        this._init2       = false;
        this._timers      = {};
        this.COOLDOWN     = 1.0;
        this._pos1        = new THREE.Vector3();
        this._pos2        = new THREE.Vector3();
        this._prevSep     = 0;
        // Llama: detección en dos fases (recoger → empujar)
        this._llamaPhase  = 0;
        this._llamaTimer  = 0;
    }

    update(delta, c1, c2) {
        for (const k in this._timers) {
            this._timers[k] = Math.max(0, (this._timers[k] || 0) - delta);
        }

        if (this._llamaPhase === 1) {
            this._llamaTimer -= delta;
            if (this._llamaTimer <= 0) this._llamaPhase = 0;
        }

        _curr1.setFromMatrixPosition(c1.matrixWorld);
        _curr2.setFromMatrixPosition(c2.matrixWorld);

        if (!this._init1) { _prev1.copy(_curr1); this._init1 = true; }
        if (!this._init2) { _prev2.copy(_curr2); this._init2 = true; }

        _delta1.subVectors(_curr1, _prev1);
        _delta2.subVectors(_curr2, _prev2);

        this._pos1.copy(_curr1);
        this._pos2.copy(_curr2);
        this._prevSep = _prev1.distanceTo(_prev2);

        _prev1.copy(_curr1);
        _prev2.copy(_curr2);

        return {
            delta1: _delta1.clone(),
            delta2: _delta2.clone(),
            pos1:   _curr1.clone(),
            pos2:   _curr2.clone(),
        };
    }

    check(gestureName, delta1, delta2) {
        if ((this._timers[gestureName] || 0) > 0) return false;

        let detected = false;
        if      (gestureName === 'power_escudo')  detected = this._checkEscudo(delta1, delta2);
        else if (gestureName === 'power_sismico') detected = this._checkSismico(delta1, delta2);
        else if (gestureName === 'power_llama')   detected = this._checkLlama(delta1, delta2);
        else if (gestureName === 'power_viento')  detected = this._checkViento();
        else                                      detected = this._checkConfig(gestureName, delta1, delta2);

        if (detected) this._timers[gestureName] = this.COOLDOWN;
        return detected;
    }

    // Brazos hacia arriba cruzándose: ambos suben (Y+) y se mueven en X opuestas
    _checkEscudo(delta1, delta2) {
        const upSpeed    = 0.025;
        const crossSpeed = 0.010;
        const bothUp     = delta1.y > upSpeed && delta2.y > upSpeed;
        const crossing   = (delta1.x >  crossSpeed && delta2.x < -crossSpeed) ||
                           (delta1.x < -crossSpeed && delta2.x >  crossSpeed);
        return bothUp && crossing;
    }

    // Casi arrodillarse: mandos muy bajos (y < 0.5m) bajando rápido
    _checkSismico(delta1, delta2) {
        const downSpeed = 0.030;
        const lowEnough = this._pos1.y < 0.5 && this._pos2.y < 0.5;
        const goingDown = delta1.y < -downSpeed && delta2.y < -downSpeed;
        return lowEnough && goingDown;
    }

    // Dos fases: 1) recoger brazos hacia atrás (+Z), 2) empujar hacia adelante (-Z)
    _checkLlama(delta1, delta2) {
        const speed = 0.025;
        if (this._llamaPhase === 0) {
            if (delta1.z > speed && delta2.z > speed) {
                this._llamaPhase = 1;
                this._llamaTimer = 1.5;
            }
            return false;
        } else {
            if (delta1.z < -speed && delta2.z < -speed) {
                this._llamaPhase = 0;
                return true;
            }
            return false;
        }
    }

    // Separar mandos en diagonal: distancia creciente Y uno más alto que el otro
    _checkViento() {
        const sep       = this._pos1.distanceTo(this._pos2);
        const expanding = (sep - this._prevSep) > 0.006;
        const diagonal  = Math.abs(this._pos1.y - this._pos2.y) > 0.25;
        return expanding && diagonal;
    }

    _checkConfig(gestureName, delta1, delta2) {
        const g = this.config.gestures[gestureName];
        if (!g) return false;
        const dir   = new THREE.Vector3(...g.direction).normalize();
        const speed = g.minSpeed;
        if (g.twoHands) {
            return delta1.dot(dir) > speed && delta2.dot(dir) > speed;
        }
        return delta1.dot(dir) > speed || delta2.dot(dir) > speed;
    }

    checkGreenActivate(delta1, delta2, held1, held2) {
        const g = this.config.gestures['green_activate'];
        if (!g) return { c1: false, c2: false };
        const dir = new THREE.Vector3(...g.direction).normalize();
        const spd = g.minSpeed;
        return {
            c1: held1 && delta1.dot(dir) > spd,
            c2: held2 && delta2.dot(dir) > spd,
        };
    }
}
