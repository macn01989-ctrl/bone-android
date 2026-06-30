import type { ReactNode } from 'react';

export function renderHighlightedText(text: string, query: string): ReactNode {
  const keyword = query.trim();
  if (!keyword) return text;

  const source = text || '';
  const lowerSource = source.toLocaleLowerCase();
  const lowerKeyword = keyword.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerSource.indexOf(lowerKeyword, cursor);

  while (index !== -1) {
    if (index > cursor) {
      parts.push(source.slice(cursor, index));
    }

    const end = index + keyword.length;
    parts.push(
      <mark className="page4-highlight" key={`${index}-${end}`}>
        {source.slice(index, end)}
      </mark>,
    );

    cursor = end;
    index = lowerSource.indexOf(lowerKeyword, cursor);
  }

  if (cursor < source.length) {
    parts.push(source.slice(cursor));
  }

  return parts;
}

export function plainTextFromRich(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:div|p)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

export function toEditableHtml(value: string) {
  if (/<\/?(?:strong|b|br|div|p)(?:\s[^>]*)?>/i.test(value)) return value;

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export function renderFormattedText(value: string, query: string): ReactNode {
  if (!/<[a-z][^>]*>/i.test(value)) return renderHighlightedText(value, query);

  const root = document.createElement('div');
  root.innerHTML = value;
  let key = 0;

  const renderNodes = (nodes: ChildNode[], bold = false): ReactNode[] =>
    nodes.reduce<ReactNode[]>((result, node) => {
      const nodeKey = key++;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const rendered = renderHighlightedText(text, query);
        result.push(
          bold ? <strong key={`bold-${nodeKey}`}>{rendered}</strong> : <span key={`text-${nodeKey}`}>{rendered}</span>,
        );
        return result;
      }

      if (!(node instanceof HTMLElement)) return result;
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        result.push(<br key={`br-${nodeKey}`} />);
        return result;
      }

      const children = renderNodes(Array.from(node.childNodes), bold || tag === 'b' || tag === 'strong');
      if (tag === 'div' || tag === 'p') children.push(<br key={`line-${nodeKey}`} />);
      result.push(...children);
      return result;
    }, []);

  return renderNodes(Array.from(root.childNodes));
}
