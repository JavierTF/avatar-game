import * as THREE from 'three';

const BALL_COLORS = { red: 0xff2222, blue: 0x2255ff, green: 0x22cc55, orange: 0xff8800 };
const _ballGeo = new THREE.SphereGeometry(0.15, 8, 8);
const _ctrlGeo = new THREE.SphereGeometry(0.06, 6, 6);

export class Monitor {
    constructor() {
        this._scene      = null;
        this._camera     = null;
        this._renderer   = null;
        this._avatar     = null;
        this._ctrl1      = null;
        this._ctrl2      = null;
        this._ballMeshes = [];
        this._hasLivePos = false;
        this._running    = false;
    }

    init() {
        const canvas = document.getElementById('monitor-canvas');
        if (!canvas) return;

        this._scene  = new THREE.Scene();
        this._scene.background = new THREE.Color(0x111122);

        this._camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 50);
        this._camera.position.set(0, 8, 6);
        this._camera.lookAt(0, 0, 0);

        this._scene.add(new THREE.HemisphereLight(0x8899cc, 0x443344, 1));

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(8, 8),
            new THREE.MeshStandardMaterial({ color: 0x222233 })
        );
        floor.rotation.x = -Math.PI / 2;
        this._scene.add(floor);

        const roomEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 5, 8)),
            new THREE.LineBasicMaterial({ color: 0x4455cc, transparent: true, opacity: 0.3 })
        );
        roomEdges.position.y = 2.5;
        this._scene.add(roomEdges);

        this._avatar = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.2, 0.8, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x88aaff })
        );
        this._avatar.position.set(0, 1, 0);
        this._scene.add(this._avatar);

        this._ctrl1 = new THREE.Mesh(_ctrlGeo, new THREE.MeshStandardMaterial({ color: 0xffcc44 }));
        this._ctrl2 = new THREE.Mesh(_ctrlGeo, new THREE.MeshStandardMaterial({ color: 0xffcc44 }));
        this._scene.add(this._ctrl1, this._ctrl2);

        this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this._renderer.setSize(canvas.clientWidth, canvas.clientHeight);

        this._running = true;
        this._loop();
        this._pollState();
    }

    _pollState() {
        if (!this._running) return;
        try {
            const raw = localStorage.getItem('dsv_state');
            if (raw) {
                const state = JSON.parse(raw);
                this._updateStats(state);
                this._updateScene(state);
            }
        } catch(_) {}
        setTimeout(() => this._pollState(), 200);
    }

    _updateScene(state) {
        if (state.playerPos) {
            this._hasLivePos = true;
            this._avatar.position.set(state.playerPos.x, state.playerPos.y - 0.5, state.playerPos.z);
        }
        if (state.c1 && this._ctrl1) this._ctrl1.position.set(state.c1.x, state.c1.y, state.c1.z);
        if (state.c2 && this._ctrl2) this._ctrl2.position.set(state.c2.x, state.c2.y, state.c2.z);
        this._updateBalls(state.balls || []);
    }

    _updateBalls(ballData) {
        while (this._ballMeshes.length > ballData.length) {
            const mesh = this._ballMeshes.pop();
            this._scene.remove(mesh);
            mesh.material.dispose();
        }
        for (let i = 0; i < ballData.length; i++) {
            const b = ballData[i];
            if (i >= this._ballMeshes.length) {
                const mesh = new THREE.Mesh(
                    _ballGeo,
                    new THREE.MeshStandardMaterial({ color: BALL_COLORS[b.type] || 0xffffff })
                );
                this._scene.add(mesh);
                this._ballMeshes.push(mesh);
            }
            this._ballMeshes[i].position.set(b.x, b.y, b.z);
            this._ballMeshes[i].material.color.setHex(BALL_COLORS[b.type] || 0xffffff);
        }
    }

    _updateStats(state) {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        set('mon-vida',   '♥'.repeat(state.vida || 0));
        set('mon-mana',   (state.mana || 0) + '%');
        set('mon-puntos', state.puntos || 0);
        set('mon-combo',  'x' + (state.combo || 0));
        set('mon-nivel',  state.nivel || 1);
        set('mon-metros', (state.metros || 0) + 'm');
    }

    _loop() {
        if (!this._running) return;
        requestAnimationFrame(() => this._loop());
        if (!this._hasLivePos) this._avatar.rotation.y += 0.005;
        this._renderer.render(this._scene, this._camera);
    }
}
