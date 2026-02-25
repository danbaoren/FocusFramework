import { UILayer } from './UILayerManager';
import { FocusManager } from './FocusManager';

/**
 * An abstract base class for UI controller components.
 * It provides a standard constructor and helper methods for rendering HTML content
 * into a `UILayer`. This class is intended to be extended by concrete UI
 * implementations (e.g., MainMenuUI, GameHUD).
 */
export abstract class BaseUI {
    constructor(protected layer: UILayer, protected focusManager: FocusManager) {}

    /**
     * A helper to generate common HTML boilerplate, like style and link tags.
     * @param styles CSS styles to inject into a `<style>` tag.
     * @param headContent Additional content to inject, like `<link>` tags for fonts.
     * @returns An HTML string containing the provided content.
     */
    protected getBaseHtml(styles: string = '', headContent: string = ''): string {
        return `
            ${headContent}
            <style>${styles}</style>
        `;
    }

    /** Renders the UI into its layer. This method must be implemented by subclasses. */
    abstract render(payload?: any): void;
}