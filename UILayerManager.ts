import * as RE from 'rogue-engine';
import { FMLog } from './utils/FocusLogger';

interface DelegatedListener {
    eventType: string;
    selector: string;
    callback: (event: Event, target: HTMLElement) => void;
}

/**
 * Represents a single UI layer with a fluent API for manipulation.
 */
export class UILayer {
    /** The root HTML element for this layer. */
    public readonly element: HTMLDivElement;
    /** The unique name of this layer. */
    public readonly name: string;
    /** The parent of this layer, if any. */
    public parent: UILayer | null = null;
    /** The children of this layer. */
    public readonly children: UILayer[] = [];

    private delegatedListeners: DelegatedListener[] = [];
    private masterHandlers: Map<string, (event: Event) => void> = new Map();
    private cleanupTasks: (() => void)[] = [];
    private manager: UILayerManager;

    constructor(name: string, element: HTMLDivElement, manager: UILayerManager) {
        this.name = name;
        this.element = element;
        this.manager = manager;
    }

    /** Makes the layer visible. */
    show(): this {
        this.element.style.display = '';
        return this;
    }

    /** Hides the layer. */
    hide(): this {
        this.element.style.display = 'none';
        return this;
    }

    /**
     * Appends a child node to the layer's root element.
     * @param child The node to append.
     * @returns The UILayer instance for chaining.
     */
    append(child: Node): this {
        this.element.appendChild(child);
        return this;
    }

    /**
     * Prepends a child node to the layer's root element.
     * @param child The node to prepend.
     * @returns The UILayer instance for chaining.
     */
    prepend(child: Node): this {
        this.element.prepend(child);
        return this;
    }

    /**
     * Replaces the layer's content with an HTML string.
     * This will remove all existing child elements and their associated listeners.
     * @param htmlString The HTML string to set as the content.
     * @returns The UILayer instance for chaining.
     */
    html(htmlString: string): this {
        this.clearListeners();
        this.element.innerHTML = htmlString;
        return this;
    }

    /**
     * Replaces the layer's content with a plain text string.
     * This will remove all existing child elements and their associated listeners.
     * @param textContent The text to set as the content.
     * @returns The UILayer instance for chaining.
     */
    text(textContent: string): this {
        this.clearListeners();
        this.element.textContent = textContent;
        return this;
    }

    /**
     * Adds one or more CSS class names to the layer's root element.
     * @param classNames The class names to add.
     * @returns The UILayer instance for chaining.
     */
    addClass(...classNames: string[]): this {
        this.element.classList.add(...classNames);
        return this;
    }

    /**
     * Removes one or more CSS class names from the layer's root element.
     * @param classNames The class names to remove.
     * @returns The UILayer instance for chaining.
     */
    removeClass(...classNames: string[]): this {
        this.element.classList.remove(...classNames);
        return this;
    }

    /**
     * Toggles a CSS class name on the layer's root element.
     * @param className The class name to toggle.
     * @param force If true, adds the class; if false, removes it. If undefined, toggles.
     * @returns The UILayer instance for chaining.
     */
    toggleClass(className: string, force?: boolean): this {
        this.element.classList.toggle(className, force);
        return this;
    }

    /**
     * Applies multiple CSS styles to the layer's root element.
     * @param styles An object of CSS properties and values.
     * @returns The UILayer instance for chaining.
     */
    setStyle(styles: Partial<CSSStyleDeclaration>): this {
        Object.assign(this.element.style, styles);
        return this;
    }

    /**
     * Finds the first element within the layer that matches the specified selector.
     * This is a shortcut for `layer.element.querySelector()`.
     * @param selector A DOMString containing one or more selectors to match.
     * @returns The first matching HTMLElement, or null if no matches are found.
     */
    find<E extends HTMLElement = HTMLElement>(selector: string): E | null {
        return this.element.querySelector<E>(selector);
    }

    /**
     * Finds all elements within the layer that match the specified selector.
     * This is a shortcut for `layer.element.querySelectorAll()`.
     * @param selector A DOMString containing one or more selectors to match.
     * @returns A static NodeListOf containing all matching elements.
     */
    findAll<E extends HTMLElement = HTMLElement>(selector: string): NodeListOf<E> {
        return this.element.querySelectorAll<E>(selector);
    }

    /** Removes all event listeners attached via .on() and .onContainer(), and runs their cleanup tasks. */
    clearListeners(): this {
        // Run and clear all registered cleanup tasks (for onContainer listeners)
        for (const task of this.cleanupTasks) {
            try {
                task();
            } catch (e) {
                FMLog.log('error', "Error during UILayer cleanup task", e);
            }
        }
        this.cleanupTasks = [];

        // Remove all master event listeners from the root element (for .on() listeners)
        for (const [eventType, handler] of this.masterHandlers.entries()) {
            this.element.removeEventListener(eventType, handler);
        }

        // Clear internal tracking of listeners
        this.delegatedListeners = [];
        this.masterHandlers.clear();
        return this;
    }

