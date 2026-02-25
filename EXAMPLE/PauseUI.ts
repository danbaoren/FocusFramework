import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class PauseUI extends BaseUI {

    public render() {
        this.layer.html(`
            ${this.getBaseHtml(commonStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="focus-test-panel-container">
                <div class="focus-test-panel">
                    <h2>Paused</h2>
                    <p>The game is currently paused.</p>
                    <button id="resume-btn" class="focus-test-button">Resume</button><br>
                    <button id="settings-btn" class="focus-test-button secondary">Settings</button>
                    <button id="quit-btn" class="focus-test-button secondary">Quit to Lobby</button>
                </div>
            </div>
        `);

        this.layer.on('click', '#resume-btn', () => this.focusManager.events.emit(FocusEvents.PAUSE_RESUME));
        this.layer.on('click', '#settings-btn', () => this.focusManager.events.emit(FocusEvents.PAUSE_OPEN_SETTINGS));
        this.layer.on('click', '#quit-btn', () => this.focusManager.events.emit(FocusEvents.PAUSE_QUIT_TO_LOBBY));
    }
}