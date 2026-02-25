import { BaseUI } from '../BaseUI';
import { FocusEvents } from './FocusEvents';
import { commonStyles, fontUrl } from './FocusTestUIStyles';

export class GameUI extends BaseUI {
    // --- Game State ---
    private score = 0;
    private timeLeft = 60; // Longer game session for clicker-style
    private gameTimerId: number | null = null;

    // --- Clicker Game Properties ---
    private clickPower = 1;
    private clickUpgradeCost = 25;

    private autoMiners = 0;
    private autoMinerPower = 1; // 1 fragment per miner per second
    private autoMinerCost = 50;

    private cleanup() {
        if (this.gameTimerId) {
            clearInterval(this.gameTimerId);
            this.gameTimerId = null;
        }
    }

    private showClickEffect(event: MouseEvent) {
        // Create a temporary element to show the score gain
        const effectEl = document.createElement('div');
        effectEl.textContent = `+${this.clickPower}`;
        Object.assign(effectEl.style, {
            position: 'absolute',
            left: `${event.clientX}px`,
            top: `${event.clientY}px`,
            color: '#f59e0b',
            fontWeight: 'bold',
            fontSize: '20px',
            pointerEvents: 'none',
            transition: 'transform 0.5s ease-out, opacity 0.5s ease-out',
            transform: 'translate(-50%, -50%)',
            zIndex: '10',
            textShadow: '0 0 5px black',
        });

        // Append to the layer, not the document body, to keep it contained.
        this.layer.append(effectEl);

        // Animate and remove the element
        requestAnimationFrame(() => {
            effectEl.style.transform = 'translate(-50%, -150%)';
            effectEl.style.opacity = '0';
        });

        setTimeout(() => {
            effectEl.remove();
        }, 500);
    }

    private updateUI() {
        const scoreEl = this.layer.find('#game-score');
        const timerEl = this.layer.find('#game-timer');
        const clickPowerEl = this.layer.find('#click-power-stat');
        const autoMinersEl = this.layer.find('#auto-miners-stat');

        if (scoreEl) scoreEl.textContent = String(Math.floor(this.score));
        if (timerEl) timerEl.textContent = String(this.timeLeft);
        if (clickPowerEl) clickPowerEl.textContent = String(this.clickPower);
        if (autoMinersEl) autoMinersEl.textContent = `${this.autoMiners} (+${(this.autoMiners * this.autoMinerPower).toFixed(1)}/s)`;

        const clickUpgradeBtn = this.layer.find<HTMLButtonElement>('#upgrade-click-btn');
        const autoMinerUpgradeBtn = this.layer.find<HTMLButtonElement>('#upgrade-miner-btn');

        if (clickUpgradeBtn) {
            clickUpgradeBtn.querySelector('.cost')!.textContent = String(this.clickUpgradeCost);
            clickUpgradeBtn.disabled = this.score < this.clickUpgradeCost;
        }
        if (autoMinerUpgradeBtn) {
            autoMinerUpgradeBtn.querySelector('.cost')!.textContent = String(this.autoMinerCost);
            autoMinerUpgradeBtn.disabled = this.score < this.autoMinerCost;
        }
    }

