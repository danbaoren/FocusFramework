# Focus Framework

### Overview

Focus Framework provides a structured, decoupled way to handle the flow of your application—from the main menu, to the game, to pause screens, and back. It is not a UI library itself, but a powerful orchestrator that manages when your UI and 3D assets should appear, disappear, and be cleaned up.

### Core Goals

- **State-Driven Architecture:** Structure your application around clear, distinct states (e.g., `lobby`, `game`, `settings`).
- **Decoupling:** Separate UI rendering, game logic, and state transitions. Components communicate through a central event bus, not direct calls.
- **Lifecycle Management:** Automate the setup and teardown of UI layers, event listeners, and 3D prefabs as you move between states.
- **Developer Experience:** A fluent, chainable API and a built-in visual debugger make defining and inspecting application flow simple and intuitive.

### Features

- **State Stack:** `push` and `pop` states for overlay menus (like pause or settings) without losing the underlying state (like the game).
- **UI Layer Manager:** Create, show, hide, and nest HTML/CSS layers. UI can be persistent across states or tied to a specific state's lifecycle.
- **Event Bus:** A simple event bus for communication between UI components and the state machine.
- **Prefab Management:** Automatically instantiate RogueEngine prefabs on state entry and destroy them on exit.
- **Scene Cleanup:** Option to completely "nuke" the 3D scene when entering a state to ensure a clean slate.
- **State Inheritance:** Define `base` states to share common configurations (like transitions or UI layers) with other states.
- **Custom Transitions:** A system for registering and using custom screen transitions (e.g., fade, wipe, iris) between states.
- **Visual Debugger:** A toggleable overlay (`\` key) to see all registered states, view their configuration, and manually switch between them for easy testing.

### How It Works

The framework is centered around the `FocusManager`. You define each part of your application as a `FocusState`.

1. **Create a `FocusManager`:** This is the central controller for your application's state.
2. **Define States:** Use a fluent builder to define each state:
  - `create('lobby')`: Defines a state named 'lobby'.
  - `.ui({ visible: ['main-menu-layer'] })`: Specifies which HTML layer(s) are visible in this state.
  - `.onEnter((payload, ui) => { ... })`: A hook that runs when entering the state. This is where you typically render your UI.
  - `.onEvent('event-name', (fm) => fm.switch('game'))`: Listens for an event and triggers a state transition.
  - `.withPrefabs('MyLevel')`: Manages 3D assets for the state.
3. **Create UI Controllers:** These are classes (usually extending `BaseUI`) that are responsible for rendering HTML/CSS into a `UILayer` and emitting events on the `focusManager.events` bus.
4. **Register and Switch:** After defining all states, you `register()` them with the manager and start the application by calling `switch()` to the initial state.

```typescript
// Simplified example from FocusTestComponent.re.ts

// 1. Create the manager
this.focusManager = new FocusManager();

// 2. Define a state
const lobbyState = this.focusManager.create('lobby')
  .ui({ visible: ['main-menu-layer'] })
  .onEnter((payload, ui) => {
    // 3. Render UI in the onEnter hook
    new MainMenuUI(ui.find('main-menu-layer'), this.focusManager).render();
  })
  .onEvent(FocusEvents.LOBBY_JOIN_GAME, (fm, payload) => fm.switch('game', payload));

const gameState = this.focusManager.create('game')
  .ui({ visible: ['game-layer'] })
  .onEnter((payload, ui) => {
    new GameUI(ui.find('game-layer'), this.focusManager).render(payload);
  })
  .onEvent(FocusEvents.GAME_PAUSE, (fm) => fm.push('pause-menu'));

// 4. Register states
this.focusManager.register(lobbyState);
this.focusManager.register(gameState);

// 5. Set initial state
this.focusManager.switch('lobby');
```

### Installation & Setup

1. **Add Package:** Place the `FocusFramework` folder inside your RogueEngine project's `rogue_packages` directory.
2. **Create a Controller Component:** Create a new RogueEngine component to manage the application flow (e.g., `AppController.re.ts`).
3. **Initialize:** In the component's `start()` method, instantiate `FocusManager` and define/register your states as shown in the example above.
4. **Create UI Classes:** For each major UI screen, create a corresponding class that extends `BaseUI`. These classes will handle rendering HTML and emitting events.
5. **Start the Machine:** Call `this.focusManager.switch('your-initial-state')` at the end of your `start()` method.
6. **(Optional) Add Debugger:** For easy development, initialize the visual debugger:
  
  ```typescript
  import { FocusDebugger } from './rogue_packages/FocusFramework/utils/FocusDebug';
  // ... in start() after setting up the manager
  new FocusDebugger(this.focusManager).init();
  ```
  

### Limitations

- **Not a UI Component Library:** Focus Framework does not provide pre-made buttons, inputs, or panels. It manages the *layers* where you render your own UI using standard web technologies (HTML, CSS, JS).
- **No Built-in Networking:** The framework provides a structure ideal for networked games (e.g., `lobby` and `game` states), but it does not include any networking implementation. You would integrate your own solution (like WebSockets, WebRTC, or a library) within the state lifecycle hooks.
- **Manual UI State Preservation:** While layers can be preserved on exit (`.dontResetOnExit()`), the framework does not automatically save and restore the internal state of your UI (e.g., text in an input field). This logic must be handled within your UI controller classes if needed.

### API Reference (FocusState Builder)

All methods on a FocusState instance are chainable, allowing for a fluent configuration.

- **.extends(baseStateName: string)**
  Inherits configuration from a previously registered base state. Properties from the current state will override the base state's properties, while arrays (like hooks and prefabs) will be combined.
  
- **.ui({ visible, preserveOnExit, cleanupOnExit, layers })**
  Defines which UI layers are visible in this state, which should have their content preserved on exit, and which should only have listeners cleaned up. Also allows for pre-defining layers and their z-index.
  
- **.onEnter((payload, ui) => { ... })**
  Registers a function to be executed when entering this state. The function can be async and receives an optional payload from focusManager.switch() and the UILayerManager instance.
  
- **.onExit((nextStateName) => { ... })**
  Registers a function to be executed when exiting this state. The function can be async and receives the name of the state being transitioned to.
  
- .**withTransition(effectName: string, durationMs?: number)**
  Specifies a transition effect (e.g., 'fade', 'iris') to be used when switching to this state.
  
- **.withPrefabs(...prefabNames: string[])**
  Specifies one or more prefabs to be automatically instantiated when this state is entered and destroyed when it is exited.
  
- **.withPrefabsBatched(delayMs: number, ...prefabNames: string[])****
  Similar to withPrefabs, but instantiates prefabs sequentially with a delay between each to reduce stuttering.
  
- **.on(layerName, eventType, selector, callback)****
  Attaches a delegated event listener to a UI layer. The listener is automatically managed by the state's lifecycle
  
- **.onContainer(layerName, eventType, callback)****
  Attaches an event listener to the main game container (for global input like mousemove), but ties its lifecycle to a specific UI layer within the state.
  
- **.onEvent(eventName, callback)**
  Listens for an event on the global FocusManager event bus. The listener is only active when this state is active.
  
- **.onKey(eventType, key, callback)**
  Listens for a keyboard event on the document. The listener is only active when this state is active.
  
- **.dontResetOnExit(layerName: string)**
  Prevents a specific UI layer's content from being cleared when this state is exited. Useful for parent states in a push/pop scenario.
  
- **.ensureLayer(name, options)**
  Ensures a UI layer exists when the state is entered, creating it if necessary. Useful for dynamically created layers for pushed states.
  
- **.nukeSceneOnEnter(objectsToIgnore?: THREE.Object3D[])**
  On entering this state, destroys all objects in the 3D scene, providing a clean slate. You can provide an array of objects to ignore (the camera is always ignored).
