import { UILayerManager, UILayer } from "./UILayerManager";
import { PrefabUtil } from "./utils/PrefabUtil";
import { FMLog } from "./utils/FocusLogger";
import * as RE from 'rogue-engine';
import type { FocusManager } from "./FocusManager";
import * as THREE from 'three';

type LayerDefinition = { [layerName: string]: number };

type KeyListener = { eventType: 'keydown' | 'keyup' | 'keypress', key: string, callback: (fm: FocusManager, event: KeyboardEvent) => void };

/**
 * The internal configuration object used by FocusManager after a FocusState is built.
 * @internal
 */
export interface FocusStateConfig {
    extends?: string;
    ui?: {
        visible?: string[];
        /** 
         * An array of UI layer names whose content and listeners should be
         * preserved when exiting this state. By default, all visible layers are reset.
         */
        preserveOnExit?: string[];
        /** 
         * An array of UI layer names whose event listeners should be cleaned up
         * when exiting this state, but whose content should be preserved.
         */
        cleanupOnExit?: string[];
        layers?: LayerDefinition;
    };
    transitionEffectName?: string;
    transitionDuration?: number;
    managedPrefabs?: string[];
    onEnterHookCount?: number;
    onExitHookCount?: number;
    eventListeners?: { eventName: string, callback: (fm: FocusManager, payload: any) => void }[];
    keyListeners?: KeyListener[];
    onEnter?: (payload: any | undefined, ui: UILayerManager) => Promise<void>;
    onExit?: (nextStateName: string) => Promise<void>;
}

type DelegatedListener = { layerName: string, eventType: string, selector: string, callback: (event: Event, target: HTMLElement) => void };
type ContainerListener = { layerName: string, eventType: string, callback: (event: Event) => void, options?: boolean | AddEventListenerOptions };
/**
 * A chainable builder for defining a single application state (e.g., 'lobby', 'game').
 * It provides a fluent API for configuring UI layers, lifecycle hooks, and event listeners.
 */
export class FocusState {
    public readonly name: string;
    private uiLayerManager: UILayerManager;
    private focusManager: FocusManager;

    private _uiConfig: FocusStateConfig['ui'] = {};
    private _onEnterHooks: ((payload: any | undefined, ui: UILayerManager) => void | Promise<void>)[] = [];
    private _onExitHooks: ((nextStateName: string) => void | Promise<void>)[] = [];
    private _delegatedListeners: DelegatedListener[] = [];
    private _eventListeners: { eventName: string, callback: (fm: FocusManager, payload: any) => void }[] = [];
    private _keyListeners: KeyListener[] = [];
    private _containerListeners: ContainerListener[] = [];
    private _extendsStateName?: string;
    private _preserveOnExit = new Set<string>();
    private _transitionEffectName?: string;
    private _transitionDuration?: number;
    private _managedPrefabs: string[] = [];
    private _entryVersion = 0; // Used to cancel stale async operations on rapid state switching

    /**
     * @internal - Should be created via `FocusManager.create()`.
     */
    constructor(name: string, uiLayerManager: UILayerManager, focusManager: FocusManager) {
        this.name = name;
        this.uiLayerManager = uiLayerManager;
        this.focusManager = focusManager;
    }

    /**
     * Inherits configuration from a previously registered base state.
     * Properties from this state will override the base state's properties.
     * Arrays like `onEnter` hooks and `managedPrefabs` will be combined.
     * @param baseStateName The name of the state to extend.
     */
    public extends(baseStateName: string): this {
        this._extendsStateName = baseStateName;
        return this;
    }

    /**
     * Defines which UI layers are visible in this state and which are reset on exit.
     * @param config Configuration for UI layer visibility and cleanup.
     */
    ui(config: { visible?: string[], preserveOnExit?: string[], cleanupOnExit?: string[], layers?: LayerDefinition }): this {
        this._uiConfig = { ...this._uiConfig, ...config };
        if (config.preserveOnExit) {
            config.preserveOnExit.forEach(layerName => this._preserveOnExit.add(layerName));
        }
        return this;
    }

