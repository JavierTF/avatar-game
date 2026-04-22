import { GestureEditor }    from './gesture-editor.js';
import { BallEditor }       from './ball-editor.js';
import { Profiles }         from './profiles.js';
import { Monitor }          from './monitor.js';
import { initFinalMetrics } from './final-metrics.js';

const panels = document.querySelectorAll('.panel');
const navBtns = document.querySelectorAll('nav button');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
    });
});

async function loadConfig() {
    const stored = localStorage.getItem('dsv_config');
    if (stored) {
        try { return JSON.parse(stored); } catch(_) {}
    }
    try {
        const r = await fetch('/config.json');
        return await r.json();
    } catch(_) {
        return { gestures: {}, balls: { red: {}, blue: {}, green: {}, orange: {} }, profiles: [] };
    }
}

function saveConfig(cfg) {
    localStorage.setItem('dsv_config', JSON.stringify(cfg));
}

(async () => {
    const config = await loadConfig();

    const gestureEditor = new GestureEditor(config, saveConfig);
    const ballEditor    = new BallEditor(config, saveConfig);
    const profiles      = new Profiles(config, saveConfig);
    const monitor       = new Monitor();

    gestureEditor.init();
    ballEditor.init();
    profiles.init();
    monitor.init();
    initFinalMetrics();
})();
