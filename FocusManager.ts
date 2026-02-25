import { UILayerManager, UILayer } from "./UILayerManager";
import { FocusState, FocusStateConfig } from "./FocusState";
import { FMLog } from "./utils/FocusLogger";
import { FocusEventBus } from "./utils/FocusEventBus";
import { FocusArt } from "./utils/FocusArt";
import * as RE from 'rogue-engine';

export interface FocusTransitionEffect {
    /** Called before the old state exits and new state enters. Should obscure the screen. */
    onExit(fromState: string | null, toState: string, durationMs: number): Promise<void>;
    /** Called after the new state has entered. Should reveal the screen. */
    onEnter(currentState: string, previousState: string | null, durationMs: number): Promise<void>;    
}

type SwitchListener = (newState: string, oldState: string | null) => void;

/**
 * A state machine for managing high-level application states like 'lobby', 'game', or 'menu'.
 * It provides a fluent API to define states and orchestrates UI transitions,
 * ensuring proper setup and cleanup of UI layers and associated logic.
 */
export class FocusManager {
    private states = new Map<string, FocusStateConfig>();
    private uiLayerManager: UILayerManager;
    private managedLayers = new Set<string>();
    private _stateStack: string[] = [];
    private _events: FocusEventBus;
    private activeEventListeners = new Map<string, { eventName: string, callback: (payload: any) => void }>();
    private activeKeyListeners = new Map<string, { eventType: string, handler: (event: KeyboardEvent) => void }>();

    private switchListeners: SwitchListener[] = [];
    private static transitionEffects = new Map<string, FocusTransitionEffect>();
    private static transitionLayer: UILayer | null = null;
    private static _defaultsInitialized = false;

    /**
     * @param uiLayerManager An instance of the UILayerManager to control UI layers.
     */
    constructor(uiLayerManager?: UILayerManager) {
        if (uiLayerManager) {
            this.uiLayerManager = uiLayerManager;
        } else {
            this.uiLayerManager = UILayerManager.getInstance();
        }

        this._events = new FocusEventBus();

        if (!FocusManager._defaultsInitialized) {
            FocusManager._logBrand();
            FocusManager._initializeDefaultEffects();
            FocusManager._defaultsInitialized = true;
        }

        // Ensure the transition layer exists and is configured
        if (!FocusManager.transitionLayer) {
            FocusManager.transitionLayer = this.uiLayerManager.create('focus-transition-layer', 9999);
            const layerEl = FocusManager.transitionLayer.element;
            
            layerEl.style.position = 'fixed';
            layerEl.style.top = '0';
            layerEl.style.left = '0';
            layerEl.style.width = '100vw';
            layerEl.style.height = '100vh';
            layerEl.style.pointerEvents = 'none';
            layerEl.style.backgroundColor = 'black';

            FocusManager.transitionLayer.hide();
        }
    }

    /** The name of the currently active state (top of the stack). */
    public get current(): string | null {
        return this._stateStack.length > 0 ? this._stateStack[this._stateStack.length - 1] : null;
    }

    /** The current stack of state names, with the active state at the end. */
    public get stateStack(): readonly string[] {
        return this._stateStack;
    }    

    /** The UILayerManager instance used by this FocusManager. */
    public get uiManager(): UILayerManager {
        return this.uiLayerManager;
    }

    /** The event bus instance for decoupled communication. */
    public get events(): FocusEventBus {
        return this._events;
    }

    /**
     * Checks if the currently active state matches the given name.
     * @param stateName The name of the state to check.
     * @returns True if it's the current state.
     */
    public is(stateName: string): boolean {
        return this.current === stateName;
    }

    /**
     * Creates a new, configurable focus state builder.
     * @param name The unique name for the state.
     * @returns A `FocusState` instance for configuration via a fluent API.
     */
    public create(name: string): FocusState {
        return new FocusState(name, this.uiLayerManager, this);
    }

    /**
     * Registers a configured focus state, making it available to `switch` to.
     * @param state The `FocusState` instance to register, typically after configuring it.
     */
    public register(state: FocusState): void {
        const name = state.name;
        if (this.states.has(name)) {
            FMLog.log('warn', `A state with the name '${name}' is already registered. Overwriting.`);
        }
        const config = state.build();

        // Resolve inheritance to get the final, complete configuration.
        const finalConfig = this.resolveInheritance(config);

        // Auto-create any layers defined in the state config.
        if (finalConfig.ui?.layers) {
            for (const layerName in finalConfig.ui.layers) {
                if (!this.uiLayerManager.has(layerName)) {
                    const zIndex = finalConfig.ui.layers[layerName];
                    this.uiLayerManager.create(layerName, zIndex);
                }
            }
        }

        this.states.set(name, finalConfig);

        // Keep track of all layers mentioned in any config so we can manage them.
        finalConfig.ui?.visible?.forEach(layerName => this.managedLayers.add(layerName));
        finalConfig.ui?.preserveOnExit?.forEach(layerName => this.managedLayers.add(layerName));
        finalConfig.ui?.cleanupOnExit?.forEach(layerName => this.managedLayers.add(layerName));
    }

