import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { createScene } from './scene.js';
import { Player }      from './player.js';
import { Difficulty }  from './difficulty.js';
import { BallManager } from './objects.js';
import { GestureDetector } from './gestures.js';
import { Powers }      from './powers.js';
import { CollisionSystem } from './collision.js';
import { HUD }         from './hud.js';
import { Metrics }     from './metrics.js';
import { PlayerFeedback } from './feedback.js';

let renderer, scene, camera;
let c1, c2, cg1, cg2;
let player, difficulty, balls, gestures, powers, collision, hud, metrics, feedback;
let config;
let clock;
let running = false;
let held1 = false, held2 = false;
let grabbedBall1 = null, grabbedBall2 = null;
let isDesktop = false;
let _mouseDown = false;
let _yaw = 0, _pitch = 0;

const _fwd = new THREE.Vector3();
const _camPos = new THREE.Vector3();

async function loadConfig() {
    try {
        const r = await fetch('/config.json');
        return await r.json();
    } catch (_) {
        return { gestures: {}, balls: { red: {}, blue: {}, green: {}, orange: {} }, profiles: [] };
    }
}

async function init() {
    config = await loadConfig();

    const stored = localStorage.getItem('dsv_config');
    if (stored) {
        try { Object.assign(config, JSON.parse(stored)); } catch(_) {}
    }

    scene    = createScene();
    camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0, 1.6, 3);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    const factory = new XRControllerModelFactory();

    c1 = renderer.xr.getController(0);
    c2 = renderer.xr.getController(1);
    cg1 = renderer.xr.getControllerGrip(0);
    cg2 = renderer.xr.getControllerGrip(1);
    cg1.add(factory.createControllerModel(cg1));
    cg2.add(factory.createControllerModel(cg2));
    scene.add(c1, c2, cg1, cg2);

    const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)
    ]);
    const ray = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
    ray.scale.z = 3;
    c1.add(ray.clone());
    c2.add(ray.clone());

    c1.addEventListener('selectstart', () => { held1 = true; });
    c1.addEventListener('selectend',   () => {
        held1 = false;
        if (grabbedBall1) { _activateGreen(grabbedBall1, c1); grabbedBall1 = null; }
    });
    c2.addEventListener('selectstart', () => { held2 = true; });
    c2.addEventListener('selectend',   () => {
        held2 = false;
        if (grabbedBall2) { _activateGreen(grabbedBall2, c2); grabbedBall2 = null; }
    });

    clock = new THREE.Clock();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('mousedown', () => { _mouseDown = true; });
    window.addEventListener('mouseup',   () => { _mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
        if (!isDesktop || !_mouseDown) return;
        _yaw   -= e.movementX * 0.002;
        _pitch -= e.movementY * 0.002;
        _pitch  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, _pitch));
        camera.rotation.order = 'YXZ';
        camera.rotation.y = _yaw;
        camera.rotation.x = _pitch;
    });

    document.getElementById('btn-role-player').addEventListener('click', () => {
        document.getElementById('role-select').style.display = 'none';
        document.getElementById('overlay').style.display = 'flex';
    });

    document.getElementById('btn-role-instructor').addEventListener('click', () => {
        window.location.href = '/instructor.html';
    });

    document.getElementById('btn-vr').addEventListener('click', () => {
        document.body.appendChild(VRButton.createButton(renderer));
        startGame();
    });

    document.getElementById('btn-desktop').addEventListener('click', () => {
        isDesktop = true;
        startGame();
        renderer.setAnimationLoop(renderLoop);
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        document.getElementById('metrics-screen').style.display = 'none';
        startGame();
    });

    renderer.setAnimationLoop(renderLoop);
}

