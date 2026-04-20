export class Profiles {
    constructor(config, save) {
        this.config = config;
        this.save   = save;
    }

    init() {
        document.getElementById('btn-save-profile').addEventListener('click', () => {
            const name = document.getElementById('profile-name').value.trim();
            if (!name) return;
            if (!this.config.profiles) this.config.profiles = [];
            const existing = this.config.profiles.findIndex(p => p.name === name);
            const snapshot = {
                name,
                gestures: JSON.parse(JSON.stringify(this.config.gestures)),
                balls:    JSON.parse(JSON.stringify(this.config.balls)),
                savedAt:  new Date().toLocaleString(),
            };
            if (existing !== -1) {
                this.config.profiles[existing] = snapshot;
            } else {
                this.config.profiles.push(snapshot);
            }
            this.save(this.config);
            this._renderList();
        });

        document.getElementById('btn-export-profile').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this.config, null, 2)], { type: 'application/json' });
            const a    = document.createElement('a');
            a.href     = URL.createObjectURL(blob);
            a.download = 'config.json';
            a.click();
        });

        this._renderList();
    }

    _renderList() {
        const el = document.getElementById('profile-list');
        el.innerHTML = '';
        for (const p of (this.config.profiles || [])) {
            const item = document.createElement('div');
            item.className = 'profile-item';
            item.innerHTML = `
              <span>${p.name} <span style="color:#666;font-size:0.8rem">${p.savedAt || ''}</span></span>
              <div>
                <button class="action" style="margin:0;padding:0.3rem 0.8rem;font-size:0.8rem" data-action="load" data-name="${p.name}">Cargar</button>
                <button class="action danger" style="margin:0 0 0 0.3rem;padding:0.3rem 0.8rem;font-size:0.8rem" data-action="delete" data-name="${p.name}">Borrar</button>
              </div>
            `;
            item.querySelector('[data-action="load"]').addEventListener('click', () => {
                this.config.gestures = JSON.parse(JSON.stringify(p.gestures));
                this.config.balls    = JSON.parse(JSON.stringify(p.balls));
                this.save(this.config);
                alert(`Perfil "${p.name}" cargado. Recarga el juego para aplicar los cambios.`);
            });
            item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                this.config.profiles = this.config.profiles.filter(x => x.name !== p.name);
                this.save(this.config);
                this._renderList();
            });
            el.appendChild(item);
        }
    }
}
