type EventHandler = (payload?: any) => void;

/**
 * A simple, type-safe event bus for decoupled communication within the Focus Framework.
 */
export class FocusEventBus {
    private listeners: Map<string, EventHandler[]> = new Map();

    /**
     * Registers an event handler for the given event.
     * @param eventName The name of the event to listen for.
     * @param callback The function to call when the event is emitted.
     */
    public on(eventName: string, callback: EventHandler): void {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName)!.push(callback);
    }

    /**
     * Unregisters an event handler for the given event.
     * @param eventName The name of the event.
     * @param callback The callback function to remove.
     */
    public off(eventName: string, callback: EventHandler): void {
        const eventListeners = this.listeners.get(eventName);
        if (eventListeners) {
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    /**
     * Emits an event, calling all registered handlers for it.
     * @param eventName The name of the event to emit.
     * @param payload Optional data to pass to the event handlers.
     */
    public emit(eventName: string, payload?: any): void {
        const eventListeners = this.listeners.get(eventName);
        if (eventListeners) {
            // Iterate over a copy in case a listener modifies the array (e.g., by calling off())
            [...eventListeners].forEach(listener => {
                try {
                    listener(payload);
                } catch (e) {
                    console.error(`Error in event handler for '${eventName}':`, e);
                }
            });
        }
    }
}