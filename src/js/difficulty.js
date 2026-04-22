export class Difficulty {
    constructor(nivelInicial = 1) {
        this.nivel       = nivelInicial;
        this.speedMult   = Math.pow(1.15, nivelInicial - 1);
        this._elapsed    = 0;
        this.INTERVAL    = 15;
        this.SPEED_INC   = 0.15;
        this.onChange    = null;
    }

    update(delta) {
        this._elapsed += delta;
        if (this._elapsed >= this.INTERVAL) {
            this._elapsed -= this.INTERVAL;
            this.nivel++;
            this.speedMult *= (1 + this.SPEED_INC);
            if (this.onChange) this.onChange(this.nivel, this.speedMult);
        }
    }

    manaCost(base1, base2, base3) {
        if (this.nivel === 1) return base1;
        if (this.nivel === 2) return base2;
        return base3;
    }

    spawnRate() {
        return Math.max(0.4, 2.0 - (this.nivel - 1) * 0.15);
    }
}
