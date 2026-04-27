import { describe, it, expect, beforeAll, vi } from 'vitest';
import { SoundFX } from '../js/sound.js';

// Captura llamadas para verificar comportamiento en init() y los disparos.
const calls = [];

beforeAll(() => {
    class FakeAudioContext {
        constructor() {
            calls.push(['ctor']);
            this.currentTime  = 0;
            this.destination  = {};
        }
        createOscillator() {
            calls.push(['createOscillator']);
            return {
                type: '',
                frequency: {
                    value: 0,
                    setValueAtTime(v) { calls.push(['osc.freq.setValueAtTime', v]); },
                    exponentialRampToValueAtTime(v) { calls.push(['osc.freq.ramp', v]); },
                },
                connect() { return this; },
                start() { calls.push(['osc.start']); },
                stop()  { calls.push(['osc.stop']);  },
            };
        }
        createGain() {
            calls.push(['createGain']);
            return {
                gain: {
                    setValueAtTime(v) { calls.push(['gain.setValueAtTime', v]); },
                    exponentialRampToValueAtTime() {},
                },
                connect() { return this; },
            };
        }
    }
    globalThis.window = globalThis.window || {};
    window.AudioContext = FakeAudioContext;
});

describe('SoundFX — inicialización', () => {
    it('arranca sin contexto y no rompe al llamar a métodos', () => {
        const s = new SoundFX();
        expect(s.ctx).toBeNull();
        expect(() => s.magic()).not.toThrow();
        expect(() => s.life()).not.toThrow();
        expect(() => s.negative()).not.toThrow();
    });

    it('init() crea un AudioContext', () => {
        calls.length = 0;
        const s = new SoundFX();
        s.init();
        expect(s.ctx).not.toBeNull();
        expect(calls[0]).toEqual(['ctor']);
    });

    it('init() es idempotente: llamarlo dos veces no crea otro contexto', () => {
        calls.length = 0;
        const s = new SoundFX();
        s.init();
        const ctxRef = s.ctx;
        s.init();
        expect(s.ctx).toBe(ctxRef);
        const ctorCalls = calls.filter(c => c[0] === 'ctor').length;
        expect(ctorCalls).toBe(1);
    });
});

describe('SoundFX — disparos', () => {
    it('magic() crea 2 osciladores (dos tonos superpuestos)', () => {
        calls.length = 0;
        const s = new SoundFX();
        s.init();
        s.magic();
        const oscCount = calls.filter(c => c[0] === 'createOscillator').length;
        expect(oscCount).toBe(2);
    });

    it('life() crea 3 osciladores (acorde mayor C-E-G)', () => {
        calls.length = 0;
        const s = new SoundFX();
        s.init();
        s.life();
        const oscCount = calls.filter(c => c[0] === 'createOscillator').length;
        expect(oscCount).toBe(3);
    });

    it('negative() crea 1 oscilador con barrido de pitch (220 → 80 Hz)', () => {
        calls.length = 0;
        const s = new SoundFX();
        s.init();
        s.negative();
        const oscCount = calls.filter(c => c[0] === 'createOscillator').length;
        expect(oscCount).toBe(1);
        // Comprobamos que se programó un setValueAtTime y un ramp
        const setVals = calls.filter(c => c[0] === 'osc.freq.setValueAtTime').map(c => c[1]);
        const ramps   = calls.filter(c => c[0] === 'osc.freq.ramp').map(c => c[1]);
        expect(setVals).toContain(220);
        expect(ramps).toContain(80);
    });

    it('los métodos no rompen si el contexto falla al construirse', () => {
        const oldCtx = window.AudioContext;
        window.AudioContext = class { constructor() { throw new Error('no audio'); } };
        const s = new SoundFX();
        s.init();
        expect(s.ctx).toBeNull();
        expect(() => s.magic()).not.toThrow();
        expect(() => s.life()).not.toThrow();
        expect(() => s.negative()).not.toThrow();
        window.AudioContext = oldCtx;
    });
});
