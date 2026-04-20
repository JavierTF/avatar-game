import * as THREE from 'three';

const _prev1 = new THREE.Vector3();
const _prev2 = new THREE.Vector3();
const _curr1 = new THREE.Vector3();
const _curr2 = new THREE.Vector3();
const _delta1 = new THREE.Vector3();
const _delta2 = new THREE.Vector3();

export class GestureDetector {
    constructor(config) {
        this.config     = config;
        this._init1     = false;
        this._init2     = false;
        this._cooldowns = {};
        this.COOLDOWN   = 1.0;
        this._timers    = {};
    }

    update(delta, c1, c2) {
        for (const k in this._timers) {
            this._timers[k] = Math.max(0, (this._timers[k] || 0) - delta);
        }

        _curr1.setFromMatrixPosition(c1.matrixWorld);
        _curr2.setFromMatrixPosition(c2.matrixWorld);

        if (!this._init1) { _prev1.copy(_curr1); this._init1 = true; }
        if (!this._init2) { _prev2.copy(_curr2); this._init2 = true; }

        _delta1.subVectors(_curr1, _prev1);
        _delta2.subVectors(_curr2, _prev2);

        _prev1.copy(_curr1);
        _prev2.copy(_curr2);

        return { delta1: _delta1.clone(), delta2: _delta2.clone(), pos1: _curr1.clone(), pos2: _curr2.clone() };
    }

    check(gestureName, delta1, delta2) {
        if ((this._timers[gestureName] || 0) > 0) return false;
        const g = this.config.gestures[gestureName];
        if (!g) return false;

        const dir = new THREE.Vector3(...g.direction).normalize();
        const speed = g.minSpeed;

        if (g.twoHands) {
            const match1 = delta1.dot(dir) > speed;
            const match2 = delta2.dot(dir) > speed;

            if (gestureName === 'power_viento') {
                const sep = _curr2.distanceTo(_curr1);
                const prevSep = _prev2.distanceTo(_prev1);
                const expanding = sep - prevSep > speed;
                if (expanding) { this._timers[gestureName] = this.COOLDOWN; return true; }
                return false;
            }

            if (match1 && match2) { this._timers[gestureName] = this.COOLDOWN; return true; }
            return false;
        }

        if (delta1.dot(dir) > speed || delta2.dot(dir) > speed) {
            this._timers[gestureName] = this.COOLDOWN;
            return true;
        }
        return false;
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
