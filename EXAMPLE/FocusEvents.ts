export const FocusEvents = {
    // Lobby
    LOBBY_JOIN_GAME: 'lobby:joinGame',

    // Game
    GAME_PAUSE: 'game:pause',
    GAME_OVER: 'game:over',

    // Pause Menu
    PAUSE_RESUME: 'pause:resume',
    PAUSE_OPEN_SETTINGS: 'pause:openSettings',
    PAUSE_QUIT_TO_LOBBY: 'pause:quitToLobby',

    // Settings Menu
    SETTINGS_BACK: 'settings:back',

    // Game Over
    GAMEOVER_BACK_TO_LOBBY: 'gameover:backToLobby',

    // Global Overlay
    GLOBAL_OVERLAY_SHOW: 'global-overlay:show',
    GLOBAL_OVERLAY_HIDE: 'global-overlay:hide',
    GLOBAL_OVERLAY_TOGGLE: 'global-overlay:toggle',
} as const;