    /** Returns an array of all registered state names. */
    public getRegisteredStates(): string[] {
        return Array.from(this.states.keys());
    }

    /** Returns a map of all registered state names to their configurations. */
    public getRegisteredStateConfigs(): Map<string, FocusStateConfig> {
        return this.states;
    }

    /**
     * Registers a callback to be executed whenever the focus state changes.
     * @param callback The function to call. It receives the new state name and the old state name.
     * @returns A function to unregister the listener.
     */
    public onSwitch(callback: SwitchListener): () => void {
        this.switchListeners.push(callback);
        return () => this.offSwitch(callback);
    }

    /**
     * Unregisters a state change callback.
     * @param callback The function to unregister.
     */
    public offSwitch(callback: SwitchListener): void {
        const index = this.switchListeners.indexOf(callback);
        if (index > -1) {
            this.switchListeners.splice(index, 1);
        }
    }

    /**
     * Registers a custom transition effect that can be used by `FocusState.withTransition()`.
     * @param name The unique name for the effect.
     * @param effect The effect implementation.
     */
    public static registerTransitionEffect(name: string, effect: FocusTransitionEffect) {
        if (this.transitionEffects.has(name)) {
            FMLog.log('warn', `A transition effect with the name '${name}' is already registered. Overwriting.`);
        }
        this.transitionEffects.set(name, effect);
    }

    private _activateStateEventListeners(stateName: string) {
        this._deactivateStateEventListeners(); // Ensure clean slate

        const stateConfig = this.states.get(stateName);
        if (!stateConfig?.eventListeners) return;

        FMLog.log('lifecycle', `Activating ${stateConfig.eventListeners.length} listeners for state '${stateName}'.`);

        stateConfig.eventListeners.forEach((listener, index) => {
            // Create the actual listener function that will be registered.
            const scopedCallback = (payload: any) => {
                // Only execute if this state is still the active one.
                // This prevents race conditions where an event is processed after a rapid state change.
                if (this.current === stateName) {
                    listener.callback(this, payload);
                }
            };
            this.events.on(listener.eventName, scopedCallback);

            const key = `${stateName}::${listener.eventName}::${index}`;
            // Store the event name and the callback so we can unregister it later.
            this.activeEventListeners.set(key, { eventName: listener.eventName, callback: scopedCallback });
        });
    }

    private _deactivateStateEventListeners() {
        if (this.activeEventListeners.size === 0) return;

        FMLog.log('lifecycle', `Deactivating ${this.activeEventListeners.size} listeners.`);
        for (const listenerInfo of this.activeEventListeners.values()) {
            // Assuming an 'off' method exists on the event bus, which is standard.
            (this.events as any).off(listenerInfo.eventName, listenerInfo.callback);
        }
        this.activeEventListeners.clear();
    }

    private _activateStateKeyListeners(stateName: string) {
        this._deactivateStateKeyListeners(); // Clean slate

        const stateConfig = this.states.get(stateName);
        if (!stateConfig?.keyListeners) return;

        FMLog.log('lifecycle', `Activating ${stateConfig.keyListeners.length} key listeners for state '${stateName}'.`);

        stateConfig.keyListeners.forEach((listener, index) => {
            const handler = (event: KeyboardEvent) => {
                // Check if the state is still active and the key matches
                if (this.current === stateName && event.key === listener.key) {
                    listener.callback(this, event);
                }
            };

            document.addEventListener(listener.eventType, handler);
            const key = `${stateName}::${listener.eventType}::${listener.key}::${index}`;
            this.activeKeyListeners.set(key, { eventType: listener.eventType, handler });
        });
    }

    private _deactivateStateKeyListeners() {
        if (this.activeKeyListeners.size === 0) return;

        FMLog.log('lifecycle', `Deactivating ${this.activeKeyListeners.size} key listeners.`);
        for (const listenerInfo of this.activeKeyListeners.values()) {
            document.removeEventListener(listenerInfo.eventType, listenerInfo.handler);
        }
        this.activeKeyListeners.clear();
    }

