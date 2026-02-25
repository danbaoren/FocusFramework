import * as RE from 'rogue-engine';
import { FocusManager } from "../FocusManager";
import { UILayer } from '../UILayerManager';
import { FMLog } from './FocusLogger';
import { FocusStateConfig } from '../FocusState';

const DEBUG_LAYER_NAME = 'focus-debug-layer';
const DEBUG_Z_INDEX = 10000;

/**
 * A helper class to visualize and debug FocusManager states.
 * It creates an overlay that can be toggled to show all registered states
 * and allows switching between them by clicking.
 */
export class FocusDebugger {
    private focusManager: FocusManager;
    private debugLayer: UILayer;
    private panelVisible = false;
    private hideTimeoutId: number | null = null;

    constructor(focusManager: FocusManager) {
        this.focusManager = focusManager;
        const uiManager = this.focusManager.uiManager;

        if (uiManager.has(DEBUG_LAYER_NAME)) {
            this.debugLayer = uiManager.find(DEBUG_LAYER_NAME);
        } else {
            this.debugLayer = uiManager.create(DEBUG_LAYER_NAME, DEBUG_Z_INDEX);
        }
    }

    /**
     * Initializes the debug UI and attaches event listeners.
     * Listens for the backtick (`) key to toggle the debug panel.
     */
    public init() {
        this.debugLayer.setStyle({
            fontFamily: 'sans-serif',
            fontSize: '14px',
            color: 'white',
        });

        this.render(); // Initial render of the toggle button

        window.addEventListener('keydown', (e) => {
            if (e.key === '`') {
                this.togglePanel();
            }
        });

        this.focusManager.onSwitch(() => {
            // If the panel is open, re-render to show the new active state
            if (this.panelVisible) {
                this.render();
            }
        });
    }

    private togglePanel() {
        this.panelVisible = !this.panelVisible;
        this.render();
    }

    private createInfoSection(title: string, items: string[] | undefined): string {
        if (!items || items.length === 0) {
            return '';
        }
        const itemHtml = items.map(item => `<li>${item}</li>`).join('');
        return `
            <div class="focus-debug-info-section">
                <strong>${title}:</strong>
                <ul>${itemHtml}</ul>
            </div>
        `;
    }

    private generateInfoHtml(config: FocusStateConfig | undefined): string {
        if (!config) {
            return '<div class="focus-debug-info-section"><span>No config found</span></div>';
        }

        const parts: string[] = [];

        parts.push(this.createInfoSection('Transition', config.transitionEffectName ? [config.transitionEffectName] : undefined));
        parts.push(this.createInfoSection('Prefabs', config.managedPrefabs));
        parts.push(this.createInfoSection('UI: Visible', config.ui?.visible));
        parts.push(this.createInfoSection('UI: Reset on Exit', config.ui?.resetOnExit));
        parts.push(this.createInfoSection('UI: Cleanup on Exit', config.ui?.cleanupOnExit));

        const hooks: string[] = [];
        if (config.onEnterHookCount && config.onEnterHookCount > 0) hooks.push(`onEnter (${config.onEnterHookCount})`);
        if (config.onExitHookCount && config.onExitHookCount > 0) hooks.push(`onExit (${config.onExitHookCount})`);
        parts.push(this.createInfoSection('Lifecycle Hooks', hooks));

        const definedLayers = config.ui?.layers ? Object.keys(config.ui.layers) : [];
        parts.push(this.createInfoSection('Defines Layers', definedLayers));

        const finalHtml = parts.filter(p => p).join('');

        if (finalHtml.length === 0) {
            return '<div class="focus-debug-info-section" style="text-align: center; color: #888;"><span>(No special config)</span></div>';
        }

        return finalHtml;
    }

