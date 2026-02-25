import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class GlobalHUD extends BaseUI {

    public render() {
        const localStyles = `
                .global-hud-container {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    pointer-events: auto;
                }`;

        this.layer.html(`
            ${this.getBaseHtml(commonStyles + localStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="global-hud-container">
                <button id="toggle-overlay-btn" class="focus-test-button">Toggle Global Overlay</button>
            </div>
        `);

        this.layer.on('click', '#toggle-overlay-btn', () => {
            this.focusManager.events.emit(FocusEvents.GLOBAL_OVERLAY_TOGGLE);
        });
    }
}