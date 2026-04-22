import * as THREE from 'three';

const _wp  = new THREE.Vector3();
const _head = new THREE.Vector3();

const BALL_R       = 0.15;
const CTRL_R       = 0.08;
const HEAD_R       = 0.18;

export class CollisionSystem {
    constructor(player, ballManager) {
        this.player      = player;
        this.ballManager = ballManager;
        this.onBlueHit      = null;
        this.onRedHit       = null;
        this.onGreenGrabbed = null;
        this.onOrangeHit    = null;
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

            if (ball.type === 'red') {
                if ((hit1 || hit2) || headHit) {
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
                if (ball.grabbed) continue;
                if (hit1 && held1) {
                    ball.grabbed = true;
                    if (this.onGreenGrabbed) this.onGreenGrabbed(ball, 1);
                } else if (hit2 && held2) {
                    ball.grabbed = true;
                    if (this.onGreenGrabbed) this.onGreenGrabbed(ball, 2);
                }
            } else if (ball.type === 'orange') {
                if (!ball._bounced && (hit1 || hit2)) {
                    const ctrlPos = hit1 ? p1 : p2;
                    // Rebote hacia el lado contrario al impacto:
                    // dirección = (bola - mando), así sale alejándose.
                    const bounceDir = new THREE.Vector3()
                        .subVectors(ball.mesh.position, ctrlPos)
                        .normalize();
                    ball.velocity.copy(bounceDir.multiplyScalar(0.04));
                    ball._bounced = true;
                    if (this.onOrangeHit) this.onOrangeHit(ball.cfg.effect);
                }
            }
        }
    }
}