    /**
     * Registers a function to be executed when entering this state.
     * The function can optionally receive a payload passed from `focus.switch()`.
     * Can be called multiple times to add multiple hooks.
     * @param callback The function to execute, which can accept a payload.
     */
    onEnter(callback: (payload: any | undefined, ui: UILayerManager) => void | Promise<void>): this {
        this._onEnterHooks.push(callback);
        return this;
    }

    /**
     * Registers a function to be executed when exiting this state.
     * Can be called multiple times to add multiple hooks.
     * @param callback The function to execute.
     */
    onExit(callback: (nextStateName: string) => void | Promise<void>): this {
        this._onExitHooks.push(callback);
        return this;
    }

    /**
     * Specifies one or more prefabs to be automatically instantiated when this state is entered
     * and destroyed when it is exited.
     * @param prefabNames The names or paths of the prefabs to manage.
     * @returns The `FocusState` instance for chaining.
     */
    public withPrefabs(...prefabNames: string[]): this {
        this._managedPrefabs.push(...prefabNames);

        // This array will hold prefabs that are successfully instantiated and not cancelled.
        let instantiatedPrefabs: THREE.Object3D[] = [];

        // Add an onEnter hook to spawn the prefabs.
        this.onEnter(async () => {
            // Capture the version at the start of this async hook.
            const entryVersionForThisHook = this._entryVersion;

            instantiatedPrefabs = [];
            
            const instances = await PrefabUtil.instantiateMultiple(...prefabNames);

            // **Cancellation Check**: Has an exit occurred while we were instantiating?
            if (entryVersionForThisHook !== this._entryVersion) {
                FMLog.log('prefab', `Instantiation cancelled for state '${this.name}' due to rapid state change. Cleaning up.`);
                // Destroy the instances we just created, as they are no longer needed.
                for (const instance of instances) {
                    PrefabUtil.destroy(instance, true);
                }
                return; // Abort adding them to the managed list.
            }

            // If not cancelled, add the new instances to be managed.
            instantiatedPrefabs.push(...instances);
        });

        // Add a synchronous onExit hook to clean them up.
        this.onExit(() => {
            for (const prefabInstance of instantiatedPrefabs) {
                PrefabUtil.destroy(prefabInstance, true);
            }
            instantiatedPrefabs = [];
        });

        return this;
    }

