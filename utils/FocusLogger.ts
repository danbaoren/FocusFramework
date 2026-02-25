export type FocusLogCategory = 'state' | 'ui' | 'prefab' | 'lifecycle' | 'warn' | 'error' | 'debug';
import * as RE from 'rogue-engine';

const LOG_STYLES = {
    base: 'padding: 2px 5px; border-radius: 3px; font-family: "Inter", "Fira Code", monospace; font-size: 11px;',
    time: 'color: #888;',
    category: {
        STATE:     'background-color: #253c59; color: #82aaff;',
        UI:        'background-color: #1c4747; color: #79e2e2;',
        PREFAB:    'background-color: #412c59; color: #c792ea;',
        LIFECYCLE: 'background-color: #4a4a32; color: #e5c07b;',
        DEBUG:     'background-color: #333; color: #ccc;',
        WARN:      'background-color: #5c4f2b; color: #ffcb6b; font-weight: bold;',
        ERROR:     'background-color: #5c2b2b; color: #ff8a80; font-weight: bold;',
    }
};

/**
 * A themed logger for the FocusManager framework.
 */
class FocusLogger {
    public enabled = true;
    public filter: string | RegExp | null = null;
    public enabledCategories = new Set<FocusLogCategory>(['state', 'ui', 'prefab', 'lifecycle', 'warn', 'error', 'debug']);

    public log(category: FocusLogCategory, title: string, ...data: any[]): void {
        if (!this.shouldLog(category, title)) return;

        const categoryUpper = category.toUpperCase() as keyof typeof LOG_STYLES.category;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const categoryStyle = LOG_STYLES.category[categoryUpper] || LOG_STYLES.category.DEBUG;

        const logLine = [
            `%c${time}%c ${category.toUpperCase()} %c ${title}`,
            `${LOG_STYLES.base} ${LOG_STYLES.time}`,
            `${LOG_STYLES.base} ${categoryStyle}`,
            'color: inherit; background-color: inherit; font-weight: normal;',
        ];

        const hasData = data.length > 0;
        const logMethod = category === 'error' ? console.error : (category === 'warn' ? console.warn : console.log);

        if (hasData) {
            const groupMethod = (category === 'error' || category === 'warn') ? console.group : console.groupCollapsed;
            groupMethod(...logLine);
            data.forEach(d => logMethod(d));
            console.groupEnd();
        } else {
            logMethod(...logLine);
        }
    }

    public logImage(category: FocusLogCategory, title: string, url: string, width: number, height: number): void {
        if (!this.shouldLog(category, title)) return;

        const categoryUpper = category.toUpperCase() as keyof typeof LOG_STYLES.category;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const categoryStyle = LOG_STYLES.category[categoryUpper] || LOG_STYLES.category.DEBUG;

        const logLine = [
            `%c${time}%c ${category.toUpperCase()} %c ${title}`,
            `${LOG_STYLES.base} ${LOG_STYLES.time}`,
            `${LOG_STYLES.base} ${categoryStyle}`,
            'color: inherit; background-color: inherit; font-weight: normal;',
        ];
        console.log(...logLine);

        if (typeof window === 'undefined' || typeof document === 'undefined') {
            console.log(`[Image URL] ${url}`);
            return;
        }

        if ((window as any)["rogue-editor-api"]) {
            const imageTag = `<img src="${url}" width="${width}" height="${height}" style="background-color: #18181b; image-rendering: pixelated; image-rendering: crisp-edges;" />`;
            RE.Debug.log(imageTag);
            return;
        }

        const style = `
            padding: ${height / 2}px ${width / 2}px;
            background: url('${url}') center/contain no-repeat;
            font-size: 0;
        `;
        console.log(`%c `, style);
    }

    private shouldLog(category: FocusLogCategory, title: string): boolean {
        if (!this.enabled) return false;
        if (!this.enabledCategories.has(category)) return false;

        if (this.filter) {
            if (typeof this.filter === 'string') {
                if (!title.toLowerCase().includes(this.filter.toLowerCase())) return false;
            } else if (this.filter instanceof RegExp) {
                if (!this.filter.test(title)) return false;
            }
        }

        return true;
    }
}

/**
 * Singleton instance of the FocusLogger.
 * @example
 * FMLog.log('state', 'Switched to Game', { score: 100 });
 */
export const FMLog = new FocusLogger();