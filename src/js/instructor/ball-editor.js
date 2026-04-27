export class BallEditor {
    constructor(config, save) {
        this.config = config;
        this.save   = save;
    }

    init() {
        const typeEl    = document.getElementById('ball-type');
        const speedEl   = document.getElementById('ball-speed');
        const speedVal  = document.getElementById('ball-speed-val');
        const coneAEl   = document.getElementById('cone-angle');
        const coneAVal  = document.getElementById('cone-angle-val');
        const coneWEl   = document.getElementById('cone-width');
        const coneWVal  = document.getElementById('cone-width-val');
        const redOpts   = document.getElementById('red-options');
        const saveBtn   = document.getElementById('btn-save-ball');

        const loadType = (type) => {
            const cfg = this.config.balls[type] || {};
            speedEl.value  = cfg.speed      || 0.015;
            coneAEl.value  = cfg.coneAngle  || 90;
            coneWEl.value  = cfg.coneWidth  || 60;
            speedVal.textContent = speedEl.value;
            coneAVal.textContent = coneAEl.value + '°';
            coneWVal.textContent = coneWEl.value + '°';
            if (redOpts) redOpts.style.display = type === 'red' ? 'block' : 'none';
            if (type === 'red') {
                const patEl = document.getElementById('red-pattern');
                if (patEl) patEl.value = cfg.pattern || 'homing';
            }
        };

        typeEl.addEventListener('change', () => loadType(typeEl.value));
        speedEl.addEventListener('input', () => { speedVal.textContent = speedEl.value; });
        coneAEl.addEventListener('input', () => {
            coneAEl.value = Math.min(160, coneAEl.value);
            coneAVal.textContent = coneAEl.value + '°';
        });
        coneWEl.addEventListener('input', () => {
            coneWEl.value = Math.min(160, coneWEl.value);
            coneWVal.textContent = coneWEl.value + '°';
        });

        saveBtn.addEventListener('click', () => {
            const type = typeEl.value;
            if (!this.config.balls[type]) this.config.balls[type] = {};
            this.config.balls[type].speed     = parseFloat(speedEl.value);
            this.config.balls[type].coneAngle = parseInt(coneAEl.value);
            this.config.balls[type].coneWidth = parseInt(coneWEl.value);
            if (type === 'red') {
                const patEl = document.getElementById('red-pattern');
                if (patEl) this.config.balls[type].pattern = patEl.value;
            }
            this.save(this.config);
            const st = document.getElementById('ball-status');
            st.className = 'status ok';
            st.textContent = 'Configuración guardada.';
            setTimeout(() => { st.textContent = ''; }, 2000);
        });

        loadType(typeEl.value);
    }
}
