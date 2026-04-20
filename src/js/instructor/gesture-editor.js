export class GestureEditor {
    constructor(config, save) {
        this.config  = config;
        this.save    = save;
        this._recording = false;
        this._samples   = [];
    }

    init() {
        document.getElementById('btn-record-start').addEventListener('click', () => this._startRecording());
        document.getElementById('btn-record-stop').addEventListener('click',  () => this._stopRecording());
        this._renderList();
    }

    _startRecording() {
        this._recording = true;
        this._samples   = [];
        document.getElementById('btn-record-start').disabled = true;
        document.getElementById('btn-record-stop').disabled  = false;
        this._setStatus('Grabando gesto... realiza el movimiento con el mando (el juego debe estar en curso).', '#ffee44');

        this._interval = setInterval(() => {
            const state = this._readControllerState();
            if (state) this._samples.push(state);
        }, 50);
    }

    _stopRecording() {
        clearInterval(this._interval);
        this._recording = false;
        document.getElementById('btn-record-start').disabled = false;
        document.getElementById('btn-record-stop').disabled  = true;

        if (this._samples.length < 3) {
            this._setStatus('Grabación demasiado corta o el juego no estaba en curso. Inténtalo de nuevo.', '#ff4444');
            return;
        }

        const action    = document.getElementById('gesture-action').value;
        const twoHands  = action.startsWith('power_');
        const direction = this._computeDirection(this._samples, twoHands);
        const minSpeed  = this._computeMinSpeed(this._samples);

        this.config.gestures[action] = { direction, minSpeed, twoHands, label: action };
        this.save(this.config);
        this._setStatus('Gesto guardado correctamente.', '#88ff88');
        this._renderList();
    }

    _readControllerState() {
        const stored = localStorage.getItem('dsv_state');
        if (!stored) return null;
        try {
            const state = JSON.parse(stored);
            if (!state.c1 || !state.c2) return null;
            return { c1: state.c1, c2: state.c2, ts: state.ts || Date.now() };
        } catch(_) { return null; }
    }

    _computeDirection(samples, twoHands) {
        let dx = 0, dy = 0, dz = 0;
        for (let i = 1; i < samples.length; i++) {
            dx += samples[i].c1.x - samples[i-1].c1.x;
            dy += samples[i].c1.y - samples[i-1].c1.y;
            dz += samples[i].c1.z - samples[i-1].c1.z;
            if (twoHands) {
                dx += samples[i].c2.x - samples[i-1].c2.x;
                dy += samples[i].c2.y - samples[i-1].c2.y;
                dz += samples[i].c2.z - samples[i-1].c2.z;
            }
        }
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
        return [+(dx/len).toFixed(4), +(dy/len).toFixed(4), +(dz/len).toFixed(4)];
    }

    _computeMinSpeed(samples) {
        let sum = 0;
        for (let i = 1; i < samples.length; i++) {
            const dx = samples[i].c1.x - samples[i-1].c1.x;
            const dy = samples[i].c1.y - samples[i-1].c1.y;
            const dz = samples[i].c1.z - samples[i-1].c1.z;
            sum += Math.sqrt(dx*dx + dy*dy + dz*dz);
        }
        const avgPerSample = samples.length > 1 ? sum / (samples.length - 1) : 0;
        const perFrameEstimate = avgPerSample * (16 / 50);
        return +Math.max(0.005, perFrameEstimate * 0.3).toFixed(4);
    }

    _setStatus(msg, color) {
        const el = document.getElementById('record-status');
        el.className = 'status';
        el.style.color = color;
        el.textContent = msg;
    }

    _renderList() {
        const el = document.getElementById('gesture-list');
        el.innerHTML = '';
        for (const [key, g] of Object.entries(this.config.gestures || {})) {
            const item = document.createElement('div');
            item.className = 'gesture-item';
            item.innerHTML = `
              <span>${key}</span>
              <span style="color:#aaa;font-size:0.8rem">dir: [${(g.direction||[]).map(v => v.toFixed(2)).join(', ')}] spd: ${g.minSpeed}</span>
              <button class="action" style="margin:0;padding:0.3rem 0.8rem;font-size:0.8rem" data-key="${key}">Borrar</button>
            `;
            item.querySelector('button').addEventListener('click', () => {
                delete this.config.gestures[key];
                this.save(this.config);
                this._renderList();
            });
            el.appendChild(item);
        }
    }
}
