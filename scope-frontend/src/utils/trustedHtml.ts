let scopeHtmlPolicy: TrustedTypePolicy | null = null;
let defaultPolicyAttempted = false;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function installTrustedTypesDefaultPolicy(): void {
  if (defaultPolicyAttempted || typeof window === 'undefined' || !window.trustedTypes) {
    return;
  }

  defaultPolicyAttempted = true;

  try {
    window.trustedTypes.createPolicy('default', {
      createHTML: (input) => escapeHtml(input),
    });
  } catch {
    // Browsers throw if another runtime already installed the default policy.
  }
}

export function toTrustedHtml(value: string | null | undefined): string {
  return toTrustedSanitizedHtml(escapeHtml(String(value ?? '')));
}

export function toTrustedSanitizedHtml(value: string | null | undefined): string {
  const html = String(value ?? '');
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
