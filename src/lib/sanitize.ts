import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows a safe subset of HTML tags and attributes suitable for clinical documentation.
 */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div', 'span',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'img', 'a', 'sub', 'sup', 'mark', 'del', 'ins', 'hr'
    ],
    ALLOWED_ATTR: [
      'class', 'style', 'href', 'src', 'alt', 'title', 'target',
      'colspan', 'rowspan', 'width', 'height'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Strip dangerous URLs
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
  });
};

/**
 * Strip all HTML tags and return plain text.
 * Useful for exports and text-only contexts.
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

/**
 * Sanitize HTML and also clean inline font styles while preserving structure.
 * This combines XSS sanitization with style cleanup for print/display contexts.
 */
export const sanitizeAndCleanStyles = (html: string): string => {
  if (!html) return '';
  
  // First sanitize against XSS
  const sanitized = sanitizeHtml(html);
  
  // Then clean inline font styles
  const doc = new DOMParser().parseFromString(sanitized, 'text/html');
  
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach(el => {
    const element = el as HTMLElement;
    if (element.style) {
      element.style.fontSize = '';
      element.style.fontFamily = '';
      element.style.lineHeight = '';
      if (element.getAttribute('style')?.trim() === '') {
        element.removeAttribute('style');
      }
    }
    // Remove FONT tags by unwrapping their content
    if (element.tagName === 'FONT') {
      const parent = element.parentNode;
      while (element.firstChild) {
        parent?.insertBefore(element.firstChild, element);
      }
      parent?.removeChild(element);
    }
  });
  
  return doc.body.innerHTML;
};
