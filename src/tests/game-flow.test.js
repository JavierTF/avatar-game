import { describe, it, expect, vi } from 'vitest';
import { activateGreen, endGame } from '../js/game-flow.js';

// =============================================================================
// activateGreen — convierte una bola verde agarrada en muro o la descarta
// reproduciendo el feedback de éxito o fracaso correspondiente.
// =============================================================================
describe('game-flow — activateGreen', () => {
    function makeDeps(dropResult) {
        return {
            balls:   { dropAsWall: vi.fn(() => dropResult) },
            metrics: { ballHit: vi.fn() },
            sound:   { life: vi.fn(), negative: vi.fn() },
        };
    }

    it('drop válido → metric green + sound.life(), NO sound.negative()', () => {
        const { balls, metrics, sound } = makeDeps(true);
        const ok = activateGreen({}, { x: 0, y: 0.2, z: -1 }, { x: 0, y: 1.6, z: 0 },
                                 balls, metrics, sound);
        expect(ok).toBe(true);
        expect(metrics.ballHit).toHaveBeenCalledWith('green');
        expect(sound.life).toHaveBeenCalledTimes(1);
        expect(sound.negative).not.toHaveBeenCalled();
    });

    it('drop inválido → sound.negative(), NO metric ni life', () => {
        const { balls, metrics, sound } = makeDeps(false);
        const ok = activateGreen({}, { x: 0, y: 1.8, z: -1 }, { x: 0, y: 1.6, z: 0 },
                                 balls, metrics, sound);
        expect(ok).toBe(false);
        expect(metrics.ballHit).not.toHaveBeenCalled();
        expect(sound.life).not.toHaveBeenCalled();
        expect(sound.negative).toHaveBeenCalledTimes(1);
    });

    it('pasa los argumentos correctos a balls.dropAsWall', () => {
        const { balls, metrics, sound } = makeDeps(true);
        const ball     = { type: 'green', grabbed: true };
        const ctrlPos  = { x: 0.5, y: 0.3, z: -1.0 };
        const playerPos = { x: 0, y: 1.6, z: 0 };
        activateGreen(ball, ctrlPos, playerPos, balls, metrics, sound);
        expect(balls.dropAsWall).toHaveBeenCalledWith(ball, ctrlPos, playerPos);
    });
});

// =============================================================================
// endGame — orquesta el fin de partida con guard idempotente.
// =============================================================================
describe('game-flow — endGame', () => {
    function makeArgs(overrides = {}) {
        return {
            alreadyEnded: false,
            onStop:       vi.fn(),
            player:       { puntos: 100 },
            nivel:        3,
            metrics:      { showScreen: vi.fn() },
            finalPanel:   { show: vi.fn() },
            cameraPos:    { x: 0, y: 1.6, z: 0 },
            countdown:    { dispose: vi.fn() },
            feedback:     { clearAll: vi.fn() },
            ...overrides,
        };
    }

    it('llama onStop, metrics.showScreen, finalPanel.show, countdown.dispose en orden', () => {
        const args = makeArgs();
        const ok = endGame(args);
        expect(ok).toBe(true);
        expect(args.onStop).toHaveBeenCalledTimes(1);
        expect(args.metrics.showScreen).toHaveBeenCalledWith(args.player, args.nivel);
        expect(args.finalPanel.show).toHaveBeenCalledWith(
            args.player, args.nivel, args.metrics, args.cameraPos
        );
        expect(args.countdown.dispose).toHaveBeenCalledTimes(1);
    });

    it('si alreadyEnded=true, es no-op (no dispara nada, devuelve false)', () => {
        const args = makeArgs({ alreadyEnded: true });
        const ok = endGame(args);
        expect(ok).toBe(false);
        expect(args.onStop).not.toHaveBeenCalled();
        expect(args.metrics.showScreen).not.toHaveBeenCalled();
        expect(args.finalPanel.show).not.toHaveBeenCalled();
        expect(args.countdown.dispose).not.toHaveBeenCalled();
    });

    it('robusto si finalPanel, countdown y feedback son null', () => {
        const args = makeArgs({ finalPanel: null, countdown: null, feedback: null });
        expect(() => endGame(args)).not.toThrow();
        expect(args.onStop).toHaveBeenCalled();
        expect(args.metrics.showScreen).toHaveBeenCalled();
    });

    it('llama feedback.clearAll() para evitar popups huérfanos del último frame', () => {
        const args = makeArgs();
        endGame(args);
        expect(args.feedback.clearAll).toHaveBeenCalledTimes(1);
    });

    it('si alreadyEnded, NO llama feedback.clearAll() (idempotencia total)', () => {
        const args = makeArgs({ alreadyEnded: true });
        endGame(args);
        expect(args.feedback.clearAll).not.toHaveBeenCalled();
    });

    it('llama onStop ANTES de los efectos de UI (showScreen / show / dispose)', () => {
        const order = [];
        const args = makeArgs({
            onStop:     () => order.push('stop'),
            metrics:    { showScreen: () => order.push('showScreen') },
            finalPanel: { show:       () => order.push('panel') },
            countdown:  { dispose:    () => order.push('countdown') },
        });
        endGame(args);
        expect(order[0]).toBe('stop');
        expect(order).toContain('showScreen');
        expect(order).toContain('panel');
        expect(order).toContain('countdown');
    });
});
