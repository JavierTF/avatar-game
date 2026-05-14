// Mock compartido de three.js para tests de objects.test.js.
// Antes cada archivo tenía su propia implementación parcial — algunas con
// métodos no-op (normalize, multiplyScalar, distanceTo) que ocultaban bugs.

export class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z)        { this.x = x; this.y = y; this.z = z; return this; }
    copy(v)             { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone()             { return new Vector3(this.x, this.y, this.z); }
    setFromMatrixPosition(m) { this.x = m.x || 0; this.y = m.y || 0; this.z = m.z || 0; return this; }
    subVectors(a, b)    { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    add(v)              { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    multiplyScalar(s)   { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() {
        const l = Math.hypot(this.x, this.y, this.z) || 1;
        this.x /= l; this.y /= l; this.z /= l;
        return this;
    }
    distanceTo(v)       { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    dot(v)              { return this.x * v.x + this.y * v.y + this.z * v.z; }
    length()            { return Math.hypot(this.x, this.y, this.z); }
    lengthSq()          { return this.x * this.x + this.y * this.y + this.z * this.z; }
}

export const MathUtils = {
    lerp:      (a, b, t) => a + (b - a) * t,
    degToRad:  (d) => d * Math.PI / 180,
    radToDeg:  (r) => r * 180 / Math.PI,
    clamp:     (v, min, max) => Math.max(min, Math.min(max, v)),
};

export class Color {
    constructor() {}
    multiplyScalar() { return this; }
    setHex() {}
}

// Posición que se usa dentro de Mesh — separada de Vector3 porque algunos
// tests dependen de detalles concretos (clone que comparte refs, etc).
class MeshPosition {
    constructor() { this.x = 0; this.y = 0; this.z = 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v)      { if (v) { this.x = v.x; this.y = v.y; this.z = v.z; } return this; }
    add(v)       { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    clone() {
        const c = new MeshPosition();
        c.x = this.x; c.y = this.y; c.z = this.z;
        return c;
    }
}

export class SphereGeometry { dispose() {} }
export class BufferGeometry { setFromPoints() { return this; } dispose() {} }

export class MeshStandardMaterial {
    constructor() {
        this.emissive = { multiplyScalar() {}, setHex() {} };
        this.emissiveIntensity = 0.2;
    }
    dispose() {}
}
export class LineBasicMaterial {
    constructor() {}
    dispose() {}
}

export class Mesh {
    constructor(geo, mat) {
        this.position   = new MeshPosition();
        this.castShadow = false;
        this.rotation   = { x: 0, y: 0, z: 0 };
        this.geometry   = geo || { dispose() {} };
        this.material   = mat || new MeshStandardMaterial();
    }
}

export class Line {
    constructor() { this.scale = {}; }
    clone() { return this; }
}