    private getTransitionEffect(name?: string): FocusTransitionEffect | null {
        if (!name) return null;
        const effect = FocusManager.transitionEffects.get(name);
        if (!effect) {
            FMLog.log('warn', `Transition effect '${name}' not found.`);
            return null;
        }
        return effect;
    }

    private static _logBrand() {
        const logoAscii = `
        
  ___________________
)=|                 |     /
  |      FOCUS      |====||
  |     FRAMEWORK   |====||
  |                 |+    \
  
  -------------------
         (--)
        *    *
       *      *
      *        *
     *          *
    *            *

by dbr
`.substring(1); // Remove leading newline

        const { dataUrl, width, height } = FocusArt.renderAsciiToImage(logoAscii, {
            fontSize: 10,
            fontName: '"SF Mono", "Consolas", "Liberation Mono", Menlo, Courier, monospace',
            bgColor: '#18181b',
            textColor: '#38bdf8',
            width: 400,
        });

        if (dataUrl) {
            FMLog.logImage('lifecycle', 'Initialized', dataUrl, width, height);
        }
    }

    private mergeConfigs(base: FocusStateConfig, child: FocusStateConfig): FocusStateConfig {
        const mergedUI = {
            // Merge layers, child's z-index wins
            layers: { ...(base.ui?.layers || {}), ...(child.ui?.layers || {}) },
            // Child's visible layers override base
            visible: child.ui?.visible ?? base.ui?.visible,
            // Combine unique reset/cleanup layers
            preserveOnExit: [...new Set([...(base.ui?.preserveOnExit || []), ...(child.ui?.preserveOnExit || [])])],
            cleanupOnExit: [...new Set([...(base.ui?.cleanupOnExit || []), ...(child.ui?.cleanupOnExit || [])])],
        };

        const mergedConfig: FocusStateConfig = {
            // Child properties take precedence for simple values
            ...base,
            ...child,
            // Explicitly merge complex properties
            ui: mergedUI,
            managedPrefabs: [...new Set([...(base.managedPrefabs || []), ...(child.managedPrefabs || [])])],
            onEnterHookCount: (base.onEnterHookCount || 0) + (child.onEnterHookCount || 0),
            onExitHookCount: (base.onExitHookCount || 0) + (child.onExitHookCount || 0),
        };

        // Chain onEnter hooks (base -> child)
        if (base.onEnter || child.onEnter) {
            mergedConfig.onEnter = async (payload, ui) => {
                await base.onEnter?.(payload, ui);
                await child.onEnter?.(payload, ui);
            };
        }

        // Chain onExit hooks (base -> child)
        if (base.onExit || child.onExit) {
            mergedConfig.onExit = async (nextState) => {
                await base.onExit?.(nextState);
                await child.onExit?.(nextState);
            };
        }

        return mergedConfig;
    }

    private resolveInheritance(config: FocusStateConfig, visited = new Set<string>()): FocusStateConfig {
        if (!config.extends) {
            return config;
        }

        const parentName = config.extends;

        if (visited.has(parentName)) {
            FMLog.log('error', `Circular dependency detected in state inheritance: ${[...visited, parentName].join(' -> ')}`);
            return { ...config, extends: undefined }; // Prevent infinite loop
        }

        const parentConfig = this.states.get(parentName);

        if (!parentConfig) {
            FMLog.log('error', `Base state '${parentName}' not found. It must be registered before the states that extend it.`);
            return { ...config, extends: undefined }; // Return child config without inheritance
        }

        const resolvedParent = this.resolveInheritance(parentConfig, new Set([...visited, parentName]));
        return this.mergeConfigs(resolvedParent, config);
    }

    private _emitSwitchEvent(newState: string, oldState: string | null) {
        for (const listener of this.switchListeners) {
            try {
                listener(newState, oldState);
            } catch (e) {
                FMLog.log('error', "Error in onSwitch listener", e);
            }
        }
    }

