import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    scene.add(new THREE.HemisphereLight(0x8899cc, 0x443344, 0.9));

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 6, 2);
    dir.castShadow = true;
    dir.shadow.camera.top    =  5;
    dir.shadow.camera.bottom = -5;
    dir.shadow.camera.right  =  5;
    dir.shadow.camera.left   = -5;
    dir.shadow.mapSize.set(2048, 2048);
    scene.add(dir);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 1.0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const roomGeo = new THREE.BoxGeometry(8, 5, 8);
    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(roomGeo),
        new THREE.LineBasicMaterial({ color: 0x4455cc, transparent: true, opacity: 0.4 })
    );
    edges.position.y = 2.5;
    scene.add(edges);

    const walls = new THREE.Mesh(
        roomGeo,
        new THREE.MeshStandardMaterial({ color: 0x2233aa, transparent: true, opacity: 0.04, side: THREE.BackSide })
    );
    walls.position.y = 2.5;
    scene.add(walls);

    return scene;
}

export const BOUNDS = { x: 3.5, yMin: 0.3, yMax: 4.5, z: 3.5 };