    /** Removes all child elements from the layer and detaches all event listeners. */
    reset(): this {
        // Recursively destroy children before clearing the parent's DOM.
        // Make a copy as the children array will be mutated by destroy().
        [...this.children].forEach(child => this.manager.destroy(child.name));

        this.element.innerHTML = '';
        this.clearListeners();
        return this;
    }

    /**
     * Sets the stacking order of the layer. Higher numbers are on top.
     * @param index The z-index value.
     */
    setZIndex(index: number): this {
        this.element.style.zIndex = String(index);
        return this;
    }

    /**
     * Registers a cleanup function to be called when the layer is reset.
     * This is useful for clearing intervals, timeouts, or other resources
     * associated with the layer's content.
     * @param task The function to execute on reset.
     */
    addCleanupTask(task: () => void): this {
        this.cleanupTasks.push(task);
        return this;
    }

    /**
     * Attaches an event listener directly to the main Rogue Engine DOM container,
     * but ties its lifecycle to this UI layer. The listener will be automatically
     * removed when the layer is reset. This is useful for global input events
     * like 'mousemove' or 'wheel' that should only be active when this layer is
     * conceptually "active".
     * @param eventType The event to listen for (e.g., 'mousemove', 'wheel').
     * @param callback The function to call when the event occurs.
     * @param options Event listener options.
     */
    onContainer(eventType: string, callback: (event: Event) => void, options?: boolean | AddEventListenerOptions): this {
        const container = RE.Runtime.rogueDOMContainer;
        if (!container) {
            FMLog.log('error', `RE.Runtime.rogueDOMContainer is not available to attach '${eventType}' listener.`);
            return this;
        }

        container.addEventListener(eventType, callback, options);
        this.addCleanupTask(() => {
            container.removeEventListener(eventType, callback, options);
        });
        return this;
    }

    /**
     * Attaches a delegated event listener to the layer. Listeners are automatically
     * removed when the layer is reset.
     * @param eventType The event to listen for (e.g., 'click').
     * @param selector The CSS selector for the target elements.
     * @param callback The function to call when the event occurs on a matching element. The matching element is passed as the second argument.
     */
    on(eventType: string, selector: string, callback: (event: Event, target: HTMLElement) => void): this {
        if (!this.masterHandlers.has(eventType)) {
            const handler = (event: Event) => {
                const targetElement = event.target as HTMLElement;
                if (!targetElement) return;

                // Check all delegations for this event type
                for (const delegation of this.delegatedListeners) {
                    if (delegation.eventType === event.type) {
                        const matchingTarget = targetElement.closest(delegation.selector);
                        if (matchingTarget && this.element.contains(matchingTarget)) {
                            delegation.callback(event, matchingTarget as HTMLElement);
                        }
                    }
                }
            };
            this.element.addEventListener(eventType, handler);
            this.masterHandlers.set(eventType, handler);
        }

        this.delegatedListeners.push({ eventType, selector, callback });
        return this;
    }

    /**
     * Removes a specific delegated event listener.
     * @param eventType The event type of the listener to remove.
     * @param selector The CSS selector of the listener to remove.
     * @param callback The original callback function of the listener to remove.
     */
    off(eventType: string, selector: string, callback: (event: Event, target: HTMLElement) => void): this {
        this.delegatedListeners = this.delegatedListeners.filter(
            dl => !(dl.eventType === eventType && dl.selector === selector && dl.callback === callback)
        );

        // If no more listeners for this event type exist, we can clean up the master handler
        const hasMoreForType = this.delegatedListeners.some(dl => dl.eventType === eventType);
        if (!hasMoreForType) {
            const handler = this.masterHandlers.get(eventType);
            if (handler) {
                this.element.removeEventListener(eventType, handler);
                this.masterHandlers.delete(eventType);
            }
        }

        return this;
    }
}

/**
 * Manages distinct UI layers for different game states (Lobby, Game, Overlay)
 * specific to the NetcodeIO package.
 * This is a singleton that creates and manages container divs within Rogue Engine's UI root.
 */
export class UILayerManager {
    private static _instance: UILayerManager;

    private layers = new Map<string, UILayer>();
    private uiRoot: HTMLElement | null = null;

    private constructor() {
        // Defer appending to DOM until RE.Runtime is ready.
        RE.onNextFrame(() => {
            this.uiRoot = RE.Runtime.uiContainer;
            if (!this.uiRoot) {
                FMLog.log('error', "UILayerManager: RE.Runtime.uiContainer not found. UI layers will not be attached.");
            }
        });
    }

    /**
     * Gets the singleton instance of the UILayerManager.
     */
    public static getInstance(): UILayerManager {
        if (!UILayerManager._instance) {
            UILayerManager._instance = new UILayerManager();
        }
        return UILayerManager._instance;
    }

