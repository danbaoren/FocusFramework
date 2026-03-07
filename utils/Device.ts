/**
 * A simple utility class for detecting device characteristics.
 * This is used by the Focus Framework to automatically apply platform-specific
 * behaviors and styles.
 */
class DeviceDetector {
    /**
     * True if the device has touch capabilities.
     * This is a reliable way to distinguish between touch-first interfaces (phones, tablets)
     * and pointer-first interfaces (desktops with a mouse).
     */
    public readonly isTouchDevice: boolean;

    constructor() {
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }
}

export const Device = new DeviceDetector();