export const fontUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap";

export const commonStyles = `
    .focus-test-panel-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
        background: rgba(0,0,0,0.7);
        font-family: 'Inter', sans-serif;
        color: #e2e2e2;
    }

    .focus-test-panel {
        background: linear-gradient(145deg, #2e3138, #26292e);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0;
        padding: 24px 32px;
        min-width: 300px;
        text-align: center;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
    }

    .focus-test-panel h1, .focus-test-panel h2 {
        font-weight: 700;
        margin: 0 0 16px 0;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #fff;
        text-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
    }
    
    .focus-test-panel h2 {
        font-size: 28px;
    }

    .focus-test-panel p {
        margin: 16px 0;
        color: #a0a0a0;
    }

    .focus-test-button {
        background-color: #38bdf8;
        color: white;
        border: none;
        border-radius: 0;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        margin: 5px;
    }

    .focus-test-button:hover {
        background-color: #0ea5e9;
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
    }

    .focus-test-button.secondary {
        background-color: #4a4a4a;
    }

    .focus-test-button.secondary:hover {
        background-color: #5a5a5a;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    }

    .focus-test-game-hud {
        pointer-events: none;
        font-family: 'Inter', sans-serif;
    }

    .focus-test-game-hud > div {
        pointer-events: auto;
        background: rgba(0,0,0,0.7);
        padding: 8px 12px;
        border-radius: 0;
    }

    .game-chat-container {
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 350px;
        height: 250px;
        background: rgba(30, 30, 35, 0.8);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', sans-serif;
        color: #e2e2e2;
        pointer-events: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .chat-messages {
        flex-grow: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .chat-message {
        font-size: 14px;
        line-height: 1.4;
    }

    .chat-message strong {
        color: #38bdf8;
    }

    .chat-message.self strong {
        color: #f59e0b; /* Amber for self */
    }

    .chat-input-area {
        display: flex;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .chat-input-area input {
        flex-grow: 1;
        background: transparent;
        border: none;
        color: white;
        padding: 10px;
        outline: none;
    }

    .chat-input-area button {
        padding: 8px 12px;
        margin: 4px;
        font-size: 14px;
    }
`;