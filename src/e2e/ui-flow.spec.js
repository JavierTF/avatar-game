import { test, expect } from '@playwright/test';

test.describe('Pantalla de selección de rol', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('muestra la pantalla de rol al cargar', async ({ page }) => {
        await expect(page.locator('#role-select')).toBeVisible();
    });

    test('muestra las tarjetas Jugador e Instructor', async ({ page }) => {
        await expect(page.locator('#btn-role-player')).toBeVisible();
        await expect(page.locator('#btn-role-instructor')).toBeVisible();
    });

    test('el overlay del jugador está oculto al inicio', async ({ page }) => {
        await expect(page.locator('#overlay')).toBeHidden();
    });
});

test.describe('Flujo del jugador', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-role-player');
    });

    test('al elegir Jugador desaparece la pantalla de rol', async ({ page }) => {
        await expect(page.locator('#role-select')).toBeHidden();
    });

    test('al elegir Jugador aparece el overlay con opciones', async ({ page }) => {
        await expect(page.locator('#overlay')).toBeVisible();
    });

    test('el overlay muestra los tres niveles de inicio', async ({ page }) => {
        await expect(page.locator('input[name="nivel-inicio"][value="1"]')).toBeVisible();
        await expect(page.locator('input[name="nivel-inicio"][value="2"]')).toBeVisible();
        await expect(page.locator('input[name="nivel-inicio"][value="3"]')).toBeVisible();
    });

    test('nivel 1 está seleccionado por defecto', async ({ page }) => {
        const radio = page.locator('input[name="nivel-inicio"][value="1"]');
        await expect(radio).toBeChecked();
    });

    test('el HUD está oculto antes de empezar', async ({ page }) => {
        await expect(page.locator('#hud')).toBeHidden();
    });

    test('al iniciar modo escritorio el HUD es visible', async ({ page }) => {
        await page.click('#btn-desktop');
        await expect(page.locator('#hud')).toBeVisible();
    });

    test('al iniciar modo escritorio se ven vida y mana', async ({ page }) => {
        await page.click('#btn-desktop');
        await expect(page.locator('#hud-vida')).toBeVisible();
        await expect(page.locator('#hud-mana')).toBeVisible();
        await expect(page.locator('#hud-pts')).toBeVisible();
        await expect(page.locator('#hud-nivel')).toBeVisible();
    });

    test('la vida inicial muestra 5 corazones', async ({ page }) => {
        await page.click('#btn-desktop');
        await expect(page.locator('#hud-vida')).toHaveText('♥♥♥♥♥');
    });

    test('el mana inicial es 0%', async ({ page }) => {
        await page.click('#btn-desktop');
        await expect(page.locator('#hud-mana')).toHaveText('Mana: 0%');
    });

    test('el nivel mostrado coincide con el seleccionado', async ({ page }) => {
        await page.click('input[name="nivel-inicio"][value="2"]');
        await page.click('#btn-desktop');
        await expect(page.locator('#hud-nivel')).toHaveText('Nivel 2');
    });
});

test.describe('Flujo del instructor', () => {
    test('al elegir Instructor redirige a instructor.html', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-role-instructor');
        await expect(page).toHaveURL(/instructor\.html/);
    });

    test('instructor.html carga correctamente', async ({ page }) => {
        await page.goto('/instructor.html');
        await expect(page.locator('nav')).toBeVisible();
        await expect(page.locator('h2')).toBeVisible();
    });
});
