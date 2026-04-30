import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { createScene } from './scene.js';
import { Player }      from './player.js';
import { Difficulty }  from './difficulty.js';
import { BallManager, GREEN_GRAB_R } from './objects.js';
import { GestureDetector } from './gestures.js';
import { Powers }      from './powers.js';
import { CollisionSystem } from './collision.js';
import { HUD }         from './hud.js';
import { Metrics }     from './metrics.js';
import { PlayerFeedback } from './feedback.js';
import { ControllerTrail } from './trail.js';
import { SoundFX } from './sound.js';

let renderer, scene, camera;
let c1, c2, cg1, cg2;
let player, difficulty, balls, gestures, powers, collision, hud, metrics, feedback, trail;
const sound = new SoundFX();
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

// Posición fija (en mundo) donde aparecen las métricas de feedback:
// al frente, lejos, algo arriba, un poco a la derecha de donde vienen las bolas.
function _metricBillboard() {
    return {
        x: _camPos.x + 1.5 + (Math.random() - 0.5) * 0.4,
        y: 2.4,
        z: _camPos.z - 4.0,
    };
}

async function loadConfig() {
    try {
        const r = await fetch('/config.json');
        return await r.json();
    } catch (_) {
        return { gestures: {}, balls: { red: {}, blue: {}, green: {} }, profiles: [] };
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

    trail = new ControllerTrail(scene);

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

    c1.addEventListener('selectstart', () => { held1 = true; _tryGrabGreen(c1, 1); });
    c1.addEventListener('selectend',   () => {
        held1 = false;
        if (grabbedBall1) { _activateGreen(grabbedBall1, c1); grabbedBall1 = null; }
    });
    c2.addEventListener('selectstart', () => { held2 = true; _tryGrabGreen(c2, 2); });
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
        sound.init();
        document.body.appendChild(VRButton.createButton(renderer));
        startGame();
    });

    document.getElementById('btn-desktop').addEventListener('click', () => {
        sound.init();
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

    try { localStorage.removeItem('dsv_final_metrics'); } catch(_) {}

    if (balls) balls.removeAll();

    // Reset del estado XR — si el jugador llegó a game over con el trigger
    // apretado, held1/held2 quedaban en true y grabbedBall1/2 referenciaban
    // bolas eliminadas. Sin este reset el primer trigger del nuevo juego
    // podía no agarrar (ctrlBusy=true por referencia colgante) y los poderes
    // de dos manos podían dispararse antes de tiempo.
    held1 = false;
    held2 = false;
    grabbedBall1 = null;
    grabbedBall2 = null;

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

    balls.onBallSpawned = (type) => metrics.ballSpawned(type);
    balls.onRedEscaped  = ()     => metrics.redEscaped();
    balls.onWallHit     = ()     => sound.negative();

    collision.onRedHit = (hitPos) => {
        player.hit();
        metrics.ballHit('red');
        feedback.spawn('red', hitPos, `♥ ${player.vida}`, _metricBillboard());
        sound.negative();
        if (!player.vivo) endGame();
    };

    collision.onBlueHit = (hitPos) => {
        player.hitBlue();
        metrics.ballHit('blue');
        feedback.spawn('blue', hitPos, `♦ ${Math.round(player.mana)}`, _metricBillboard());
        sound.magic();
    };

    collision.onGreenGrabbed = (ball, ctrl) => {
        if (ctrl === 1) grabbedBall1 = ball;
        else            grabbedBall2 = ball;
    };

    running = true;
}

function handlePowers(gData) {
    // Los poderes sólo pueden activarse con ambos gatillos presionados.
    if (!held1 || !held2) return;

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

// Agarre inmediato al pulsar el gatillo: si hay una verde en rango y el mando
// no tiene ya una bola, la agarramos en el mismo evento, sin esperar al
// próximo tick de collision.update. Cubre pulsaciones cortas y evita que un
// segundo selectstart sin selectend en medio (XR quirk) deje huérfana la
// primera bola.
function _tryGrabGreen(ctrl, idx) {
    if (!balls) return;
    const already = idx === 1 ? !!grabbedBall1 : !!grabbedBall2;
    const grabbed = balls.tryGrabGreen(ctrl, idx, already);
    if (grabbed) {
        if (idx === 1) grabbedBall1 = grabbed;
        else            grabbedBall2 = grabbed;
    }
}

function _activateGreen(ball, ctrl) {
    const ctrlPos = new THREE.Vector3();
    ctrl.getWorldPosition(ctrlPos);

    if (balls.dropAsWall(ball, ctrlPos, _camPos)) {
        metrics.ballHit('green');
        sound.life();
    }
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

    // Posiciones de mandos PRIMERO. Si una bola está agarrada, le asignamos
    // la posición fresca del mando ANTES de que balls.update llame a _moveBall —
    // así la bola sigue al mando sin un frame de retraso.
    const gData = gestures.update(delta, c1, c2);
    if (grabbedBall1) grabbedBall1.ctrlPos = gData.pos1;
    if (grabbedBall2) grabbedBall2.ctrlPos = gData.pos2;

    balls.update(delta, _camPos);
    handlePowers(gData);

    collision.update(c1, c2, camera, held1, held2, !!grabbedBall1, !!grabbedBall2);
    balls.updateGreenHints(gData.pos1, gData.pos2);

    powers.update(delta);
    feedback.update(delta);
    trail.update(delta, held1 && held2, gData.pos1, gData.pos2);
    player.updateMovimiento(camera, gData.pos1, gData.pos2, delta);

    hud.refresh(player, difficulty.nivel);

    metrics.publishState(player, difficulty.nivel, _camPos, gData.pos1, gData.pos2, balls.getBallPositions());

    // Fin de partida por tiempo: 1 minuto de duración.
    if (metrics.expirado()) endGame();

    renderer.render(scene, camera);
}

init();