    private async _exitState(stateNameToExit: string, nextStateName: string): Promise<void> {
        const oldStateConfig = this.states.get(stateNameToExit);
        if (!oldStateConfig) return;

        // 1. Call the onExit callback
        await oldStateConfig.onExit?.(nextStateName);

        // 2. Automatically reset visible layers unless they are marked for preservation.
        const layersToPreserve = new Set(oldStateConfig.ui?.preserveOnExit || []);
        const visibleLayers = oldStateConfig.ui?.visible || [];

        for (const layerName of visibleLayers) {
            if (!layersToPreserve.has(layerName)) {
                const layer = this.uiLayerManager.get(layerName);
                if (layer) {
                    layer.reset().hide();
                } else {
                    FMLog.log('warn', `Could not find layer "${layerName}" to reset on exit.`);
                }
            }
        }

        // 3. For preserved layers, just clean up listeners if specified.
        oldStateConfig.ui?.cleanupOnExit?.forEach(layerName => {
            const layer = this.uiLayerManager.get(layerName);
            if (layer) {
                layer.clearListeners();
            }
        });
    }

    private _updateUiVisibility(): void {
        const currentStateName = this.current;
        if (!currentStateName) {
            // No active state, hide all managed layers
            for (const layerName of this.managedLayers) {
                this.uiLayerManager.get(layerName)?.hide();
            }
            return;
        }

        const currentStateConfig = this.states.get(currentStateName)!;
        const visibleLayers = new Set(currentStateConfig.ui?.visible || []);

        for (const layerName of this.managedLayers) {
            const layer = this.uiLayerManager.get(layerName);
            if (layer) {
                visibleLayers.has(layerName) ? layer.show() : layer.hide();
            }
        }
    }

    private static _initializeDefaultEffects() {
        // --- FADE ---
        this.registerTransitionEffect('fade', {
            onExit: async (from, to, durationMs) => {
                const layer = FocusManager.transitionLayer!;
                const el = layer.element;
                el.style.clipPath = ''; // Clear other effect properties
                el.style.opacity = '0';
                el.style.transition = `opacity ${durationMs}ms ease-in-out`;
                layer.show();
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); // Wait for styles to apply
                el.style.opacity = '1';
                await new Promise(r => setTimeout(r, durationMs));
            },
            onEnter: async (current, prev, durationMs) => {
                const el = FocusManager.transitionLayer!.element;
                el.style.opacity = '1';
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                el.style.opacity = '0';
                await new Promise(r => setTimeout(r, durationMs));
                FocusManager.transitionLayer!.hide();
            }
        });

