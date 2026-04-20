import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    Vector3: class {
        constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
        set(x,y,z) { this.x=x; this.y=y; this.z=z; return this; }
        copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this; }
        distanceTo(v) { return Math.hypot(this.x-v.x, this.y-v.y, this.z-v.z); }
        setFromMatrixPosition(m) { this.x=m.x||0; this.y=m.y||0; this.z=m.z||0; return this; }
    }
}));

const { Player } = await import('../js/player.js');

describe('Player — construcción', () => {
    it('usa valores por defecto sin config', () => {
        const p = new Player();
        expect(p.vida).toBe(5);
        expect(p.maxVida).toBe(5);
        expect(p.maxMana).toBe(100);
        expect(p.mana).toBe(0);
        expect(p.vivo).toBe(true);
    });

    it('lee vidaInicial y maxVida del config', () => {
        const p = new Player({ player: { vidaInicial: 3, maxVida: 4, maxMana: 80 } });
        expect(p.vida).toBe(3);
        expect(p.maxVida).toBe(4);
        expect(p.maxMana).toBe(80);
    });
});

describe('Player — vida', () => {
    it('hit reduce vida en 1', () => {
        const p = new Player();
        p.hit();
        expect(p.vida).toBe(4);
    });

    it('hit resetea combo', () => {
        const p = new Player();
        p.combo = 5;
        p.hit();
        expect(p.combo).toBe(0);
    });

    it('llegar a 0 vida marca como muerto', () => {
        const p = new Player({ player: { vidaInicial: 1, maxVida: 1 } });
        p.hit();
        expect(p.vida).toBe(0);
        expect(p.vivo).toBe(false);
    });

    it('heal aumenta vida sin pasar maxVida', () => {
        const p = new Player();
        p.heal();
        expect(p.vida).toBe(5); // ya en máximo
        p.hit();
        p.heal();
        expect(p.vida).toBe(5);
    });
});

describe('Player — mana', () => {
    it('addMana suma correctamente', () => {
        const p = new Player();
        p.addMana(30);
        expect(p.mana).toBe(30);
    });

    it('addMana no supera maxMana', () => {
        const p = new Player();
        p.addMana(999);
        expect(p.mana).toBe(100);
    });

    it('consumeMana descuenta si hay suficiente', () => {
        const p = new Player();
        p.addMana(50);
        const ok = p.consumeMana(0.3); // 30% de 100 = 30
        expect(ok).toBe(true);
        expect(p.mana).toBe(20);
    });

    it('consumeMana falla si no hay suficiente', () => {
        const p = new Player();
        const ok = p.consumeMana(0.5);
        expect(ok).toBe(false);
        expect(p.mana).toBe(0);
    });
});

describe('Player — bola azul', () => {
    it('hitBlue suma puntos y mana', () => {
        const p = new Player();
        p.hitBlue();
        expect(p.puntos).toBeGreaterThan(0);
        expect(p.mana).toBeGreaterThan(0);
        expect(p.combo).toBe(1);
    });

    it('combo activa multiplicador cada 3 golpes', () => {
        const p = new Player();
        p.hitBlue(); p.hitBlue(); p.hitBlue(); // combo 3 → mult x1.5
        const pts = p.puntos;
        p.hitBlue(); // combo 4, mult x1.5
        expect(p.puntos).toBeGreaterThan(pts);
    });

    it('maxCombo se actualiza', () => {
        const p = new Player();
        p.hitBlue(); p.hitBlue(); p.hitBlue();
        expect(p.maxCombo).toBe(3);
        p.hit(); // resetea combo
        expect(p.maxCombo).toBe(3); // maxCombo no baja
    });
});

// Helpers para updateMovimiento
const cam = (x, y, z) => ({ matrixWorld: { x, y, z } });
const vec = (x, y, z) => ({ x, y, z, distanceTo(v) { return Math.hypot(x-v.x, y-v.y, z-v.z); } });

describe('Player — métricas de movimiento: cabeza', () => {
    it('acumula metros recorridos', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.6, 0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(1, 1.6, 0), vec(0,1,0), vec(0,1,0), 0.016); // mueve 1m
        expect(p.metros).toBeCloseTo(1, 1);
    });

    it('registra velocidad máxima de cabeza', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.6, 0), null, null, 0.016);
        p.updateMovimiento(cam(2, 1.6, 0), null, null, 0.016); // 2m en 0.016s = 125 m/s
        expect(p.velocidadMaxCabeza).toBeGreaterThan(0);
    });

    it('acumula desplazamiento lateral (X)', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,   1.6, 0), null, null, 0.016);
        p.updateMovimiento(cam(0.5, 1.6, 0), null, null, 0.016);
        p.updateMovimiento(cam(0,   1.6, 0), null, null, 0.016);
        expect(p.desplazamientoLateral).toBeCloseTo(1.0, 1);
    });

    it('detecta rango vertical correcto', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.8, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.2, 0), null, null, 0.016);
        expect(p.rangoVertical).toBeCloseTo(0.6, 1);
    });

    it('detecta agachada cuando la cabeza baja >0.3m', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.8, 0), null, null, 0.016); // de pie
        p.updateMovimiento(cam(0, 1.4, 0), null, null, 0.016); // agachado
        p.updateMovimiento(cam(0, 1.8, 0), null, null, 0.016); // recuperado
        expect(p.agachadas).toBe(1);
    });

    it('no cuenta agachada si el descenso es menor de 0.3m', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.8, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.6, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.8, 0), null, null, 0.016);
        expect(p.agachadas).toBe(0);
    });
});

describe('Player — métricas de movimiento: brazos', () => {
    it('acumula distancia del brazo derecho (c1)', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(1,1,0), vec(0,1,0), 0.016); // brazo dch mueve 1m
        expect(p.metrosBrazoDch).toBeCloseTo(1, 1);
    });

    it('acumula distancia del brazo izquierdo (c2)', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,1), 0.016); // brazo izq mueve 1m
        expect(p.metrosBrazoIzq).toBeCloseTo(1, 1);
    });

    it('registra velocidad máxima de brazos', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(2,1,0), vec(0,1,2), 0.016);
        expect(p.velocidadMaxBrazoDch).toBeGreaterThan(0);
        expect(p.velocidadMaxBrazoIzq).toBeGreaterThan(0);
    });
});

describe('Player — métricas de movimiento: tiempo activo', () => {
    it('cuenta tiempo activo cuando hay movimiento', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(1,1.6,0), vec(1,1,0), vec(1,1,0), 0.016);
        expect(p.tiempoActivo).toBeGreaterThan(0);
    });

    it('no cuenta tiempo activo cuando no hay movimiento', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        expect(p.tiempoActivo).toBe(0);
    });

    it('pctTiempoActivo está entre 0 y 100', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(1,1.6,0), vec(1,1,0), vec(1,1,0), 0.016);
        expect(p.pctTiempoActivo).toBeGreaterThanOrEqual(0);
        expect(p.pctTiempoActivo).toBeLessThanOrEqual(100);
    });
});