    /**
     * Specifies one or more prefabs to be instantiated sequentially with a delay between each.
     * This can help reduce stuttering on state entry by spreading the load over multiple frames.
     * Prefabs are still destroyed automatically on state exit.
     * @param delayMs The delay in milliseconds between each prefab instantiation. A small delay (e.g., 16) can push work to the next frame.
     * @param prefabNames The names or paths of the prefabs to manage.
     * @returns The `FocusState` instance for chaining.
     */
    public withPrefabsBatched(delayMs: number, ...prefabNames: string[]): this {
        this._managedPrefabs.push(...prefabNames);

        let instantiatedPrefabs: THREE.Object3D[] = [];

        this.onEnter(async () => {
            const entryVersionForThisHook = this._entryVersion;
            instantiatedPrefabs = [];

            for (const name of prefabNames) {
                // Check for cancellation before each instantiation
                if (entryVersionForThisHook !== this._entryVersion) {
                    FMLog.log('prefab', `Batched instantiation cancelled for state '${this.name}'.`);
                    // Cleanup any prefabs that were already created in this batch
                    for (const instance of instantiatedPrefabs) {
                        PrefabUtil.destroy(instance, true);
                    }
                    instantiatedPrefabs = [];
                    return;
                }

                const instance = await PrefabUtil.instantiate(name);
                if (instance) {
                    instantiatedPrefabs.push(instance);
                }

                // Wait for the specified delay before the next one
                if (delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        });

        this.onExit(() => {
            for (const prefabInstance of instantiatedPrefabs) {
                PrefabUtil.destroy(prefabInstance, true);
            }
            instantiatedPrefabs = [];
        });

        return this;
    }

    /**
     * Specifies a transition effect to be used when switching *to* this state.
     * Requires a corresponding effect to be registered with `FocusManager.registerTransitionEffect`.
     * @param effectName The name of the transition effect (e.g., 'fade', 'wipe').
     * @returns The `FocusState` instance for chaining.
     */
    public withTransition(effectName: string, durationMs?: number): this {
        this._transitionEffectName = effectName;
        this._transitionDuration = durationMs;
        return this;
    }

    /**
     * Attaches a delegated event listener to a UI layer associated with this state.
     * The listener is automatically added on state enter and removed when the layer is reset.
     * This method will automatically mark the specified layer for reset on state exit.
     * @param layerName The name of the UI layer to attach the listener to.
     * @param eventType The event to listen for (e.g., 'click').
     * @param selector The CSS selector for the target elements.
     * @param callback The function to call when the event occurs.
     */
    on(layerName: string, eventType: string, selector: string, callback: (event: Event, target: HTMLElement) => void): this {
        this._delegatedListeners.push({ layerName, eventType, selector, callback });
        return this;
    }

    /**
     * Attaches an event listener to the main game container, tied to this state's lifecycle.
     * The listener is automatically added on state enter and removed when the layer is reset.
     * This method will automatically mark the specified layer for reset on state exit.
     * @param layerName The name of the UI layer to associate the listener's lifecycle with.
     * @param eventType The event to listen for (e.g., 'mousemove', 'wheel').
     * @param callback The function to call when the event occurs.
     * @param options Event listener options.
     */
    onContainer(layerName: string, eventType: string, callback: (event: Event) => void, options?: boolean | AddEventListenerOptions): this {
        this._containerListeners.push({ layerName, eventType, callback, options });
        return this;
    }

    /**
     * Attaches an event listener to the global FocusManager event bus, but scoped
     * to this state's lifecycle. The listener will only be active when this state
     * is the current, active state on top of the stack.
     * @param eventName The event to listen for from the global event bus.
     * @param callback The function to call when the event is emitted. It receives the FocusManager instance and the event payload.
     */
    public onEvent(eventName: string, callback: (fm: FocusManager, payload: any) => void): this {
        this._eventListeners.push({ eventName, callback });
        return this;
    }

    /**
     * Attaches a keyboard event listener to the document, but scoped to this
     * state's lifecycle. The listener will only be active when this state is the
     * current, active state on top of the stack.
     * @param eventType The keyboard event to listen for ('keydown', 'keyup', 'keypress').
     * @param key The key to listen for (e.g., 'Enter', 'Escape', 'a').
     * @param callback The function to call when the key event is triggered. It receives the FocusManager instance and the KeyboardEvent.
     */
    public onKey(eventType: 'keydown' | 'keyup' | 'keypress', key: string, callback: (fm: FocusManager, event: KeyboardEvent) => void): this {
        this._keyListeners.push({ eventType, key, callback });
        return this;
    }



    /**
     * Prevents a layer's content from being cleared when this state is exited.
     * By default, all visible layers are reset. Use this to opt-out for specific layers.
     * If the layer has event listeners attached via `.on()` or `.onContainer()`, they will still be cleaned up.
     * @param layerName The name of the layer to preserve.
     */
    public dontResetOnExit(layerName: string): this {
        this._preserveOnExit.add(layerName);
        return this;
    }

    /**
     * On entering this state, completely clear the 3D scene of all objects,
     * geometries, and materials, except for specified objects and the main camera.
     * This is a destructive operation useful for ensuring a clean slate when
     * transitioning between major states like 'game' and 'lobby'.
     * @param objectsToIgnore An array of `THREE.Object3D` instances to preserve. The main runtime camera is always preserved.
     * @returns The `FocusState` instance for chaining.
     */
    public nukeSceneOnEnter(objectsToIgnore: THREE.Object3D[] = []): this {
        this.onEnter(() => {
            FMLog.log('lifecycle', `Nuking scene for state '${this.name}'.`);

            const ignoreList = [...objectsToIgnore];

            // Always ignore the runtime camera
            if (RE.Runtime.camera) {
                ignoreList.push(RE.Runtime.camera);
            }

            const scene = RE.Runtime.scene;
            const ignoreSet = new Set<THREE.Object3D>(ignoreList);

            // Add all ancestors of ignored objects to the ignore set as well,
            // because we can't destroy a parent without destroying its children.
            for (const ignoredObject of ignoreList) {
                ignoredObject.traverseAncestors((ancestor) => {
                    ignoreSet.add(ancestor);
                });
            }

            const objectsToDestroy: THREE.Object3D[] = [];
            for (const child of [...scene.children]) {
                if (!ignoreSet.has(child)) {
                    objectsToDestroy.push(child);
                }
            }

            if (objectsToDestroy.length > 0) {
                FMLog.log('lifecycle', `Destroying ${objectsToDestroy.length} top-level scene objects.`);
                for (const object of objectsToDestroy) {
                    PrefabUtil.destroy(object, true);
                }
            }
        });
        return this;
    }

    /**
     * Ensures a UI layer exists when this state is entered, creating it if necessary.
     * This is a convenience method that adds an `onEnter` hook. If you are defining
     * layers that are always available, prefer using the `layers` property in the `ui()` config.
     * @param name The name of the layer.
     * @param zIndexOrOptions The z-index or creation options for the layer if it needs to be created.
     * @returns The `FocusState` instance for chaining.
     */
    public ensureLayer(name: string, zIndexOrOptions: number | { zIndex?: number, parent?: string | UILayer }): this {
        this.onEnter((payload, ui) => {
            if (!ui.has(name)) {
                ui.create(name, zIndexOrOptions as any);
            }
        });
        return this;
    }

    /** 
     * @internal Builds the final config object for the FocusManager to use.
     * This consolidates all the builder methods into a single, executable configuration.
     */
    build(): FocusStateConfig {
        const finalConfig: FocusStateConfig = {
            extends: this._extendsStateName,
            ui: { 
                ...this._uiConfig,
                preserveOnExit: this._preserveOnExit.size > 0 ? Array.from(this._preserveOnExit) : undefined,
            },
            transitionEffectName: this._transitionEffectName,
            transitionDuration: this._transitionDuration,
            managedPrefabs: this._managedPrefabs.length > 0 ? [...this._managedPrefabs] : undefined,
            onEnterHookCount: this._onEnterHooks.length,
            onExitHookCount: this._onExitHooks.length,
            eventListeners: this._eventListeners.length > 0 ? [...this._eventListeners] : undefined,
            keyListeners: this._keyListeners.length > 0 ? [...this._keyListeners] : undefined,
        };

        const layersWithListeners = new Set<string>();
        this._delegatedListeners.forEach(l => layersWithListeners.add(l.layerName));
        this._containerListeners.forEach(l => layersWithListeners.add(l.layerName));

        // If a layer has listeners and is marked for preservation, we must add it
        // to `cleanupOnExit` to ensure listeners are removed without destroying content.
        // If it's not preserved, the default reset behavior in FocusManager handles everything.
        if (layersWithListeners.size > 0) {
            if (!finalConfig.ui) finalConfig.ui = {};
            const cleanupSet = new Set(finalConfig.ui.cleanupOnExit || []);

            layersWithListeners.forEach(layerName => {
                if (this._preserveOnExit.has(layerName)) {
                    cleanupSet.add(layerName);
                }
            });
            if (cleanupSet.size > 0) finalConfig.ui.cleanupOnExit = Array.from(cleanupSet);
        }

        // Combine all onEnter hooks into a single function.
        finalConfig.onEnter = async (payload: any | undefined, ui: UILayerManager) => {
            // Capture the version at the very start of the state entry process.
            const entryVersion = this._entryVersion;

            // Execute all potentially async hooks.
            for (const hook of this._onEnterHooks) {
                await hook(payload, ui);
            }

            // Final cancellation check before attaching synchronous listeners.
            // This ensures that if a switch happened during an `await` in a hook,
            // we don't attach listeners for this now-stale state.
            if (entryVersion !== this._entryVersion) {
                FMLog.log('ui', `Listener attachment cancelled for state '${this.name}' due to rapid state change.`);
                return;
            }

            this._delegatedListeners.forEach(({ layerName, eventType, selector, callback }) => this.uiLayerManager.find(layerName).on(eventType, selector, callback));
            this._containerListeners.forEach(({ layerName, eventType, callback, options }) => this.uiLayerManager.find(layerName).onContainer(eventType, callback, options));
        };

        // Combine all onExit hooks.
        const allExitHooks = [...this._onExitHooks];
        finalConfig.onExit = async (nextStateName: string) => {
            // Invalidate any ongoing onEnter operations immediately.
            this._entryVersion++;
            for (const hook of allExitHooks) {
                await hook(nextStateName);
            }
        };

        return finalConfig;
    }
}