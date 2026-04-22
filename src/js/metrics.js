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
        this.naranjasPorEfecto = { heal: 0, mana: 0, points: 0, slow: 0 };
        this.powers    = {
            escudo:  { used: 0, killed: 0 },
            sismico: { used: 0, killed: 0 },
            llama:   { used: 0, killed: 0 },
            viento:  { used: 0, killed: 0 },
        };
        this.rachaActual      = 0;
        this.rachaMaxSinDaño  = 0;
        this.startTime = Date.now();
        this.maxNivel  = 1;
        this.maxCombo  = 0;
    }

    ballSpawned(type)         { if (this[type + 's']) this[type + 's'].total++; }
    ballHit(type, sub) {
        if (this[type + 's']) this[type + 's'].hit++;
        if (type === 'red') this.rachaActual = 0;
        if (type === 'orange' && sub && this.naranjasPorEfecto[sub] !== undefined) {
            this.naranjasPorEfecto[sub]++;
        }
    }
    redEscaped() {
        this.rachaActual++;
        if (this.rachaActual > this.rachaMaxSinDaño) this.rachaMaxSinDaño = this.rachaActual;
    }
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

    buildHTML(player, nivel) {
        const elapsed = Math.round((Date.now() - this.startTime) / 1000);
        const mins    = Math.floor(elapsed / 60);
        const secs    = elapsed % 60;

        const pctR = this.reds.total   ? this.reds.hit   / this.reds.total   : 0;
        const pctB = this.blues.total  ? this.blues.hit  / this.blues.total  : 0;
        const pctG = this.greens.total ? this.greens.hit / this.greens.total : 0;

        // Para rojas: mejor evaluación = menos golpes recibidos. Invertimos pctR.
        const pctRInv   = 1 - pctR;
        const rEscapadas = Math.max(0, this.reds.total - this.reds.hit);

        const r1 = (n) => Math.round(n * 10) / 10;
        const r2 = (n) => Math.round(n * 100) / 100;

        return `
          <table class="metrics-table">
            <tr><th colspan="2">General</th></tr>
            <tr><td>Tiempo</td><td>${mins}m ${secs}s</td></tr>
            <tr><td>Nivel máximo</td><td>${nivel}</td></tr>
            <tr><td>Puntuación</td><td>${player.puntos}</td></tr>
            <tr><td>Combo máximo</td><td>x${player.maxCombo}</td></tr>
            <tr><td>Intensidad estimada</td><td>${player.intensidad}</td></tr>
          </table>

          <table class="metrics-table">
            <tr><th colspan="2">Cuerpo / cabeza</th></tr>
            <tr><td>Distancia cabeza</td><td>${r1(player.metros)} m</td></tr>
            <tr><td>Velocidad máx. cabeza</td><td>${r1(player.velocidadMaxCabeza)} m/s</td></tr>
            <tr><td>Velocidad media cabeza</td><td>${r2(player.velocidadMediaCabeza)} m/s</td></tr>
            <tr><td>Rango vertical (Y)</td><td>${player.rangoVertical} m</td></tr>
            <tr><td>Rango lateral (X)</td><td>${player.rangoHorizontalX} m</td></tr>
            <tr><td>Rango profundidad (Z)</td><td>${player.rangoProfundidadZ} m</td></tr>
            <tr><td>Área ocupada (X × Z)</td><td>${player.areaOcupada} m²</td></tr>
            <tr><td>Altura promedio cabeza</td><td>${player.alturaPromedioCabeza} m</td></tr>
            <tr><td>Agachadas</td><td>${player.agachadas}</td></tr>
            <tr><td>Saltos</td><td>${player.saltos}</td></tr>
            <tr><td>Desplazamiento lateral total</td><td>${r1(player.desplazamientoLateral)} m</td></tr>
            <tr><td>Tiempo en movimiento</td><td>${player.pctTiempoActivo}%</td></tr>
          </table>

          <table class="metrics-table">
            <tr><th>Brazos</th><th>Derecho</th><th>Izquierdo</th></tr>
            <tr><td>Distancia recorrida</td><td>${r1(player.metrosBrazoDch)} m</td><td>${r1(player.metrosBrazoIzq)} m</td></tr>
            <tr><td>Velocidad máxima</td><td>${r1(player.velocidadMaxBrazoDch)} m/s</td><td>${r1(player.velocidadMaxBrazoIzq)} m/s</td></tr>
            <tr><td>Velocidad media</td><td>${r2(player.velocidadMediaBrazoDch)} m/s</td><td>${r2(player.velocidadMediaBrazoIzq)} m/s</td></tr>
            <tr><td>Altura máxima</td><td>${player.alturaMaxBrazoDch} m</td><td>${player.alturaMaxBrazoIzq} m</td></tr>
            <tr><td>Alcance máximo (desde cabeza)</td><td>${player.alcanceMaxBrazoDch} m</td><td>${player.alcanceMaxBrazoIzq} m</td></tr>
            <tr><td colspan="2">Simetría brazos D/I</td><td>${player.simetriaBrazos}</td></tr>
          </table>

          <table class="metrics-table">
            <tr><th>Bolas</th><th>Golpeadas/activadas</th><th>Aparecidas</th><th>%</th><th>Evaluación</th></tr>
            <tr>
              <td>Rojas (esquivadas: ${rEscapadas})</td>
              <td>${this.reds.hit}</td><td>${this.reds.total}</td>
              <td>${Math.round(pctRInv * 100)}%</td><td>${evalLabel(pctRInv)}</td>
            </tr>
            <tr>
              <td>Azules</td>
              <td>${this.blues.hit}</td><td>${this.blues.total}</td>
              <td>${Math.round(pctB * 100)}%</td><td>${evalLabel(pctB)}</td>
            </tr>
            <tr>
              <td>Verdes</td>
              <td>${this.greens.hit}</td><td>${this.greens.total}</td>
              <td>${Math.round(pctG * 100)}%</td><td>${evalLabel(pctG)}</td>
            </tr>
            <tr>
              <td>Naranjas (total)</td>
              <td>${this.oranges.hit}</td><td>${this.oranges.total}</td>
              <td>—</td><td>—</td>
            </tr>
            <tr><td colspan="5">Naranjas por efecto: ♥ ${this.naranjasPorEfecto.heal} &nbsp;·&nbsp; ♦ ${this.naranjasPorEfecto.mana} &nbsp;·&nbsp; + ${this.naranjasPorEfecto.points} &nbsp;·&nbsp; ⏱ ${this.naranjasPorEfecto.slow}</td></tr>
            <tr><td colspan="5">Racha máxima de rojas esquivadas sin recibir daño: <strong>${this.rachaMaxSinDaño}</strong></td></tr>
          </table>

          <table class="metrics-table">
            <tr><th>Poder</th><th>Usado</th><th>Eliminados</th><th>Evaluación</th></tr>
            ${Object.entries(this.powers).map(([name, p]) => {
                const pct = p.used > 0 ? Math.min(1, p.killed / (p.used * 5)) : 0;
                return `<tr><td>${name}</td><td>${p.used}</td><td>${p.killed}</td><td>${evalLabel(pct)}</td></tr>`;
            }).join('')}
            <tr><td colspan="4">Mana total consumido: <strong>${Math.round(player.manaGastado)}</strong></td></tr>
          </table>
        `;
    }

    showScreen(player, nivel) {
        const html = this.buildHTML(player, nivel);
        document.getElementById('metrics-content').innerHTML = html;
        document.getElementById('metrics-screen').style.display = 'flex';

        // Publica el resumen para que el panel de instructor lo muestre.
        try {
            localStorage.setItem('dsv_final_metrics', JSON.stringify({ html, ts: Date.now() }));
        } catch(_) {}
    }
}
