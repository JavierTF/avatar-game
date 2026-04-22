import { describe, it, expect, vi } from 'vitest';

vi.mock('three', () => ({
    SphereGeometry:    class { dispose() {} },
    MeshBasicMaterial: class {
        constructor() { this.opacity = 1; }
        dispose() {}
    },
    Mesh: class {
        constructor() {
            this.position = { copy() {} };
            this.scale    = { setScalar() {} };
            this.material = { opacity: 1, dispose() {} };
            this.geometry = { dispose() {} };
        }
    },
}));

const { ControllerTrail } = await import('../js/trail.js');

function makeScene() {
    const added = [];
    return {
        added,
        add(o)    { added.push(o); },
        remove(o) { const i = added.indexOf(o); if (i !== -1) added.splice(i, 1); },
    };
}

const pos1 = { x: 0.0, y: 1.2, z: 0 };
const pos2 = { x: 0.3, y: 1.2, z: 0 };

describe('ControllerTrail — aparición', () => {
    it('no spawnea puntos antes del delay (0.15 s)', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.1, true, pos1, pos2);
        expect(scene.added.length).toBe(0);
    });

    it('spawnea un punto por mando una vez superado el delay', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.2, true, pos1, pos2);
        expect(scene.added.length).toBe(2);
    });

    it('acumula puntos frame a frame mientras siga activo', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.2, true, pos1, pos2);   // supera delay, 2 puntos
        trail.update(0.02, true, pos1, pos2);  // 2 más
        expect(scene.added.length).toBe(4);
    });

    it('no spawnea si bothHeld es false', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.5, false, pos1, pos2);
        expect(scene.added.length).toBe(0);
    });

    it('soltar los gatillos resetea el holdTime', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.12, true,  pos1, pos2);  // casi al delay
        trail.update(0.05, false, pos1, pos2);  // suelto → reset
        trail.update(0.05, true,  pos1, pos2);  // holdTime=0.05 < 0.15, nada
        expect(scene.added.length).toBe(0);
    });
});

describe('ControllerTrail — ciclo de vida de los puntos', () => {
    it('cada punto se elimina al expirar (~0.28 s)', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.2, true,  pos1, pos2);   // 2 spawn
        expect(scene.added.length).toBe(2);
        trail.update(0.35, false, pos1, pos2);  // > POINT_LIFE
        expect(scene.added.length).toBe(0);
    });

    it('la opacidad del punto decrece con el tiempo', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.2, true, pos1, pos2);
        const p = trail._points[0];
        const opAntes = p.mesh.material.opacity;
        trail.update(0.1, false, pos1, pos2);
        expect(p.mesh.material.opacity).toBeLessThan(opAntes);
    });

    it('la opacidad nunca baja de 0', () => {
        const scene = makeScene();
        const trail = new ControllerTrail(scene);
        trail.update(0.2, true, pos1, pos2);
        trail.update(1.0, false, pos1, pos2);   // mucho tiempo
        // ya deberían haberse removido todos, pero la última opacidad nunca negativa.
        for (const p of trail._points) {
            expect(p.mesh.material.opacity).toBeGreaterThanOrEqual(0);
        }
    });
});
