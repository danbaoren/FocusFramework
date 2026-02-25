import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class MainMenuUI extends BaseUI {

    public render() {
        const rooms = [
            { name: "Alpha Centauri", players: 3, max: 8 },
            { name: "Proxima b", players: 7, max: 8 },
            { name: "Sirius Sector", players: 1, max: 8 },
        ];

        const roomListHtml = rooms.map(room => `
            <div class="focus-test-room-item">
                <div>
                    <strong>${room.name}</strong>
                    <br>
                    <span>Players: ${room.players} / ${room.max}</span>
                </div>
                <button class="focus-test-button join-btn" data-room-name="${room.name}" ${room.players >= room.max ? 'disabled' : ''}>
                    ${room.players >= room.max ? 'Full' : 'Join'}
                </button>
            </div>
        `).join('');

        const localStyles = `
                .focus-test-room-item {
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .focus-test-room-item .join-btn {
                    padding: 8px 16px;
                    font-size: 14px;
                }`;

        this.layer.html(`
            ${this.getBaseHtml(commonStyles + localStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="focus-test-panel-container">
                <div class="focus-test-panel" style="min-width: 400px;">
                    <h1>Lobby</h1>
                    <div style="margin: 20px 0; text-align: left;">
                        ${roomListHtml}
                    </div>
                </div>
            </div>
        `);

        this.layer.on('click', '.join-btn', (e, target) => {
            const roomName = target.dataset.roomName;
            // Emit an event on the FocusManager's event bus.
            this.focusManager.events.emit(FocusEvents.LOBBY_JOIN_GAME, { roomName });
        });
    }
}