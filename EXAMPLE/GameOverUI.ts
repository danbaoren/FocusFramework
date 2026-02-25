import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class GameOverUI extends BaseUI {

    public render(payload: any) {
        const score = payload ? payload.score : 'N/A';

        this.layer.html(`
            ${this.getBaseHtml(commonStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="focus-test-panel-container">
                <div class="focus-test-panel">
                    <h2>Game Over</h2>
                    <p style="font-size: 24px; margin: 20px 0;">Final Fragments: <strong style="color: #38bdf8;">${score}</strong></p>
                    <button id="gameover-back-btn" class="focus-test-button">Back to Lobby</button>
                </div>
            </div>
        `);

        this.layer.on('click', '#gameover-back-btn', () => {
            this.focusManager.events.emit(FocusEvents.GAMEOVER_BACK_TO_LOBBY);
        });
    }
}