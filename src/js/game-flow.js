// Lógica de flujo del juego que antes vivía inline en main.js. Se extrae
// para poder testear las orquestaciones que main.js no permite (DOM-coupled).

// Orquesta el final de partida con guard idempotente.
//
// `alreadyEnded` evita el doble disparo si en el mismo frame: (a) el
// jugador muere por una roja Y (b) el tiempo expira; antes ambos llamaban
// a endGame() y el panel se regeneraba dos veces innecesariamente.
//
// Devuelve true si efectivamente terminó la partida en esta llamada,
// false si era un duplicado.
export function endGame({
    alreadyEnded,
    onStop,
    player,
    nivel,
    metrics,
    finalPanel,
    cameraPos,
    countdown,
    feedback,
    powers,
    trail,
}) {
    if (alreadyEnded) return false;
    onStop();
    metrics.showScreen(player, nivel);
    if (finalPanel) finalPanel.show(player, nivel, metrics, cameraPos);
    if (countdown) countdown.dispose();
    // Limpia efectos visuales pendientes del último frame. Sin esto, los
    // sprites quedan congelados en escena indefinidamente porque el resto
    // del renderLoop se salta tras endGame intra-frame:
    //   - feedback popups (♥ N del golpe letal)
    //   - powers FX (escudo/sismico/llama/viento si dispararon en el mismo frame)
    //   - controller trail (puntos de estela acumulados)
    if (feedback) feedback.clearAll();
    if (powers)   powers.clearAll();
    if (trail)    trail.clearAll();
    return true;
}
