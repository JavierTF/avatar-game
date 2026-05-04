// Filtra eventos `selectend` espurios del runtime XR.
//
// Algunos runtimes (especialmente con triggers analógicos sensibles)
// disparan `selectstart` + `selectend` en muy rápida sucesión por una mala
// lectura del trigger. El síntoma en el juego: la verde se agarra (rojo)
// y se suelta en el mismo instante (vuelve a estado libre o muro), sin que
// el jugador haya soltado físicamente el gatillo.
//
// Solución pragmática: si entre el press y el release pasaron menos de
// MIN_HOLD_MS, asumimos que es ruido del runtime y descartamos el release.
// El jugador tendría que soltar el gatillo de verdad después.
export const MIN_HOLD_MS = 100;

export class TriggerDebouncer {
    constructor(minHoldMs = MIN_HOLD_MS) {
        this.minHoldMs = minHoldMs;
        this._pressTime = [null, null];  // [ctrl1, ctrl2]
    }

    onPress(idx, now = performance.now()) {
        this._pressTime[idx - 1] = now;
    }

    // Devuelve true si el release es "real" (gatillo aguantado al menos
    // minHoldMs ms). false si parece espurio y debe ignorarse por el caller.
    // En cualquier caso limpia el estado interno (XR ya emitió selectend).
    onRelease(idx, now = performance.now()) {
        const t = this._pressTime[idx - 1];
        this._pressTime[idx - 1] = null;
        if (t == null) return true;  // sin press previo → aceptar
        return now - t >= this.minHoldMs;
    }
}
