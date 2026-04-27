import * as THREE from 'three';

const _wp  = new THREE.Vector3();
const _head = new THREE.Vector3();

const BALL_R       = 0.15;
const CTRL_R       = 0.08;
const HEAD_R       = 0.18;
const BODY_R       = 0.25;  // radio XZ del torso/piernas
// La verde necesita un radio más generoso para que el agarre con gatillo
// sea fácil de provocar — golpe directo es de 0.23, agarre 0.45.
const GREEN_GRAB_R = BALL_R + CTRL_R + 0.22;

export class CollisionSystem {
    constructor(player, ballManager) {
        this.player      = player;
        this.ballManager = ballManager;
        this.onBlueHit      = null;
        this.onRedHit       = null;
        this.onGreenGrabbed = null;
    }

    update(c1, c2, camera, held1, held2) {
        _head.setFromMatrixPosition(camera.matrixWorld);
        c1.getWorldPosition(_wp);
        const p1 = _wp.clone();
        c2.getWorldPosition(_wp);
        const p2 = _wp.clone();

        for (let i = this.ballManager.balls.length - 1; i >= 0; i--) {
            const ball = this.ballManager.balls[i];
            const bp   = ball.mesh.position;
            const r    = BALL_R + CTRL_R;

            const hit1 = p1.distanceTo(bp) < r;
            const hit2 = p2.distanceTo(bp) < r;
            const headHit = _head.distanceTo(bp) < BALL_R + HEAD_R;
            // Cilindro corporal: desde el suelo hasta la cabeza, radio XZ
            // BODY_R. Cubre torso, piernas y pies — cualquier parte del
            // jugador cuenta como impacto, no sólo cabeza y mandos.
            const dxz = Math.hypot(bp.x - _head.x, bp.z - _head.z);
            const bodyHit = dxz < BALL_R + BODY_R && bp.y < _head.y && bp.y > 0;

            if (ball.type === 'red') {
                if (hit1 || hit2 || headHit || bodyHit) {
                    const pos = ball.mesh.position.clone();
                    this.ballManager.remove(ball);
                    if (this.onRedHit) this.onRedHit(pos);
                }
            } else if (ball.type === 'blue') {
                if (hit1 || hit2) {
                    const pos = ball.mesh.position.clone();
                    this.ballManager.remove(ball);
                    if (this.onBlueHit) this.onBlueHit(pos);
                }
            } else if (ball.type === 'green') {
                if (ball.grabbed || ball._wall) continue;
                const gh1 = p1.distanceTo(bp) < GREEN_GRAB_R;
                const gh2 = p2.distanceTo(bp) < GREEN_GRAB_R;
                if (gh1 && held1) {
                    ball.grabbed = true;
                    ball.ctrlPos = p1.clone();
                    ball.mesh.position.copy(p1);
                    if (this.onGreenGrabbed) this.onGreenGrabbed(ball, 1);
                } else if (gh2 && held2) {
                    ball.grabbed = true;
                    ball.ctrlPos = p2.clone();
                    ball.mesh.position.copy(p2);
                    if (this.onGreenGrabbed) this.onGreenGrabbed(ball, 2);
                }
            }
        }
    }
}
