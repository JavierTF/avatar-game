import { describe, it, expect, vi } from 'vitest';
import { endGame } from '../js/game-flow.js';

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
            powers:       { clearAll: vi.fn() },
            trail:        { clearAll: vi.fn() },
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

    it('robusto si finalPanel, countdown, feedback, powers y trail son null', () => {
        const args = makeArgs({ finalPanel: null, countdown: null, feedback: null,
                                powers: null, trail: null });
        expect(() => endGame(args)).not.toThrow();
        expect(args.onStop).toHaveBeenCalled();
        expect(args.metrics.showScreen).toHaveBeenCalled();
    });

    it('llama powers.clearAll() y trail.clearAll() — efectos del frame final no leakean', () => {
        const args = makeArgs();
        endGame(args);
        expect(args.powers.clearAll).toHaveBeenCalledTimes(1);
        expect(args.trail.clearAll).toHaveBeenCalledTimes(1);
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