function startGame() {
    document.getElementById('overlay').style.display = 'none';

    if (balls) balls.removeAll();

    const nivelInicial = parseInt(document.querySelector('input[name="nivel-inicio"]:checked')?.value ?? '1');

    player     = new Player(config);
    difficulty = new Difficulty(nivelInicial);
    balls      = new BallManager(scene, config, difficulty);
    gestures   = new GestureDetector(config);
    powers     = new Powers(scene, player, balls, difficulty);
    collision  = new CollisionSystem(player, balls);
    hud        = new HUD();
    hud.show();
    metrics    = new Metrics();
    feedback   = new PlayerFeedback(scene);

    difficulty.onChange = (nivel) => {
        metrics.maxNivel = nivel;
        balls.applySpeedMultiplier();
    };

    collision.onRedHit = () => {
        player.hit();
        metrics.ballHit('red');
        feedback.spawn('red', _camPos, `♥ ${player.vida}`);
        if (!player.vivo) endGame();
    };

    collision.onBlueHit = () => {
        player.hitBlue();
        metrics.ballHit('blue');
        const label = player.combo > 1 ? `x${player.combo}` : `+${player._puntosAzul}`;
        feedback.spawn('blue', _camPos, label);
    };

    collision.onGreenGrabbed = (ball, ctrl) => {
        if (ctrl === 1) grabbedBall1 = ball;
        else            grabbedBall2 = ball;
    };

    collision.onOrangeHit = (effect) => {
        metrics.ballHit('orange');
        applyOrangeEffect(effect);
    };

    running = true;
}

function applyOrangeEffect(effect) {
    if (effect === 'heal')   player.heal();
    if (effect === 'mana')   player.addMana(50);
    if (effect === 'points') player.puntos += 100;
    if (effect === 'slow') {
        const orig = difficulty.speedMult;
        difficulty.speedMult *= 0.5;
        setTimeout(() => { difficulty.speedMult = orig; }, 5000);
    }
}

function handlePowers(gData) {
    const { delta1, delta2, pos1, pos2 } = gData;

    if (gestures.check('power_escudo', delta1, delta2)) {
        const k = powers.activateEscudo(pos1, pos2);
        if (k !== false) metrics.powerUsed('escudo', 0);
    }
    if (gestures.check('power_sismico', delta1, delta2)) {
        _camPos.setFromMatrixPosition(camera.matrixWorld);
        const k = powers.activateSismico(_camPos);
        if (k !== false) metrics.powerUsed('sismico', k);
    }
    if (gestures.check('power_llama', delta1, delta2)) {
        camera.getWorldDirection(_fwd);
        _camPos.setFromMatrixPosition(camera.matrixWorld);
        const k = powers.activateLlama(_camPos, _fwd);
        if (k !== false) metrics.powerUsed('llama', k);
    }
    if (gestures.check('power_viento', delta1, delta2)) {
        _camPos.setFromMatrixPosition(camera.matrixWorld);
        const k = powers.activateViento(_camPos);
        if (k !== false) metrics.powerUsed('viento', k);
    }

    const greenGesture = gestures.checkGreenActivate(delta1, delta2, held1, held2);
    if (greenGesture.c1 || greenGesture.c2) {
        player.heal();
        metrics.ballHit('green');
    }
}

function _activateGreen(ball, ctrl) {
    const ctrlPos = new THREE.Vector3();
    ctrl.getWorldPosition(ctrlPos);
    const headY = _camPos.y;
    if (ctrlPos.y >= headY - 0.15) {
        player.heal();
        metrics.ballHit('green');
        feedback.spawn('green', _camPos, '+♥');
    }
    balls.remove(ball);
}

function endGame() {
    running = false;
    metrics.showScreen(player, difficulty.nivel);
}

function renderLoop() {
    const delta = clock.getDelta();
    if (!running) {
        renderer.render(scene, camera);
        return;
    }

    difficulty.update(delta);

    _camPos.setFromMatrixPosition(camera.matrixWorld);
    balls.update(delta, _camPos);

    const gData = gestures.update(delta, c1, c2);
    handlePowers(gData);

    collision.update(c1, c2, camera, held1, held2);
    balls.updateGreenHints(difficulty.nivel, gData.pos1, gData.pos2);
    if (grabbedBall1) grabbedBall1.ctrlPos = gData.pos1;
    if (grabbedBall2) grabbedBall2.ctrlPos = gData.pos2;

    powers.update(delta);
    feedback.update(delta);
    player.updateMovimiento(camera, gData.pos1, gData.pos2, delta);

    hud.refresh(player, difficulty.nivel);

    metrics.publishState(player, difficulty.nivel, _camPos, gData.pos1, gData.pos2, balls.getBallPositions());

    renderer.render(scene, camera);
}

init();
