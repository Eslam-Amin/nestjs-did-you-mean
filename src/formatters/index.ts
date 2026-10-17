import type {
  DidYouMeanModuleOptions,
  DidYouMeanResponsePayload,
  FormatContext,
} from '../types';

/**
 * Formats suggestions into the standard JSON error payload.
 */
export function formatJsonResponse(context: FormatContext): DidYouMeanResponsePayload {
  return {
    statusCode: context.statusCode,
    error: context.error,
    message: context.message || `Cannot ${context.method} ${context.path}`,
    suggestions: context.suggestions,
  };
}

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: '#10b981', text: '#ffffff' },
  POST: { bg: '#3b82f6', text: '#ffffff' },
  PUT: { bg: '#f59e0b', text: '#ffffff' },
  DELETE: { bg: '#ef4444', text: '#ffffff' },
  PATCH: { bg: '#8b5cf6', text: '#ffffff' },
  OPTIONS: { bg: '#6b7280', text: '#ffffff' },
  HEAD: { bg: '#06b6d4', text: '#ffffff' },
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats suggestions into a clean, interactive developer HTML page.
 */
export function formatHtmlResponse(context: FormatContext): string {
  const suggestionsHtml = context.suggestions
    .map((s) => {
      const colors = METHOD_COLORS[s.method] ?? { bg: '#6b7280', text: '#ffffff' };
      const scorePct = Math.round(s.score * 100);
      const isMismatch = s.isMethodMismatch;
      const badgeText = isMismatch ? 'Method Mismatch' : `${scorePct}% match`;
      const badgeClass = isMismatch ? 'badge-mismatch' : 'badge-match';
      const summaryHtml = s.summary
        ? `<div class="suggestion-summary">${escapeHtml(s.summary)}</div>`
        : '';

      return `
      <div class="suggestion-card">
        <div class="suggestion-header">
          <div class="route-info">
            <span class="method-badge" style="background-color: ${colors.bg}; color: ${colors.text};">${s.method}</span>
            <a href="${escapeHtml(s.path)}" class="path-link">${escapeHtml(s.path)}</a>
          </div>
          <div class="badges">
            <span class="pill ${badgeClass}">${badgeText}</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(s.path)}'); this.textContent = 'Copied!'; setTimeout(() => this.textContent = 'Copy', 1500);">Copy</button>
          </div>
        </div>
        ${summaryHtml}
      </div>
    `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 Not Found - Did You Mean?</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --mismatch: #f43f5e;
      --match: #10b981;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --card-border: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
        --accent: #0284c7;
        --mismatch: #e11d48;
        --match: #059669;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 680px;
    }
    .header {
      margin-bottom: 2rem;
    }
    .status-tag {
      display: inline-block;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--mismatch);
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: 1.6rem;
      font-weight: 700;
      word-break: break-all;
      margin-bottom: 0.5rem;
    }
    .requested-info {
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .code-badge {
      background: var(--card-border);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.9rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .suggestion-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      transition: border-color 0.15s ease;
    }
    .suggestion-card:hover {
      border-color: var(--accent);
    }
    .suggestion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .route-info {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      word-break: break-all;
    }
    .method-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .path-link {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
    }
    .path-link:hover {
      text-decoration: underline;
    }
    .badges {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .pill {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }
    .badge-match {
      background: rgba(16, 185, 129, 0.15);
      color: var(--match);
    }
    .badge-mismatch {
      background: rgba(244, 63, 94, 0.15);
      color: var(--mismatch);
    }
    .copy-btn {
      background: transparent;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      border-radius: 4px;
      padding: 0.2rem 0.5rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .copy-btn:hover {
      color: var(--text);
      border-color: var(--text-muted);
    }
    .suggestion-summary {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status-tag">404 Not Found</div>
      <h1>Cannot ${escapeHtml(context.method)} <span class="code-badge">${escapeHtml(context.path)}</span></h1>
      <p class="requested-info">No endpoint matched your request.</p>
    </div>

    ${
      context.suggestions.length > 0
        ? `<div class="section-title">✨ Did you mean?</div>
           <div class="suggestions-list">${suggestionsHtml}</div>`
        : `<p class="requested-info">No similar routes discovered.</p>`
    }

    <div class="footer">
      Powered by <strong>nestjs-did-you-mean</strong>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Resolves content type and response body based on options and request headers.
 */
export function resolveFormattedResponse(
  context: FormatContext,
  formatOption: DidYouMeanModuleOptions['format'] = 'auto',
): { contentType: string; body: any } {
  if (typeof formatOption === 'function') {
    const customResult = formatOption(context);
    const isHtml =
      typeof customResult === 'string' &&
      (customResult.trim().startsWith('<!DOCTYPE') || customResult.trim().startsWith('<html'));
    return {
      contentType: isHtml ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
      body: customResult,
    };
  }

  if (formatOption === 'html') {
    return {
      contentType: 'text/html; charset=utf-8',
      body: formatHtmlResponse(context),
    };
  }

  if (formatOption === 'json') {
    return {
      contentType: 'application/json; charset=utf-8',
      body: formatJsonResponse(context),
    };
  }

  // 'auto': Content negotiation based on Accept header
  const req = context.req;
  const acceptHeader =
    req?.headers?.accept || req?.headers?.['accept'] || (typeof req?.get === 'function' ? req.get('accept') : '');

  if (typeof acceptHeader === 'string' && acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')) {
    return {
      contentType: 'text/html; charset=utf-8',
      body: formatHtmlResponse(context),
    };
  }

  return {
    contentType: 'application/json; charset=utf-8',
    body: formatJsonResponse(context),
  };
}
