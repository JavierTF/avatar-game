const EVAL = [
    { label: 'Toph',   min: 0,    max: 0.25 },
    { label: 'Katara', min: 0.25, max: 0.50 },
    { label: 'Zuko',   min: 0.50, max: 0.75 },
    { label: 'Aang',   min: 0.75, max: 1.01 },
];

function evalLabel(pct) {
    return EVAL.find(e => pct >= e.min && pct < e.max)?.label || 'Aang';
}

export class Metrics {
    constructor() {
        this.reset();
    }

    reset() {
        this.reds      = { hit: 0, total: 0 };
        this.blues     = { hit: 0, total: 0 };
        this.greens    = { hit: 0, total: 0 };
        this.oranges   = { hit: 0, total: 0 };
        this.powers    = {
            escudo:  { used: 0, killed: 0 },
            sismico: { used: 0, killed: 0 },
            llama:   { used: 0, killed: 0 },
            viento:  { used: 0, killed: 0 },
        };
        this.startTime = Date.now();
        this.maxNivel  = 1;
        this.maxCombo  = 0;
    }

    ballSpawned(type)         { if (this[type + 's']) this[type + 's'].total++; }
    ballHit(type)             { if (this[type + 's']) this[type + 's'].hit++; }
    powerUsed(name, killed)   { if (this.powers[name]) { this.powers[name].used++; this.powers[name].killed += killed || 0; } }

    publishState(player, nivel, playerPos, c1, c2, balls) {
        try {
            const state = {
                vida:   player.vida,
                mana:   Math.round(player.mana),
                puntos: player.puntos,
                combo:  player.combo,
                nivel,
                metros: Math.round(player.metros * 10) / 10,
                ts:     Date.now(),
            };
            if (playerPos) state.playerPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
            if (c1)        state.c1 = { x: c1.x, y: c1.y, z: c1.z };
            if (c2)        state.c2 = { x: c2.x, y: c2.y, z: c2.z };
            if (balls)     state.balls = balls;
            localStorage.setItem('dsv_state', JSON.stringify(state));
        } catch(_) {}
    }

    showScreen(player, nivel) {
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        const mins    = Math.floor(elapsed / 60);
        const secs    = elapsed % 60;

        const pctR = this.reds.total   ? this.reds.hit   / this.reds.total   : 0;
        const pctB = this.blues.total  ? this.blues.hit  / this.blues.total  : 0;
        const pctG = this.greens.total ? this.greens.hit / this.greens.total : 0;

        const r1 = (n) => Math.round(n * 10) / 10;
        const r0 = (n) => Math.round(n);

        const content = document.getElementById('metrics-content');
        content.innerHTML = `
          <table class="metrics-table">
            <tr><th>Dato</th><th>Valor</th></tr>
            <tr><td>Tiempo</td><td>${mins}m ${secs}s</td></tr>
            <tr><td>Nivel máximo</td><td>${nivel}</td></tr>
            <tr><td>Puntuación</td><td>${player.puntos}</td></tr>
            <tr><td>Combo máximo</td><td>x${player.maxCombo}</td></tr>
          </table>

          <table class="metrics-table">
            <tr><th colspan="2">Movimiento</th></tr>
            <tr><td>Distancia cabeza</td><td>${r1(player.metros)} m</td></tr>
            <tr><td>Distancia brazo derecho</td><td>${r1(player.metrosBrazoDch)} m</td></tr>
            <tr><td>Distancia brazo izquierdo</td><td>${r1(player.metrosBrazoIzq)} m</td></tr>
            <tr><td>Velocidad máx. cabeza</td><td>${r1(player.velocidadMaxCabeza)} m/s</td></tr>
            <tr><td>Velocidad máx. brazo derecho</td><td>${r1(player.velocidadMaxBrazoDch)} m/s</td></tr>
            <tr><td>Velocidad máx. brazo izquierdo</td><td>${r1(player.velocidadMaxBrazoIzq)} m/s</td></tr>
            <tr><td>Rango vertical (agacharse)</td><td>${player.rangoVertical} m</td></tr>
            <tr><td>Agachadas detectadas</td><td>${player.agachadas}</td></tr>
            <tr><td>Desplazamiento lateral</td><td>${r1(player.desplazamientoLateral)} m</td></tr>
            <tr><td>Tiempo en movimiento</td><td>${player.pctTiempoActivo}%</td></tr>
          </table>

          <table class="metrics-table">
            <tr><th>Tipo</th><th>Conseguidas</th><th>Total</th><th>%</th><th>Evaluación</th></tr>
            <tr>
              <td>Rojas (esquivadas)</td>
              <td>${this.reds.hit}</td><td>${this.reds.total}</td>
              <td>${Math.round(pctR * 100)}%</td><td>${evalLabel(pctR)}</td>
            </tr>
            <tr>
              <td>Azules (golpeadas)</td>
              <td>${this.blues.hit}</td><td>${this.blues.total}</td>
              <td>${Math.round(pctB * 100)}%</td><td>${evalLabel(pctB)}</td>
            </tr>
            <tr>
              <td>Verdes (activadas)</td>
              <td>${this.greens.hit}</td><td>${this.greens.total}</td>
              <td>${Math.round(pctG * 100)}%</td><td>${evalLabel(pctG)}</td>
            </tr>
          </table>

          <table class="metrics-table">
            <tr><th>Poder</th><th>Usado</th><th>Eliminados</th><th>Evaluación</th></tr>
            ${Object.entries(this.powers).map(([name, p]) => {
                const pct = p.used > 0 ? Math.min(1, p.killed / (p.used * 5)) : 0;
                return `<tr><td>${name}</td><td>${p.used}</td><td>${p.killed}</td><td>${evalLabel(pct)}</td></tr>`;
            }).join('')}
          </table>
        `;

        document.getElementById('metrics-screen').style.display = 'flex';
    }
}
