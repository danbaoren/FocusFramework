/**
 * A utility for rendering text-based art to an image data URL for console logging.
 */
export class FocusArt {
    /**
     * Renders a multi-line string as ASCII art into a data URL.
     * @param ascii The string to render.
     * @param options Configuration for rendering.
     * @returns A data URL of the rendered image and its dimensions.
     */
    public static renderAsciiToImage(ascii: string, options: {
        fontSize?: number,
        fontName?: string,
        bgColor?: string,
        textColor?: string,
        width?: number,
    }): { dataUrl: string, width: number, height: number } {
        const {
            fontSize = 10,
            fontName = 'monospace',
            bgColor = '#1e1e1e',
            textColor = '#e2e2e2',
        } = options;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return { dataUrl: "", width: 0, height: 0 };

        const lines = ascii.split('\n');
        const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, "");
        const numLines = lines.length;

        if (numLines === 0 || longestLine.length === 0) return { dataUrl: "", width: 0, height: 0 };

        const lineHeightRatio = 1.0;

        ctx.font = `${fontSize}px ${fontName}`;
        const charMetrics = ctx.measureText('M');
        const charWidth = charMetrics.width;
        const charHeight = fontSize;

        canvas.width = Math.ceil(options.width || (longestLine.length * charWidth));
        canvas.height = Math.ceil(numLines * charHeight * lineHeightRatio);

        ctx.font = `${fontSize}px ${fontName}`;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = textColor;
        ctx.textBaseline = 'top';

        lines.forEach((line, index) => {
            ctx.fillText(line, 0, index * charHeight * lineHeightRatio);
        });

        return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
    }
}