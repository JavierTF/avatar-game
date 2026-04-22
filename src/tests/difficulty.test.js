import { describe, it, expect } from 'vitest';
import { Difficulty } from '../js/difficulty.js';

describe('Difficulty', () => {
    it('empieza en nivel 1 con speedMult 1.0 por defecto', () => {
        const d = new Difficulty();
        expect(d.nivel).toBe(1);
        expect(d.speedMult).toBeCloseTo(1.0);
    });

    it('nivel inicial 2 tiene speedMult 1.15', () => {
        const d = new Difficulty(2);
        expect(d.nivel).toBe(2);
        expect(d.speedMult).toBeCloseTo(1.15);
    });

    it('nivel inicial 3 tiene speedMult 1.3225', () => {
        const d = new Difficulty(3);
        expect(d.speedMult).toBeCloseTo(1.3225);
    });

    it('sube de nivel tras 15 segundos', () => {
        const d = new Difficulty();
        d.update(15);
        expect(d.nivel).toBe(2);
    });

    it('no sube de nivel antes de 15 segundos', () => {
        const d = new Difficulty();
        d.update(7);
        d.update(7);
        expect(d.nivel).toBe(1);
    });

    it('llama a onChange al subir de nivel', () => {
        const d = new Difficulty();
        let llamado = false;
        d.onChange = () => { llamado = true; };
        d.update(15);
        expect(llamado).toBe(true);
    });

    it('spawnRate disminuye con el nivel', () => {
        const d1 = new Difficulty(1);
        const d5 = new Difficulty(5);
        expect(d5.spawnRate()).toBeLessThan(d1.spawnRate());
    });

    it('spawnRate nunca baja de 0.4', () => {
        const d = new Difficulty(100);
        expect(d.spawnRate()).toBeGreaterThanOrEqual(0.4);
    });

    it('manaCost devuelve coste correcto por nivel', () => {
        const d1 = new Difficulty(1);
        const d2 = new Difficulty(2);
        const d3 = new Difficulty(3);
        // Escudo Ártico: 20% / 30% / 40%
        expect(d1.manaCost(0.20, 0.30, 0.40)).toBe(0.20);
        expect(d2.manaCost(0.20, 0.30, 0.40)).toBe(0.30);
        expect(d3.manaCost(0.20, 0.30, 0.40)).toBe(0.40);
    });
});
