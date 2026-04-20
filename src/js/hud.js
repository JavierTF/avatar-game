export class HUD {
    constructor() {
        this._vida  = document.getElementById('hud-vida');
        this._mana  = document.getElementById('hud-mana');
        this._pts   = document.getElementById('hud-pts');
        this._nivel = document.getElementById('hud-nivel');
        this._combo = document.getElementById('hud-combo');
    }

    show() {
        document.getElementById('hud').style.display = 'flex';
        this._nivel.style.display = 'block';
        this._combo.style.display = 'block';
    }

    refresh(player, nivel) {
        const hearts = '♥'.repeat(player.vida) + '♡'.repeat(Math.max(0, player.maxVida - player.vida));
        this._vida.textContent  = hearts;
        this._mana.textContent  = `Mana: ${Math.round(player.mana)}%`;
        this._pts.textContent   = `Pts: ${player.puntos}`;
        this._nivel.textContent = `Nivel ${nivel}`;
        this._combo.textContent = player.combo > 1 ? `x${player.combo} COMBO` : '';
    }
}
