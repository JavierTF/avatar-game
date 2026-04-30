// Lógica de flujo del juego que antes vivía inline en main.js. Se extrae
// para poder testear las orquestaciones que main.js no permite (DOM-coupled).

// Convierte una bola verde agarrada en muro vía balls.dropAsWall, y dispara
// el feedback adecuado (sonido y métrica) según éxito o fracaso del drop.
//
// Antes el caso de fracaso quedaba sin feedback alguno: la bola desaparecía
// silenciosamente y el jugador no sabía por qué su intento de muro no había
// funcionado.
export function activateGreen(ball, ctrlPos, playerPos, balls, metrics, sound) {
    if (balls.dropAsWall(ball, ctrlPos, playerPos)) {
        metrics.ballHit('green');
        sound.life();
        return true;
    }
    sound.negative();
    return false;
}

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
}) {
    if (alreadyEnded) return false;
    onStop();
    metrics.showScreen(player, nivel);
    if (finalPanel) finalPanel.show(player, nivel, metrics, cameraPos);
    if (countdown) countdown.dispose();
    // Limpia popups que pudieran haber quedado del último frame (un golpe
    // letal spawnea un popup justo antes de endGame; sin esto, el sprite
    // queda huérfano en la escena).
    if (feedback) feedback.clearAll();
    return true;
}