    public render(payload: any) {
        const roomName = payload?.roomName || 'the Game';

        const localStyles = `
            .game-hud-top {
                position: absolute;
                top: 20px;
                left: 20px;
                right: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: white;
                font-size: 24px;
                text-shadow: 1px 1px 3px black;
                pointer-events: none;
            }
            .game-main-area {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: auto;
            }
            #data-core {
                width: 200px;
                height: 200px;
                background: radial-gradient(circle, #67e8f9, #0891b2);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 0 20px #0891b2, 0 0 40px #0891b2, inset 0 0 20px rgba(255,255,255,0.5);
                transition: transform 0.1s ease-out;
                animation: pulse 2.5s infinite ease-in-out;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 18px;
                color: white;
                text-shadow: 0 0 5px black;
            }
            #data-core:active {
                transform: scale(0.95);
                transition-duration: 0.05s;
            }
            @keyframes pulse {
                0% { box-shadow: 0 0 20px #0891b2, 0 0 40px #0891b2, inset 0 0 20px rgba(255,255,255,0.5); }
                50% { box-shadow: 0 0 30px #67e8f9, 0 0 60px #67e8f9, inset 0 0 30px rgba(255,255,255,0.8); }
                100% { box-shadow: 0 0 20px #0891b2, 0 0 40px #0891b2, inset 0 0 20px rgba(255,255,255,0.5); }
            }
            .game-upgrades-panel {
                position: absolute;
                left: 20px;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(30, 30, 35, 0.85);
                padding: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                pointer-events: auto;
                color: white;
                width: 250px;
            }
            .game-upgrades-panel h3 {
                margin-top: 0;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #e2e2e2;
            }
            .upgrade-btn {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px !important;
                text-align: left;
            }
            .upgrade-btn:disabled {
                background-color: #555;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
                opacity: 0.6;
            }
            .cost-label {
                background: rgba(0,0,0,0.3);
                padding: 4px 8px;
                border-radius: 0;
                font-size: 12px;
            }
            .stats-display {
                margin: 15px 0;
                background: rgba(0,0,0,0.2);
                padding: 5px 10px;
                border-radius: 0;
            }
            .stats-display p {
                margin: 8px 0;
                font-size: 14px;
            }
        `;

        this.layer.html(`
            ${this.getBaseHtml(commonStyles + localStyles, `<link rel="stylesheet" href="${fontUrl}">`)}
            <div class="focus-test-game-hud">
                <div class="game-hud-top">
                    <span>Room: ${roomName}</span>
                    <span>Fragments: <span id="game-score">0</span></span>
                    <span>Time: <span id="game-timer">60</span>s</span>
                </div>

                <div class="game-main-area">
                    <div id="data-core">Click Me!</div>
                </div>

                <div class="game-upgrades-panel">
                    <h3>Upgrades</h3>
                    <div class="stats-display">
                        <p>Click Power: <strong id="click-power-stat" style="color: #38bdf8;">1</strong></p>
                        <p>Auto-Miners: <strong id="auto-miners-stat" style="color: #38bdf8;">0 (+0.0/s)</strong></p>
                    </div>
                    <button id="upgrade-click-btn" class="focus-test-button upgrade-btn">
                        <span>Upgrade Click</span>
                        <span class="cost-label">Cost: <span class="cost">${this.clickUpgradeCost}</span></span>
                    </button>
                    <button id="upgrade-miner-btn" class="focus-test-button upgrade-btn">
                        <span>Buy Auto-Miner</span>
                        <span class="cost-label">Cost: <span class="cost">${this.autoMinerCost}</span></span>
                    </button>
                </div>

                <div style="position: absolute; bottom: 20px; right: 20px; pointer-events: auto;">
                    <button id="pause-btn" class="focus-test-button secondary" style="padding: 10px;">Pause</button>
                </div>
            </div>
        `);

        // --- Event Listeners ---
        this.layer.on('click', '#pause-btn', () => this.focusManager.events.emit(FocusEvents.GAME_PAUSE));

        this.layer.on('click', '#data-core', (event) => {
            this.score += this.clickPower;
            this.showClickEffect(event as MouseEvent);
            this.updateUI();
        });

        this.layer.on('click', '#upgrade-click-btn', () => {
            if (this.score >= this.clickUpgradeCost) {
                this.score -= this.clickUpgradeCost;
                this.clickPower++;
                this.clickUpgradeCost = Math.ceil(this.clickUpgradeCost * 1.5);
                this.updateUI();
            }
        });

        this.layer.on('click', '#upgrade-miner-btn', () => {
            if (this.score >= this.autoMinerCost) {
                this.score -= this.autoMinerCost;
                this.autoMiners++;
                this.autoMinerCost = Math.ceil(this.autoMinerCost * 1.2);
                this.updateUI();
            }
        });

        // Add a cleanup task to be called when the layer is reset
        this.layer.addCleanupTask(() => this.cleanup());

        // Initial UI state
        this.updateUI();

        // Start the main game loop
        this.gameTimerId = window.setInterval(() => {
            // Auto-generation happens every tick
            if (this.autoMiners > 0) {
                const generated = this.autoMiners * this.autoMinerPower;
                this.score += generated;
            }

            this.timeLeft--;
            this.updateUI();

            if (this.timeLeft <= 0) {
                this.cleanup();
                // Pass the final score (rounded down) to the game over state
                this.focusManager.events.emit(FocusEvents.GAME_OVER, { score: Math.floor(this.score) });
            }
        }, 1000);
    }
}