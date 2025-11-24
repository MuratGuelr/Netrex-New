export function formatText(text) {
  let c = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  c = c.replace(
    /```(\w+)?\n?([\s\S]*?)```/g,
    (m, l, code) =>
      `<div class="code-wrapper"><div class="code-header">${
        l || 'text'
      }</div><pre><code class="language-${l}">${code}</code></pre></div>`
  );
  
  c = c.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Link görüntüleme
  const linkRegex = /(https?:\/\/[^\s<]+)/g;
  c = c.replace(linkRegex, (match) => {
    const displayText = match.length > 35 ? match.substring(0, 35) + '...' : match;
    return `<a href="${match}" target="_blank" title="${match}" class="text-blue-400 hover:underline">${displayText}</a>`;
  });
  
  return c;
}

