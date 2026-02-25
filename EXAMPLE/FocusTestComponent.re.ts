import * as RE from 'rogue-engine';
import { FocusManager } from '../FocusManager';
import { FMLog } from '../utils/FocusLogger';
import { FocusDebugger } from '../utils/FocusDebug';
import { MainMenuUI } from './MainMenuUI';
import { GameUI } from './GameUI';
import { PauseUI } from './PauseUI';
import { GameOverUI } from './GameOverUI';
import { SettingsUI } from './SettingsUI';
import { GlobalOverlayUI } from './GlobalOverlayUI';
import { UILayer } from '../UILayerManager';
import { GameChatUI } from './GameChatUI';
import { GlobalHUD } from './GlobalHUD';
import { FocusEvents } from './FocusEvents';

@RE.registerComponent
export default class FocusTestComponent extends RE.Component {
  private focusManager: FocusManager;

  start() {
    // =================================================================================
    // Welcome to the Focus Framework Example!
    // This component demonstrates how to structure a simple game application flow
    // from simple state transitions to more complex UI management patterns.
    //
    // We will set up states for: Lobby, Game, Pause Menu, Settings, and Game Over.
    // =================================================================================

    // Set to true to enable the debug overlay (toggle with ` key)
    const enableDebugger = true;

    FMLog.log('state', "FocusTestComponent started. Setting up states...");    

    this.focusManager = new FocusManager();

    // =================================================================================
    // 1. GLOBAL & PERSISTENT UI
    // =================================================================================
    // These layers are created manually once and are not tied to any specific state's
    // lifecycle. They persist across all state changes. This is ideal for a global
    // HUD or a persistent overlay.
    const globalHUDLayer = this.focusManager.uiManager.create('global-hud-layer', 50);
    const globalOverlayLayer = this.focusManager.uiManager.create('global-overlay-layer', 100);

    // Instantiate and render the UI controllers for these global layers,
    // passing the FocusManager to enable event bus communication.
    const overlayUI = new GlobalOverlayUI(globalOverlayLayer, this.focusManager);
    overlayUI.render();

    const globalHUD = new GlobalHUD(globalHUDLayer, this.focusManager);
    globalHUD.render();

    // =================================================================================
    // 2. SIMPLE STATES & PRE-DECLARED LAYERS
    // =================================================================================
    // The 'lobby' state is our entry point. It demonstrates pre-declaring all UI
    // layers the application might use. This is a straightforward approach where
    // all layers are created upfront.
    const lobbyState = this.focusManager.create('lobby')
      .ui({
        // Define all layers used in this example.
        layers: {
          'main-menu-layer': 10,
          'game-layer': 10,
          'game-chat-layer': 12,
          'game-over-layer': 15,
          // Note: 'pause-layer' and 'settings-layer' are NOT defined here.
          // They will be created dynamically later to demonstrate a more
          // advanced pattern.
        },
        visible: ['main-menu-layer'],
      })
      .withTransition('fade', 700) // Slower transition for initial load
      .onEnter((payload, ui) => {
        // Pass the FocusManager instance to the UI controller.
        new MainMenuUI(ui.find('main-menu-layer'), this.focusManager).render();
      })
      .onEvent(FocusEvents.LOBBY_JOIN_GAME, (fm, payload) => fm.switch('game', payload));

    const gameState = this.focusManager.create('game')
      .ui({ 
        visible: ['game-layer', 'game-chat-layer', 'global-hud-layer'],
      })
      .onEnter((payload, ui) => {
        // The GameUI now expects a payload (e.g., from the lobby)
        const gameController = new GameUI(ui.find('game-layer'), this.focusManager);
        gameController.render(payload);

        // Also render the chat UI on its own layer
        new GameChatUI(ui.find('game-chat-layer'), this.focusManager).render();
      })
      .onEvent(FocusEvents.GAME_PAUSE, (fm) => fm.push('pause-menu'))
      .onEvent(FocusEvents.GAME_OVER, (fm, payload) => fm.switch('game-over', payload))
      // Add a hotkey to the game state. Pressing 'Escape' will push the pause menu.
      .onKey('keydown', 'Escape', (fm, event) => {
        event.preventDefault();
        fm.push('pause-menu');
      });

    // =================================================================================
    // 3. STATE INHERITANCE & DYNAMIC LAYERS (push/pop)
    // =================================================================================
    // Here, we introduce more advanced concepts:
    // - A 'base-menu' state to share common properties (like transitions).
    // - The 'pause-menu' state, which is PUSHED on top of the 'game' state.
    // - Dynamic layer creation using `ensureLayer`. The 'pause-layer' only
    //   exists when we are in the pause menu.

    const baseMenuState = this.focusManager.create('base-menu')
      .withTransition('fade', 250); // All menus extending this will get this transition by default.

    const pauseMenuState = this.focusManager.create('pause-menu')
      .extends('base-menu') // Inherit from base-menu
      .ensureLayer('pause-layer', 20) // Dynamically create layer on enter if it doesn't exist
      .ui({ 
        visible: ['pause-layer', 'global-hud-layer'],
      })
      .onEnter((payload, ui) => {
        // The 'pause-layer' is guaranteed to exist by the .ensureLayer() call above.
        new PauseUI(ui.find('pause-layer'), this.focusManager).render();
      })
      .onEvent(FocusEvents.PAUSE_RESUME, (fm) => fm.pop())
      .onEvent(FocusEvents.PAUSE_OPEN_SETTINGS, (fm) => fm.push('settings-menu'))
      .onEvent(FocusEvents.PAUSE_QUIT_TO_LOBBY, (fm) => fm.switch('lobby'))
      // Add a hotkey to the pause menu. Pressing 'Escape' will pop the state.
      .onKey('keydown', 'Escape', (fm, event) => {
        event.preventDefault(); // Prevent any default browser behavior for the Escape key.
        fm.pop();
      });

    // =================================================================================
    // 4. COMPLEXITY: PARENT-CHILD UI LAYERS
    // =================================================================================
    // The 'settings-menu' is PUSHED on top of the 'pause-menu'.
    // It demonstrates creating a layer ('settings-layer') as a CHILD of another
    // layer ('pause-layer'). This is useful for complex UI that is built in
    // pieces, like a settings screen that appears within a pause menu panel.
    const settingsMenuState = this.focusManager.create('settings-menu')
      .extends('base-menu') // Inherit from base-menu
      // We only transition to 'settings-menu' from 'pause-menu', so 'pause-layer'
      // is guaranteed to exist and can be used as a parent.
      .ensureLayer('settings-layer', { parent: 'pause-layer' })
      .ui({ 
        // We keep the parent 'pause-layer' visible and show our new 'settings-layer'
        // on top of it.
        visible: ['pause-layer', 'settings-layer', 'global-hud-layer'], 
      })
      // This is the crucial fix. We tell this state NOT to reset the 'pause-layer'
      // when it exits. The 'pause-layer' belongs to the parent 'pause-menu' state,
      // so we need to preserve its content when we pop the 'settings-menu' state.
      .dontResetOnExit('pause-layer')
      .withTransition('fade', 150) // We can override the inherited transition to be faster
      .onEnter((payload, ui) => {
        // The 'settings-layer' is guaranteed to exist by .ensureLayer().
        const settingsLayer = ui.find('settings-layer');

        // --- Fixing the Parent-Child Overlay ---
        // To make the settings panel appear centered on top of the pause panel,
        // we style the `settings-layer` itself to act as a centering container.
        // We reuse the existing CSS class but remove the background to avoid a double-backdrop.
        settingsLayer.addClass('focus-test-panel-container');
        settingsLayer.setStyle({ background: 'none' });

        new SettingsUI(settingsLayer, this.focusManager).render();
      })
      .onEvent(FocusEvents.SETTINGS_BACK, (fm) => fm.pop());

    // =================================================================================
    // 5. FINAL STATES & CUSTOM TRANSITIONS
    // =================================================================================
    // The 'game-over' state is a simple terminal state that demonstrates using a
    // different, more dramatic transition effect.
    const gameOverState = this.focusManager.create('game-over')
      .ui({ 
        visible: ['game-over-layer', 'global-hud-layer'],
      })
      .withTransition('iris', 500) // Use a different transition
      .onEnter((payload, ui) => {
        const uiController = new GameOverUI(ui.find('game-over-layer'), this.focusManager);
        // The payload from the .switch() call is passed to the render method.
        uiController.render(payload);
      })
      .onEvent(FocusEvents.GAMEOVER_BACK_TO_LOBBY, (fm) => fm.switch('lobby'));

    // =================================================================================
    // 6. REGISTRATION & INITIALIZATION
    // =================================================================================
    // All states must be registered with the manager.
    // Note: Base states must be registered before the states that extend them.
    this.focusManager.register(lobbyState);
    this.focusManager.register(gameState);
    this.focusManager.register(baseMenuState);
    this.focusManager.register(pauseMenuState);
    this.focusManager.register(settingsMenuState);
    this.focusManager.register(gameOverState);

    // Set the initial state of the application.
    this.focusManager.switch('lobby');

    // (Optional) Initialize the debugger for real-time state inspection.
    if (enableDebugger) {
      const debuggerInstance = new FocusDebugger(this.focusManager);
      debuggerInstance.init();
    }
  }
}