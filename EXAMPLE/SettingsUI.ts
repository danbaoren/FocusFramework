import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class SettingsUI extends BaseUI {

    public render() {
        this.layer.html(`
            ${this.getBaseHtml(commonStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <!--
              This UI is rendered into a child layer that will be styled to be a centering container.
              We only need to render the panel itself, not another full-screen backdrop.
            -->
            <div class="focus-test-panel">
                <h2>Settings</h2>
                <p>Adjust volume, graphics, etc. here.</p>
                <button id="settings-back-btn" class="focus-test-button">Back</button>
            </div>
        `);

        this.layer.on('click', '#settings-back-btn', () => this.focusManager.events.emit(FocusEvents.SETTINGS_BACK));
    }
}