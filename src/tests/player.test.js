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

describe('Player — rangos X/Z y área ocupada', () => {
    it('detecta rango horizontal X', () => {
        const p = new Player();
        p.updateMovimiento(cam(-1, 1.6, 0), null, null, 0.016);
        p.updateMovimiento(cam( 1, 1.6, 0), null, null, 0.016);
        expect(p.rangoHorizontalX).toBeCloseTo(2, 1);
    });

    it('detecta rango de profundidad Z', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.6, -1), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.6,  2), null, null, 0.016);
        expect(p.rangoProfundidadZ).toBeCloseTo(3, 1);
    });

    it('areaOcupada es rangoX * rangoZ', () => {
        const p = new Player();
        p.updateMovimiento(cam(-1, 1.6, -1), null, null, 0.016);
        p.updateMovimiento(cam( 1, 1.6,  1), null, null, 0.016);
        // rangoX = 2, rangoZ = 2 → area = 4
        expect(p.areaOcupada).toBeCloseTo(4, 1);
    });

    it('rangos y área son 0 sin muestras', () => {
        const p = new Player();
        expect(p.rangoHorizontalX).toBe(0);
        expect(p.rangoProfundidadZ).toBe(0);
        expect(p.areaOcupada).toBe(0);
    });
});

describe('Player — altura promedio y velocidades medias', () => {
    it('alturaPromedioCabeza es la media de Y de cabeza', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.0, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 2.0, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.5, 0), null, null, 0.016);
        expect(p.alturaPromedioCabeza).toBeCloseTo(1.5, 1);
    });

    it('velocidadMediaCabeza = metros / tiempoTotal', () => {
        const p = new Player();
        p.updateMovimiento(cam(0, 1.6, 0), null, null, 0.016);
        p.updateMovimiento(cam(1, 1.6, 0), null, null, 0.1); // 1m en 0.1s
        // tiempoTotal=0.1, metros=1 → v_media = 10
        expect(p.velocidadMediaCabeza).toBeCloseTo(10, 1);
    });

    it('velocidadMediaBrazoDch = metrosBrazoDch / tiempoTotal', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0,1,0), vec(0,1,0), 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(2,1,0), vec(0,1,0), 0.1);
        // tiempoTotal=0.1, metrosBrazoDch=2 → 20
        expect(p.velocidadMediaBrazoDch).toBeCloseTo(20, 1);
    });

    it('velocidades medias son 0 sin tiempoTotal', () => {
        const p = new Player();
        expect(p.velocidadMediaCabeza).toBe(0);
        expect(p.velocidadMediaBrazoDch).toBe(0);
        expect(p.velocidadMediaBrazoIzq).toBe(0);
    });
});

describe('Player — altura máxima y alcance de brazos', () => {
    it('alturaMaxBrazoDch trackea la Y más alta que toca c1', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), vec(0, 1.2, 0), null, 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(0, 2.3, 0), null, 0.016);
        p.updateMovimiento(cam(0,1.6,0), vec(0, 1.0, 0), null, 0.016);
        expect(p.alturaMaxBrazoDch).toBeCloseTo(2.3, 1);
    });

    it('alturaMaxBrazoIzq trackea la Y más alta que toca c2', () => {
        const p = new Player();
        p.updateMovimiento(cam(0,1.6,0), null, vec(0, 1.8, 0), 0.016);
        p.updateMovimiento(cam(0,1.6,0), null, vec(0, 2.1, 0), 0.016);
        expect(p.alturaMaxBrazoIzq).toBeCloseTo(2.1, 1);
    });

    it('alcanceMaxBrazoDch = máxima distancia del mando a la cabeza', () => {
        const p = new Player();
        // cabeza en (0,1.6,0), brazo dch se estira hasta (0,1.6,-0.8) → alcance 0.8
        p.updateMovimiento(cam(0, 1.6, 0), vec(0, 1.6,  0),    null, 0.016);
        p.updateMovimiento(cam(0, 1.6, 0), vec(0, 1.6, -0.8),  null, 0.016);
        expect(p.alcanceMaxBrazoDch).toBeCloseTo(0.8, 1);
    });

    it('alturas y alcances son 0 sin muestras', () => {
        const p = new Player();
        expect(p.alturaMaxBrazoDch).toBe(0);
        expect(p.alturaMaxBrazoIzq).toBe(0);
        expect(p.alcanceMaxBrazoDch).toBe(0);
        expect(p.alcanceMaxBrazoIzq).toBe(0);
    });
});

describe('Player — simetría de brazos', () => {
    it('simetría 1.0 cuando ambos brazos se movieron lo mismo', () => {
        const p = new Player();
        p.metrosBrazoDch = 3;
        p.metrosBrazoIzq = 3;
        expect(p.simetriaBrazos).toBe(1.0);
    });

    it('simetría < 1 cuando un brazo se movió más', () => {
        const p = new Player();
        p.metrosBrazoDch = 4;
        p.metrosBrazoIzq = 2;
        expect(p.simetriaBrazos).toBeCloseTo(0.5, 2);
    });

    it('simetría 1.0 si ninguno se movió (caso degenerado)', () => {
        const p = new Player();
        expect(p.simetriaBrazos).toBe(1.0);
    });
});

describe('Player — saltos', () => {
    it('detecta un salto cuando la cabeza supera el neutral +0.25m y vuelve', () => {
        const p = new Player();
        // Construye un baseline estable primero
        for (let i = 0; i < 10; i++) {
            p.updateMovimiento(cam(0, 1.6, 0), null, null, 0.016);
        }
        // Salto
        p.updateMovimiento(cam(0, 1.9, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.6, 0), null, null, 0.016);
        expect(p.saltos).toBe(1);
    });

    it('no cuenta salto si la altura extra no supera 0.25m', () => {
        const p = new Player();
        for (let i = 0; i < 10; i++) {
            p.updateMovimiento(cam(0, 1.6, 0), null, null, 0.016);
        }
        p.updateMovimiento(cam(0, 1.75, 0), null, null, 0.016);
        p.updateMovimiento(cam(0, 1.6,  0), null, null, 0.016);
        expect(p.saltos).toBe(0);
    });
});

describe('Player — mana gastado e intensidad', () => {
    it('consumeMana acumula en manaGastado', () => {
        const p = new Player();
        p.addMana(100);
        p.consumeMana(0.2);   // 20
        p.consumeMana(0.3);   // 30
        expect(p.manaGastado).toBe(50);
    });

    it('consumeMana fallido no suma a manaGastado', () => {
        const p = new Player();
        p.consumeMana(0.5);   // falla: mana=0
        expect(p.manaGastado).toBe(0);
    });

    it('intensidad "bajo" cuando tiempo activo < 40%', () => {
        const p = new Player();
        p.tiempoActivo = 1;
        p.tiempoTotal  = 10;   // 10%
        expect(p.intensidad).toBe('bajo');
    });

    it('intensidad "medio" entre 40% y 70%', () => {
        const p = new Player();
        p.tiempoActivo = 5;
        p.tiempoTotal  = 10;   // 50%
        expect(p.intensidad).toBe('medio');
    });

    it('intensidad "alto" cuando supera 70%', () => {
        const p = new Player();
        p.tiempoActivo = 8;
        p.tiempoTotal  = 10;   // 80%
        expect(p.intensidad).toBe('alto');
    });
});
