import { UILayer } from '../UILayerManager';
import { FocusManager } from '../FocusManager';
import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class GlobalOverlayUI extends BaseUI {
    constructor(layer: UILayer, focusManager: FocusManager) {
        super(layer, focusManager);
        // Listen for events to control visibility. This decouples the overlay
        // from whatever component wants to show it.
        const bus = this.focusManager.events;
        bus.on(FocusEvents.GLOBAL_OVERLAY_SHOW, () => this.show());
        bus.on(FocusEvents.GLOBAL_OVERLAY_HIDE, () => this.hide());
        bus.on(FocusEvents.GLOBAL_OVERLAY_TOGGLE, () => this.layer.element.style.display === 'none' ? this.show() : this.hide());
    }

    public show() {
        this.layer.show();
    }

    public hide() {
        this.layer.hide();
    }

    public render() {
        const localStyles = `
                .global-overlay-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    pointer-events: auto;
                    background: rgba(20, 20, 22, 0.5);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px); /* For Safari */
                }`;

        this.layer.html(`
            ${this.getBaseHtml(commonStyles + localStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="global-overlay-container">
                <div class="focus-test-panel" style="min-width: 450px;">
                    <h2>Global Overlay</h2>
                    <p>This panel is independent of the current state and has a blurry background.</p>
                    <button id="close-overlay-btn" class="focus-test-button secondary">Close</button>
                </div>
            </div>
        `);

        this.layer.on('click', '#close-overlay-btn', () => {
            this.focusManager.events.emit(FocusEvents.GLOBAL_OVERLAY_HIDE);
        });
        this.hide(); // Start hidden by default
    }
}