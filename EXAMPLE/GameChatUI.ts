import { BaseUI } from '../BaseUI';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

const MOCK_PLAYERS = ["Raptor_7", "Nova_Spectre", "Cmdr_Helix", "Void_Walker"];
const MOCK_MESSAGES = [
    "Anyone seen a level 3 power core?",
    "Watch out for asteroids on the left flank.",
    "lol, that was a close one!",
    "My shields are down to 20%!",
    "Heading to the jump gate, cover me.",
    "Nice shot!",
    "gg",
];

export class GameChatUI extends BaseUI {
    private mockMessageTimer: number | null = null;

    private cleanup() {
        if (this.mockMessageTimer) {
            clearInterval(this.mockMessageTimer);
            this.mockMessageTimer = null;
        }
    }

    private addMessage(sender: string, text: string, isSelf = false) {
        const messagesContainer = this.layer.find('.chat-messages');
        if (!messagesContainer) return;

        const messageEl = document.createElement('div');
        messageEl.classList.add('chat-message');
        if (isSelf) {
            messageEl.classList.add('self');
        }

        messageEl.innerHTML = `<strong>${sender}:</strong> ${text}`;
        messagesContainer.appendChild(messageEl);

        // Auto-scroll to the bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    public render() {
        this.layer.html(`
            ${this.getBaseHtml(commonStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="game-chat-container">
                <div class="chat-messages"></div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input" placeholder="Type a message...">
                    <button id="send-chat-btn" class="focus-test-button">Send</button>
                </div>
            </div>
        `);

        const input = this.layer.find<HTMLInputElement>('#chat-input');

        const sendMessage = () => {
            if (input && input.value.trim() !== '') {
                this.addMessage("You", input.value.trim(), true);
                input.value = '';
            }
        };

        this.layer.on('click', '#send-chat-btn', sendMessage);
        
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Simulate other players chatting
        this.mockMessageTimer = window.setInterval(() => {
            if (this.focusManager.is('game')) {
                const randomPlayer = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)];
                const randomMessage = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
                this.addMessage(randomPlayer, randomMessage);
            }
        }, 5000);

        this.addMessage("System", "Welcome to the game! Chat is now active.", false);
        this.layer.addCleanupTask(() => this.cleanup());
    }
}