    private render() {
        const fontUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Georgia&display=swap";

        const styles = `
            /* --- Scrollbar --- */
            .focus-debug-filmstrip::-webkit-scrollbar { height: 8px; }
            .focus-debug-filmstrip::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
            .focus-debug-filmstrip::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            .focus-debug-filmstrip::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

            /* --- Scene Panel --- */
            .focus-debug-panel {
                flex-shrink: 0;
                position: relative;
                width: 240px;
                height: 135px;
                margin: 15px;
                background: linear-gradient(145deg, #2e3138, #26292e);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
                font-family: 'Inter', sans-serif;
                font-size: 20px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #a0a0a0;
                box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                user-select: none;
            }
            .focus-debug-panel:hover {
                border-color: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 12px 30px rgba(0,0,0,0.6);
            }

            /* --- Active Scene Panel --- */
            .focus-debug-panel.active {
                border-color: rgba(56, 189, 248, 0.5);
                color: #fff;
                box-shadow: 0 0 20px rgba(56, 189, 248, 0.2), 0 0 40px rgba(56, 189, 248, 0.1);
                transform: translateY(-2px) scale(1.05);
            }
            .focus-debug-panel.active:hover {
                border-color: rgba(56, 189, 248, 0.8);
            }
            .focus-debug-panel.active::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, #38bdf8, transparent);
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
            }

            /* --- Info Popup --- */
            #focus-debug-info-popup {
                position: fixed;
                width: 280px;
                background: rgba(30, 32, 36, 0.98);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 12px;
                font-size: 12px;
                font-family: 'Inter', sans-serif;
                text-align: left;
                text-transform: none;
                letter-spacing: 0;
                z-index: 10001;
                pointer-events: none;
                box-shadow: 0 5px 20px rgba(0,0,0,0.5);
                transition: opacity 0.1s ease-in-out, transform 0.1s ease-in-out;
                backdrop-filter: blur(5px);
            }

            /* --- Info Popup Sections --- */
            .focus-debug-info-section {
                margin-bottom: 8px;
            }
            .focus-debug-info-section:last-child {
                margin-bottom: 0;
            }
            .focus-debug-info-section strong {
                color: #38bdf8;
                display: block;
                margin-bottom: 4px;
                font-weight: 600;
            }
            .focus-debug-info-section ul {
                list-style: none;
                padding-left: 10px;
                margin: 0;
                color: #c0c0c0;
            }
        `;

        let html = `
            <link rel="stylesheet" href="${fontUrl}">
            <style>${styles.replace(/\s\s+/g, ' ')}</style>
            <div id="focus-debug-toggle" style="position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.7); padding: 8px 12px; border-radius: 5px; cursor: pointer; pointer-events: auto; z-index: 1;">
                Focus Debug (\`)
            </div>
        `;

        if (this.panelVisible) {
            const allStates = this.focusManager.getRegisteredStates();
            const allStateConfigs = this.focusManager.getRegisteredStateConfigs();
            const currentState = this.focusManager.current;

            const statePanels = allStates.map(stateName => {
                const isActive = stateName === currentState;
                return `
                    <div data-state="${stateName}" class="focus-debug-panel ${isActive ? 'active' : ''}">
                        <span>${stateName}</span>
                    </div>
                `;
            }).join('');

            html += `
                <div id="focus-debug-panel" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(25, 28, 32, 0.95) 0%, rgba(10, 12, 14, 0.98) 100%); pointer-events: auto; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(8px) saturate(120%); font-family: 'Inter', sans-serif;">
                    <h2 style="font-family: 'Georgia', serif; font-weight: 500; font-size: 24px; letter-spacing: 4px; color: #e2e2e2; text-shadow: 0 0 10px rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px; margin-bottom: 10px;">
                        SCENE FOCUSES
                    </h2>
                    <div class="focus-debug-filmstrip" style="width: 90%; display: flex; align-items: center; justify-content: flex-start; overflow-x: auto; padding: 20px 0;">
                        ${statePanels}
                    </div>
                    <div id="focus-debug-info-popup" style="display: none; opacity: 0;"></div>
                    <div style="position: absolute; bottom: 20px; font-size: 12px; color: #888;">
                        Click a panel to switch focus. Press \` to close.
                    </div>
                </div>
            `;
        }

        this.debugLayer.html(html);

        // Always re-attach the toggle listener since .html() clears the layer
        this.debugLayer.on('click', '#focus-debug-toggle', () => this.togglePanel());

        // Only attach state button listeners if the panel is visible
        if (this.panelVisible) {
            const infoPopup = this.debugLayer.find<HTMLDivElement>('#focus-debug-info-popup');
            const allStateConfigs = this.focusManager.getRegisteredStateConfigs();

            if (infoPopup) {
                // Allow hovering over the popup itself by making it interactive.
                infoPopup.style.pointerEvents = 'auto';

                const scheduleHide = () => {
                    if (this.hideTimeoutId) clearTimeout(this.hideTimeoutId);
                    this.hideTimeoutId = window.setTimeout(() => {
                        infoPopup.style.opacity = '0';
                        // After the transition, set display to none to remove from layout.
                        setTimeout(() => {
                            if (infoPopup.style.opacity === '0') infoPopup.style.display = 'none';
                        }, 100); // Must match CSS opacity transition duration
                        this.hideTimeoutId = null;
                    }, 100); // Delay before starting to hide
                };

                const cancelHide = () => {
                    if (this.hideTimeoutId) {
                        clearTimeout(this.hideTimeoutId);
                        this.hideTimeoutId = null;
                    }
                };

                this.debugLayer.on('mouseover', '[data-state]', (e, target) => {
                    cancelHide();

                    const stateName = target.dataset.state;
                    if (!stateName) return;

                    const config = allStateConfigs.get(stateName);
                    infoPopup.innerHTML = this.generateInfoHtml(config);

                    const targetRect = target.getBoundingClientRect();
                    infoPopup.style.display = 'block';
                    infoPopup.style.opacity = '1';
                    infoPopup.style.left = `${targetRect.left + targetRect.width / 2}px`;
                    infoPopup.style.top = `${targetRect.bottom + 10}px`;
                    infoPopup.style.transform = 'translateX(-50%) translateY(5px)';
                });

                this.debugLayer.on('mouseout', '[data-state]', scheduleHide);

                infoPopup.addEventListener('mouseover', cancelHide);
                infoPopup.addEventListener('mouseout', scheduleHide);
            }

            this.debugLayer.on('click', '[data-state]', (e, target) => {
                const stateName = target.dataset.state;
                if (stateName) {
                    FMLog.log('debug', `Switching to state: ${stateName}`);
                    this.focusManager.switch(stateName);
                    this.togglePanel(); // Hide panel after switching
                }
            });
        }
    }
}