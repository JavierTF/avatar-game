// Efectos de sonido cortos generados sintéticamente con Web Audio API.
// No requiere assets — todo se genera en runtime con osciladores.
export class SoundFX {
    constructor() {
        this.ctx = null;
    }

    // Debe llamarse tras un gesto del usuario (click) por las políticas de
    // autoplay de los navegadores modernos.
    init() {
        if (this.ctx) return;
        const Ctx = typeof window !== 'undefined'
            ? (window.AudioContext || window.webkitAudioContext)
            : null;
        if (!Ctx) return;
        try { this.ctx = new Ctx(); } catch (_) { this.ctx = null; }
    }

    _tone(freq, duration, type = 'sine', startGain = 0.18, delay = 0) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(startGain, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    }

    // Azul — "magia": dos tonos brillantes superpuestos.
    magic() {
        this._tone(880,  0.14, 'sine',     0.15);
        this._tone(1320, 0.14, 'triangle', 0.10);
    }

    // Roja — "negativo": tono bajo con caída de pitch.
    negative() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
    }
}
