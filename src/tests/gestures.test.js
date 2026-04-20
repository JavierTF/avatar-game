import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => {
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        copy(v)              { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        clone()              { return new Vector3(this.x, this.y, this.z); }
        subVectors(a, b)     { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
        normalize()          { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
        dot(v)               { return this.x * v.x + this.y * v.y + this.z * v.z; }
        distanceTo(v)        { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
        setFromMatrixPosition(m) { this.x = m.x || 0; this.y = m.y || 0; this.z = m.z || 0; return this; }
    }
    return { Vector3 };
});

const { GestureDetector } = await import('../js/gestures.js');

// Controlador simulado: matrixWorld actúa como posición directa
function makeCtrl(x, y, z) {
    return { matrixWorld: { x, y, z } };
}

// Inicializa el detector y "registra" posiciones iniciales
function makeDetector(pos1 = [0, 1.2, 0], pos2 = [0.4, 1.2, 0]) {
    const config = { gestures: {
        green_activate: { direction: [0, 1, -1], minSpeed: 0.03 }
    }};
    const g = new GestureDetector(config);
    // Primera llamada — inicializa prev
    g.update(0.016, makeCtrl(...pos1), makeCtrl(...pos2));
    return g;
}

// Simula un frame con nuevas posiciones y devuelve los deltas
function frame(g, pos1, pos2, delta = 0.016) {
    return g.update(delta, makeCtrl(...pos1), makeCtrl(...pos2));
}

// ─── Escudo Ártico ────────────────────────────────────────────────────────────

describe('Escudo Ártico — brazos hacia arriba cruzándose', () => {
    it('se activa: ambos suben y se cruzan (izda→dcha, dcha→izda)', () => {
        const g = makeDetector([0.3, 1.0, 0], [-0.3, 1.0, 0]);
        // Mano dcha (+X) sube y va a la izda (-X); mano izda (-X) sube y va a la dcha (+X)
        const { delta1, delta2 } = frame(g, [-0.3 + 0.02, 1.0 + 0.03, 0], [0.3 - 0.02, 1.0 + 0.03, 0]);
        expect(g.check('power_escudo', delta1, delta2)).toBe(true);
    });

    it('NO se activa si solo suben sin cruzarse', () => {
        const g = makeDetector([0.3, 1.0, 0], [-0.3, 1.0, 0]);
        const { delta1, delta2 } = frame(g, [0.3, 1.0 + 0.03, 0], [-0.3, 1.0 + 0.03, 0]);
        expect(g.check('power_escudo', delta1, delta2)).toBe(false);
    });

    it('NO se activa si se cruzan pero bajan', () => {
        const g = makeDetector([0.3, 1.0, 0], [-0.3, 1.0, 0]);
        const { delta1, delta2 } = frame(g, [-0.3 + 0.02, 1.0 - 0.03, 0], [0.3 - 0.02, 1.0 - 0.03, 0]);
        expect(g.check('power_escudo', delta1, delta2)).toBe(false);
    });

    it('entra en cooldown tras activarse', () => {
        const g = makeDetector([0.3, 1.0, 0], [-0.3, 1.0, 0]);
        const { delta1, delta2 } = frame(g, [-0.3 + 0.02, 1.0 + 0.03, 0], [0.3 - 0.02, 1.0 + 0.03, 0]);
        g.check('power_escudo', delta1, delta2);
        const { delta1: d1b, delta2: d2b } = frame(g, [-0.3 + 0.04, 1.0 + 0.06, 0], [0.3 - 0.04, 1.0 + 0.06, 0]);
        expect(g.check('power_escudo', d1b, d2b)).toBe(false);
    });
});

// ─── Pulso Sísmico ────────────────────────────────────────────────────────────

describe('Pulso Sísmico — casi arrodillarse', () => {
    it('se activa: mandos bajos (<0.5m) y bajando rápido', () => {
        const g = makeDetector([0, 0.45, 0], [0.4, 0.45, 0]);
        const { delta1, delta2 } = frame(g, [0, 0.45 - 0.04, 0], [0.4, 0.45 - 0.04, 0]);
        expect(g.check('power_sismico', delta1, delta2)).toBe(true);
    });

    it('NO se activa si los mandos están altos aunque bajen rápido', () => {
        const g = makeDetector([0, 1.5, 0], [0.4, 1.5, 0]);
        const { delta1, delta2 } = frame(g, [0, 1.5 - 0.04, 0], [0.4, 1.5 - 0.04, 0]);
        expect(g.check('power_sismico', delta1, delta2)).toBe(false);
    });

    it('NO se activa si los mandos están bajos pero no bajan', () => {
        const g = makeDetector([0, 0.3, 0], [0.4, 0.3, 0]);
        const { delta1, delta2 } = frame(g, [0, 0.3 + 0.01, 0], [0.4, 0.3 + 0.01, 0]);
        expect(g.check('power_sismico', delta1, delta2)).toBe(false);
    });
});

// ─── Llama Dragón ─────────────────────────────────────────────────────────────

describe('Llama Dragón — recoger y empujar', () => {
    it('se activa: fase 1 (recoger +Z) seguida de fase 2 (empujar -Z)', () => {
        const g = makeDetector([0, 1.2, 0], [0.4, 1.2, 0]);
        // Fase 1: recoger hacia atrás
        const { delta1: d1a, delta2: d2a } = frame(g, [0, 1.2, 0 + 0.03], [0.4, 1.2, 0 + 0.03]);
        expect(g.check('power_llama', d1a, d2a)).toBe(false); // solo registra fase 1
        // Fase 2: empujar hacia adelante
        const { delta1: d1b, delta2: d2b } = frame(g, [0, 1.2, 0.03 - 0.03], [0.4, 1.2, 0.03 - 0.03]);
        expect(g.check('power_llama', d1b, d2b)).toBe(true);
    });

    it('NO se activa si solo se empuja sin recoger antes', () => {
        const g = makeDetector([0, 1.2, 0], [0.4, 1.2, 0]);
        const { delta1, delta2 } = frame(g, [0, 1.2, -0.03], [0.4, 1.2, -0.03]);
        expect(g.check('power_llama', delta1, delta2)).toBe(false);
    });

    it('NO se activa si la fase 2 llega tarde (>1.5s)', () => {
        const g = makeDetector([0, 1.2, 0], [0.4, 1.2, 0]);
        // Fase 1
        const { delta1: d1a, delta2: d2a } = frame(g, [0, 1.2, 0.03], [0.4, 1.2, 0.03]);
        g.check('power_llama', d1a, d2a);
        // Dejar pasar 2 segundos
        g.update(2.0, makeCtrl(0, 1.2, 0.03), makeCtrl(0.4, 1.2, 0.03));
        // Fase 2 tardía
        const { delta1: d1b, delta2: d2b } = frame(g, [0, 1.2, 0.03 - 0.03], [0.4, 1.2, 0.03 - 0.03]);
        expect(g.check('power_llama', d1b, d2b)).toBe(false);
    });
});

// ─── Viento Eterno ────────────────────────────────────────────────────────────

describe('Viento Eterno — separar en diagonal', () => {
    it('se activa: mandos se separan y uno está más alto que el otro', () => {
        // Pos inicial: mandos juntos, uno más alto
        const g = makeDetector([0, 1.5, 0], [0.1, 1.2, 0]);
        // Se separan: uno sube-izda, otro baja-dcha
        frame(g, [-0.1, 1.55, 0], [0.2, 1.15, 0]);
        const { delta1, delta2 } = frame(g, [-0.2, 1.60, 0], [0.3, 1.10, 0]);
        expect(g.check('power_viento', delta1, delta2)).toBe(true);
    });

    it('NO se activa si se separan pero al mismo nivel (horizontal)', () => {
        const g = makeDetector([-0.1, 1.2, 0], [0.1, 1.2, 0]);
        const { delta1, delta2 } = frame(g, [-0.2, 1.2, 0], [0.2, 1.2, 0]);
        expect(g.check('power_viento', delta1, delta2)).toBe(false);
    });

    it('NO se activa si hay diagonal pero los mandos se acercan', () => {
        const g = makeDetector([-0.3, 1.5, 0], [0.3, 1.1, 0]);
        const { delta1, delta2 } = frame(g, [-0.2, 1.45, 0], [0.2, 1.15, 0]);
        expect(g.check('power_viento', delta1, delta2)).toBe(false);
    });
});
