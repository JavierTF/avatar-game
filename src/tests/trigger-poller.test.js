import { describe, it, expect } from 'vitest';
import { TriggerPoller } from '../js/trigger-poller.js';

describe('TriggerPoller — detección de transiciones', () => {
    it('primera llamada con pressed=true → "pressed"', () => {
        const p = new TriggerPoller();
        expect(p.poll(1, true)).toBe('pressed');
    });

    it('llamada con pressed=true tras "pressed" → "idle" (sigue presionado)', () => {
        const p = new TriggerPoller();
        p.poll(1, true);
        expect(p.poll(1, true)).toBe('idle');
        expect(p.poll(1, true)).toBe('idle');
    });

    it('pressed=false tras presionar → "released"', () => {
        const p = new TriggerPoller();
        p.poll(1, true);
        expect(p.poll(1, false)).toBe('released');
    });

    it('pressed=false tras release → "idle"', () => {
        const p = new TriggerPoller();
        p.poll(1, true);
        p.poll(1, false);
        expect(p.poll(1, false)).toBe('idle');
        expect(p.poll(1, false)).toBe('idle');
    });

    it('estado inicial (sin haber polled) y luego false → "idle"', () => {
        const p = new TriggerPoller();
        expect(p.poll(1, false)).toBe('idle');
    });
});

describe('TriggerPoller — independencia entre mandos', () => {
    it('mando 1 y 2 trackean estado por separado', () => {
        const p = new TriggerPoller();
        expect(p.poll(1, true)).toBe('pressed');
        expect(p.poll(2, true)).toBe('pressed');
        expect(p.poll(1, true)).toBe('idle');
        expect(p.poll(2, true)).toBe('idle');
        expect(p.poll(1, false)).toBe('released');
        expect(p.poll(2, true)).toBe('idle');  // 2 sigue presionado
    });
});

describe('TriggerPoller — secuencia típica de drag', () => {
    it('press → 30 frames idle → released: el "idle" se mantiene mientras esté apretado', () => {
        const p = new TriggerPoller();
        expect(p.poll(1, true)).toBe('pressed');
        for (let i = 0; i < 30; i++) {
            expect(p.poll(1, true)).toBe('idle');
        }
        expect(p.poll(1, false)).toBe('released');
    });

    it('press repetido (sin release intermedio): solo el primero es "pressed"', () => {
        const p = new TriggerPoller();
        p.poll(1, true);
        // Si por alguna razón el frame siguiente vuelve a indicar pressed=true,
        // NO detectamos otro "pressed". Sólo cuenta la transición false→true.
        expect(p.poll(1, true)).toBe('idle');
    });
});
