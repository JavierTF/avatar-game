// Muestra el resumen de partida en el panel del instructor cuando el jugador
// termina la partida. El juego publica `dsv_final_metrics` en localStorage;
// al ser distintas pestañas/ventanas, aquí escuchamos el evento `storage`.

const KEY = 'dsv_final_metrics';

function render(html) {
    const content = document.getElementById('final-metrics-content');
    const overlay = document.getElementById('final-metrics-overlay');
    if (!content || !overlay) return;
    content.innerHTML = html;
    overlay.style.display = 'flex';
}

function hide() {
    const overlay = document.getElementById('final-metrics-overlay');
    if (overlay) overlay.style.display = 'none';
}

export function initFinalMetrics() {
    const btn = document.getElementById('btn-close-final-metrics');
    if (btn) btn.addEventListener('click', hide);

    window.addEventListener('storage', (e) => {
        if (e.key !== KEY) return;
        if (!e.newValue) { hide(); return; }
        try { render(JSON.parse(e.newValue).html); } catch(_) {}
    });

    // Si el instructor abre el panel después de terminar una partida, muestra
    // el último resumen disponible.
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) render(JSON.parse(raw).html);
    } catch(_) {}
}
