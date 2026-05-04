import { describe, it, expect } from 'vitest';
import { TriggerDebouncer, MIN_HOLD_MS } from '../js/trigger-debounce.js';

describe('TriggerDebouncer — constantes', () => {
    it('MIN_HOLD_MS es 100ms (umbral por defecto)', () => {
        expect(MIN_HOLD_MS).toBe(100);
    });
});

describe('TriggerDebouncer — release sin press previo', () => {
    it('devuelve true (no hay info, mejor aceptarlo que perder un drop legítimo)', () => {
        const d = new TriggerDebouncer();
        expect(d.onRelease(1, 1000)).toBe(true);
    });
});

describe('TriggerDebouncer — release tras press', () => {
    it('release inmediato (<100ms) → false (espurio, se ignora)', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        expect(d.onRelease(1, 1050)).toBe(false);  // 50ms < 100ms
    });

    it('release a exactamente 100ms → true (≥ umbral, válido)', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        expect(d.onRelease(1, 1100)).toBe(true);
    });

    it('release a 99ms → false (justo por debajo del umbral)', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        expect(d.onRelease(1, 1099)).toBe(false);
    });

    it('release tras 1 segundo → true (claramente real)', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        expect(d.onRelease(1, 2000)).toBe(true);
    });
});

describe('TriggerDebouncer — independencia entre mandos', () => {
    it('mando 1 y 2 se trackean por separado', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        d.onPress(2, 1100);
        expect(d.onRelease(1, 1050)).toBe(false);  // 50ms en mando 1
        expect(d.onRelease(2, 1300)).toBe(true);   // 200ms en mando 2
    });

    it('un release en mando 1 no afecta el estado de mando 2', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        d.onPress(2, 1000);
        d.onRelease(1, 1500);  // real release ctrl1
        expect(d.onRelease(2, 1010)).toBe(false);  // mando 2 sigue trackeado: 10ms espurio
    });
});

describe('TriggerDebouncer — limpieza de estado tras release', () => {
    it('tras release válido, un segundo release sin press intermedio → true', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        d.onRelease(1, 1500);                      // real release
        expect(d.onRelease(1, 1600)).toBe(true);   // sin press, acepta
    });

    it('tras release ESPURIO (rechazado), un segundo release sin press → true', () => {
        const d = new TriggerDebouncer();
        d.onPress(1, 1000);
        d.onRelease(1, 1050);                      // espurio (rechazado)
        // Estado debe limpiarse igual que si hubiese sido válido — el press
        // efectivamente terminó (XR ya emitió selectend) aunque lo ignoremos.
        expect(d.onRelease(1, 1500)).toBe(true);   // sin press intermedio
    });
});

describe('TriggerDebouncer — umbral configurable', () => {
    it('constructor acepta minHoldMs custom', () => {
        const d = new TriggerDebouncer(50);
        d.onPress(1, 0);
        expect(d.onRelease(1, 30)).toBe(false);
        expect(d.onRelease(1, 60)).toBe(true);
    });

    it('minHoldMs=0 nunca rechaza (debouncing desactivado)', () => {
        const d = new TriggerDebouncer(0);
        d.onPress(1, 0);
        expect(d.onRelease(1, 0)).toBe(true);  // 0ms ≥ 0
    });
});

describe('TriggerDebouncer — uso típico en flujo XR (escenario espurio)', () => {
    it('press → release espurio → press real → release real: el grab persiste tras el espurio', () => {
        const d = new TriggerDebouncer();
        // Press real (jugador aprieta el gatillo).
        d.onPress(1, 0);
        // 30ms después el XR emite selectend espurio.
        const r1 = d.onRelease(1, 30);
        expect(r1).toBe(false);  // ignorado
        // Inmediatamente XR emite otro selectstart espurio (continúa el "press real").
        d.onPress(1, 35);
        // El usuario finalmente suelta tras 500ms desde el press espurio.
        const r2 = d.onRelease(1, 535);
        expect(r2).toBe(true);   // ahora sí, drop real
    });
});
