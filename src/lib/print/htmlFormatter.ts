/**
 * HTML Formatting Utilities
 * Convert HTML to formatted text for various export formats
 */

/**
 * Strip HTML tags completely for plain text export
 */
export const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

/**
 * Convert HTML to plain text with basic formatting preserved
 * Converts:
 * - <b>, <strong> to **text**
 * - <i>, <em> to *text*
 * - <u> to _text_
 * - <br>, <p> to line breaks
 * - <ul>, <ol> to bulleted/numbered lists
 */
export const htmlToFormattedText = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    let result = '';

    const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();
            const childText = Array.from(element.childNodes)
                .map(child => processNode(child))
                .join('');

            switch (tagName) {
                case 'b':
                case 'strong':
                    return `**${childText}**`;
                case 'i':
                case 'em':
                    return `*${childText}*`;
                case 'u':
                    return `_${childText}_`;
                case 'br':
                    return '\n';
                case 'p':
                    return `${childText}\n`;
                case 'li':
                    return `• ${childText}\n`;
                case 'ul':
                case 'ol':
                    return `${childText}\n`;
                default:
                    return childText;
            }
        }

        return '';
    };

    result = Array.from(temp.childNodes)
        .map(node => processNode(node))
        .join('');

    return result.trim();
};

/**
 * Convert HTML to RTF format codes
 */
export const htmlToRTF = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return escapeRTF(node.textContent || '');
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();
            const childText = Array.from(element.childNodes)
                .map(child => processNode(child))
                .join('');

            switch (tagName) {
                case 'b':
                case 'strong':
                    return `\\b ${childText}\\b0 `;
                case 'i':
                case 'em':
                    return `\\i ${childText}\\i0 `;
                case 'u':
                    return `\\ul ${childText}\\ul0 `;
                case 'br':
                    return '\\par\n';
                case 'p':
                    return `${childText}\\par\n`;
                case 'li':
                    return `{\\pntext\\bullet\\tab}${childText}\\par\n`;
                default:
                    return childText;
            }
        }

        return '';
    };

    return Array.from(temp.childNodes)
        .map(node => processNode(node))
        .join('');
};

/**
 * Escape special RTF characters
 */
export const escapeRTF = (text: string): string => {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/\n/g, '\\par\n');
};

/**
 * Parse HTML and extract formatting for Excel rich text
 * Returns an array of text runs with formatting
 */
export interface ExcelTextRun {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}

export const htmlToExcelRichText = (html: string): ExcelTextRun[] => {
    if (!html) return [{ text: '' }];

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const runs: ExcelTextRun[] = [];

    const processNode = (node: Node, formatting: { bold?: boolean; italic?: boolean; underline?: boolean } = {}): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim()) {
                runs.push({ text, ...formatting });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();

            const newFormatting = { ...formatting };
            if (tagName === 'b' || tagName === 'strong') newFormatting.bold = true;
            if (tagName === 'i' || tagName === 'em') newFormatting.italic = true;
            if (tagName === 'u') newFormatting.underline = true;

            if (tagName === 'br') {
                runs.push({ text: '\n' });
            } else if (tagName === 'p' && element.previousElementSibling) {
                runs.push({ text: '\n' });
                Array.from(element.childNodes).forEach(child => processNode(child, newFormatting));
            } else {
                Array.from(element.childNodes).forEach(child => processNode(child, newFormatting));
            }
        }
    };

    Array.from(temp.childNodes).forEach(node => processNode(node));

    return runs.length > 0 ? runs : [{ text: stripHtml(html) }];
};
