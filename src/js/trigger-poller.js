// Detector de transiciones del estado del trigger por polling.
//
// En lugar de depender de eventos `selectstart`/`selectend` (que algunos
// runtimes XR disparan espuriamente), leemos cada frame el estado real
// del botón vía `inputSource.gamepad.buttons[0].pressed` y deducimos la
// transición. Inmune a glitches del runtime.
export class TriggerPoller {
    constructor() {
        this._held = [false, false];  // [ctrl1, ctrl2]
    }

    // Devuelve la transición del frame:
    //  - 'pressed':  el trigger se acaba de apretar (false → true).
    //  - 'released': el trigger se acaba de soltar (true → false).
    //  - 'idle':     no hubo cambio (sigue apretado o sigue suelto).
    poll(idx, isPressed) {
        const i = idx - 1;
        const wasHeld = this._held[i];
        this._held[i] = isPressed;
        if (isPressed && !wasHeld) return 'pressed';
        if (!isPressed && wasHeld) return 'released';
        return 'idle';
    }
}