        // --- WIPE (Left to Right) ---
        this.registerTransitionEffect('wipe', {
            onExit: async (from, to, durationMs) => {
                const layer = FocusManager.transitionLayer!;
                const el = layer.element;
                el.style.opacity = '1';
                el.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)'; // Start as a line on the left
                el.style.transition = `clip-path ${durationMs}ms ease-in-out`;
                layer.show();
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                el.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'; // Wipe to full screen
                await new Promise(r => setTimeout(r, durationMs));
            },
            onEnter: async (current, prev, durationMs) => {
                const el = FocusManager.transitionLayer!.element;
                el.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)'; // Start full screen
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                el.style.clipPath = 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)'; // Wipe away to the right
                await new Promise(r => setTimeout(r, durationMs));
                FocusManager.transitionLayer!.hide();
            }
        });

        // --- IRIS (Circle) ---
        this.registerTransitionEffect('iris', {
            onExit: async (from, to, durationMs) => {
                const layer = FocusManager.transitionLayer!;
                const el = layer.element;
                el.style.opacity = '1';
                el.style.clipPath = 'circle(0% at 50% 50%)'; // Start as a point
                el.style.transition = `clip-path ${durationMs}ms ease-in-out`;
                layer.show();
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                el.style.clipPath = 'circle(75% at 50% 50%)'; // Grow to cover (75% is enough for corners)
                await new Promise(r => setTimeout(r, durationMs));
            },
            onEnter: async (current, prev, durationMs) => {
                const el = FocusManager.transitionLayer!.element;
                el.style.clipPath = 'circle(75% at 50% 50%)'; // Start as full circle
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                el.style.clipPath = 'circle(0% at 50% 50%)'; // Shrink to nothing
                await new Promise(r => setTimeout(r, durationMs));
                FocusManager.transitionLayer!.hide();
            }
        });
    }

    /**
     * Transitions the application to a new focus state, clearing the entire state stack.
     * This will trigger the onExit hook of all active states and the onEnter hook of the new state.
     * @param name The name of the state to switch to.
     * @param payload An optional data payload to pass to the new state's `onEnter` hooks.
     */
    public async switch(name: string, payload?: any): Promise<void> {
        if (this.current === name && this._stateStack.length === 1) return;
        if (!this.states.has(name)) {
            FMLog.log('error', `Attempted to switch to unregistered state '${name}'.`);
            return;
        }

        await new Promise(resolve => RE.onNextFrame(resolve as () => void));

        const previousStateName = this.current;
        const newStateConfig = this.states.get(name)!;
        const transition = this.getTransitionEffect(newStateConfig.transitionEffectName);
        const transitionDuration = newStateConfig.transitionDuration ?? 300;

        // --- 1. Deactivate old listeners & Run Exit Transition ---
        this._deactivateStateEventListeners();
        this._deactivateStateKeyListeners();
        if (transition) {
            await transition.onExit(previousStateName, name, transitionDuration);
        }

        // --- 2. Exit all current states ---
        while (this._stateStack.length > 0) {
            const stateToExitName = this._stateStack[this._stateStack.length - 1]; // Peek
            await this._exitState(stateToExitName, name); // Exit hook gets final destination
            this._stateStack.pop();
        }

        // --- 3. Enter New State ---
        this._stateStack.push(name);
        this._emitSwitchEvent(name, previousStateName);
        this._activateStateEventListeners(name);
        this._activateStateKeyListeners(name);
        this._updateUiVisibility();
        await newStateConfig.onEnter?.(payload, this.uiLayerManager);

        // --- 3. Run Enter Transition ---
        if (transition) {
            await transition.onEnter(name, previousStateName, transitionDuration);
        }
    }

    /**
     * Pushes a new state onto the stack, making it the active state.
     * The previous state is suspended (UI hidden) but not exited (logic/prefabs remain).
     * @param name The name of the state to push.
     * @param payload An optional data payload to pass to the new state's `onEnter` hooks.
     */
    public async push(name: string, payload?: any): Promise<void> {
        if (this.current === name) return;
        if (!this.states.has(name)) {
            FMLog.log('error', `Attempted to push unregistered state '${name}'.`);
            return;
        }

        await new Promise(resolve => RE.onNextFrame(resolve as () => void));

        const previousStateName = this.current;
        const newStateConfig = this.states.get(name)!;
        const transition = this.getTransitionEffect(newStateConfig.transitionEffectName);
        const transitionDuration = newStateConfig.transitionDuration ?? 300;

        // --- 1. Deactivate old listeners & Run Exit Transition ---
        this._deactivateStateEventListeners();
        this._deactivateStateKeyListeners();
        if (transition) {
            await transition.onExit(previousStateName, name, transitionDuration);
        }

        // --- 2. Enter New State ---
        // The state below is not exited, just suspended (listeners deactivated, UI hidden).
        this._stateStack.push(name);
        this._emitSwitchEvent(name, previousStateName);
        this._activateStateEventListeners(name);
        this._activateStateKeyListeners(name);
        this._updateUiVisibility(); // Hides old UI, shows new
        await newStateConfig.onEnter?.(payload, this.uiLayerManager);

        // --- 3. Run Enter Transition ---
        if (transition) {
            await transition.onEnter(name, previousStateName, transitionDuration);
        }
    }

    /**
     * Pops the current state from the stack, exiting it and resuming the state below.
     * This will trigger the onExit hook of the popped state. The state below is not re-entered.
     */
    public async pop(): Promise<void> {
        if (this._stateStack.length <= 1) {
            FMLog.log('warn', `Cannot pop the last state from the stack. Use switch() to change the base state.`);
            return;
        }

        await new Promise(resolve => RE.onNextFrame(resolve as () => void));

        const stateToPopName = this.current!;
        const stateToResumeName = this._stateStack[this.stateStack.length - 2];

        // On pop, the transition is logically part of the state being removed.
        const stateToPopConfig = this.states.get(stateToPopName)!;
        const transition = this.getTransitionEffect(stateToPopConfig.transitionEffectName);
        const transitionDuration = stateToPopConfig.transitionDuration ?? 300;

        // --- 1. Deactivate old listeners & Run Exit Transition ---
        this._deactivateStateEventListeners();
        this._deactivateStateKeyListeners();
        if (transition) {
            await transition.onExit(stateToPopName, stateToResumeName, transitionDuration);
        }

        // --- 2. Exit Top State ---
        await this._exitState(stateToPopName, stateToResumeName);
        this._stateStack.pop();

        // --- 3. Resume New Top State ---
        this._emitSwitchEvent(this.current!, stateToPopName);
        this._activateStateEventListeners(this.current!);
        this._activateStateKeyListeners(this.current!);
        this._updateUiVisibility(); // Reveal the UI for the state that is now on top.

        // --- 4. Run Enter Transition ---
        if (transition) {
            await transition.onEnter(this.current!, stateToPopName, transitionDuration);
        }
    }
}