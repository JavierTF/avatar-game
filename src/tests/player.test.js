import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    Vector3: class {
        set() { return this; }
        copy() { return this; }
        distanceTo() { return 0; }
        setFromMatrixPosition() { return this; }
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
