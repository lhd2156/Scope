let scopeHtmlPolicy: TrustedTypePolicy | null = null;
let defaultPolicyAttempted = false;
const ALLOWED_HTML_TAGS = new Set(['p', '/p', 'br', 'strong', '/strong', 'mark', '/mark']);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function allowScopeWasmModuleScript(value: string): string {
  const origin = globalThis.location.origin;
  const moduleUrl = new URL(value, origin);
  const isAllowedModule = (
    moduleUrl.origin === origin
    && /\/wasm\/dist\/scope_wasm(?:\.generated)?\.js$/.test(moduleUrl.pathname)
  );

  if (!isAllowedModule) {
    throw new TypeError('Trusted script URL is not an allowed Scope WASM module.');
  }

  return value;
}

function sanitizeAllowedHtml(value: string): string {
  return value.replace(/<[^>]*>/g, (tag) => {
    const normalizedTag = tag
      .replace(/^<\s*/, '')
      .replace(/\s*\/?\s*>$/, '')
      .trim()
      .toLowerCase();

    if (ALLOWED_HTML_TAGS.has(normalizedTag)) {
      if (normalizedTag === 'br') {
        return '<br>';
      }

      return `<${normalizedTag}>`;
    }

    return escapeHtml(tag);
  });
}

export function installTrustedTypesDefaultPolicy(): void {
  if (defaultPolicyAttempted || typeof window === 'undefined' || !window.trustedTypes) {
    return;
  }

  defaultPolicyAttempted = true;

  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (input) => escapeHtml(input),
      createScript: (input) => allowScopeWasmModuleScript(input),
    });
  } catch {
    // Browsers throw if another runtime already installed the default policy.
  }
}

export function toTrustedHtml(value: string | null | undefined): string {
  return toTrustedSanitizedHtml(escapeHtml(String(value ?? '')));
}

export function toTrustedSanitizedHtml(value: string | null | undefined): string {
  const html = sanitizeAllowedHtml(String(value ?? ''));
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return html;
  }

  try {
    scopeHtmlPolicy ??= window.trustedTypes.createPolicy('scope-html', {
      createHTML: (input) => input,
    });
    return scopeHtmlPolicy.createHTML(html) as unknown as string;
  } catch {
    return html;
  }
}