    /**
     * Checks if a layer with the given name exists.
     * @param name The name of the layer.
     * @returns True if the layer exists, false otherwise.
     */
    public has(name: string): boolean {
        return this.layers.has(name);
    }

    /**
     * Destroys a layer and all its children, removing them from the DOM and unregistering them.
     * @param name The name of the layer to destroy.
     * @returns True if the layer was found and destroyed, false otherwise.
     */
    public destroy(name: string): boolean {
        const layer = this.layers.get(name);
        if (!layer) {
            return false;
        }

        // 1. Recursively destroy all children first.
        [...layer.children].forEach(child => this.destroy(child.name));

        // 2. Clean up the layer itself.
        layer.clearListeners();
        layer.element.remove();

        // 3. Remove from parent's list
        if (layer.parent) {
            const index = layer.parent.children.indexOf(layer);
            if (index > -1) {
                layer.parent.children.splice(index, 1);
            }
        }

        // 4. Unregister from manager
        this.layers.delete(name);
        return true;
    }

    /**
     * Retrieves an existing UI layer by name, if it exists.
     * @param name The name of the layer.
     * @returns The UILayer instance, or undefined if it doesn't exist.
     */
    public get(name: string): UILayer | undefined {
        return this.layers.get(name);
    }

    /**
     * Finds an existing UI layer by name. Throws an error if the layer is not found.
     * Use this when you are certain the layer has already been created.
     * @param name The name of the layer.
     * @returns The UILayer instance.
     * @throws If no layer with the given name is found.
     */
    public find(name: string): UILayer {
        const layer = this.layers.get(name);
        if (!layer) {
            throw new Error(`UILayerManager: Layer with name "${name}" not found.`);
        }
        return layer;
    }

    /**
     * Creates a new UI layer. Can be a top-level layer or a child of an existing layer.
     * @param name The name of the layer (e.g., 'game', 'lobby', 'hud').
     * @param zIndex The z-index to assign to the new layer.
     * @returns The UILayer instance.
     * @throws If a layer with the same name already exists.
     */
    public create(name: string, zIndex?: number): UILayer;
    /**
     * Creates a new UI layer. Can be a top-level layer or a child of an existing layer.
     * @param name The name of the layer (e.g., 'game', 'lobby', 'hud').
     * @param options Configuration for the new layer, including zIndex and parent.
     * @returns The UILayer instance.
     * @throws If a layer with the same name already exists.
     */
    public create(name: string, options?: { zIndex?: number, parent?: string | UILayer }): UILayer;
    public create(name: string, zIndexOrOptions: number | { zIndex?: number, parent?: string | UILayer } = {}): UILayer {
        if (this.layers.has(name)) {
            throw new Error(`UILayerManager: Layer with name "${name}" already exists.`);
        }

        let options: { zIndex?: number, parent?: string | UILayer };
        if (typeof zIndexOrOptions === 'number') {
            options = { zIndex: zIndexOrOptions };
        } else {
            options = zIndexOrOptions;
        }

        const zIndex = options.zIndex ?? 0;
        const parentLayer = this.resolveParent(options.parent);
        const isChild = !!parentLayer;

        const container = this.createContainer(`netcode-${name}-container`, zIndex, isChild);
        const layer = new UILayer(name, container, this);
        this.layers.set(name, layer);

        if (parentLayer) {
            parentLayer.children.push(layer);
            layer.parent = parentLayer;
            parentLayer.element.appendChild(container);
        } else {
            // Top-level layer, append to uiRoot
            if (this.uiRoot) {
                this.uiRoot.appendChild(container);
            } else {
                RE.onNextFrame(() => {
                    if (this.uiRoot) this.uiRoot.appendChild(container);
                });
            }
        }

        return layer;
    }

    private resolveParent(parent?: string | UILayer): UILayer | null {
        if (!parent) return null;
        if (typeof parent === 'string') {
            const parentLayer = this.get(parent);
            if (!parentLayer) {
                FMLog.log('warn', `Parent layer "${parent}" not found. Creating as a top-level layer.`);
                return null;
            }
            return parentLayer;
        }
        return parent;
    }

    private createContainer(id: string, zIndex: number, isChild: boolean): HTMLDivElement {
        const container = document.createElement('div');
        container.id = id;

        if (isChild) {
            // Child layers are positioned relative to their parent by default.
            // Specific sizing and positioning should be handled by CSS.
            container.style.position = 'relative';
        } else {
            // Style to stack and fill the screen without interfering with game input by default.
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.pointerEvents = 'none'; // Children must set 'auto' to be interactive.
            container.style.overflow = 'hidden'; // Prevent content from spilling out.
            container.style.zIndex = String(zIndex);
        }
        return container;
    }

    /** Removes all child elements from all UI containers. */
    public resetAll(): void {
        // Only reset top-level layers. Resetting a parent will recursively destroy its children.
        const topLevelLayers = Array.from(this.layers.values()).filter(l => !l.parent);
        for (const layer of topLevelLayers) {
            layer.reset();
        }
    }
}