describe('trusted HTML utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns plain strings when Trusted Types are not available', async () => {
    const { installTrustedTypesDefaultPolicy, toTrustedHtml, toTrustedSanitizedHtml } = await import('@/utils/trustedHtml');

    expect(() => installTrustedTypesDefaultPolicy()).not.toThrow();
    expect(toTrustedHtml(null)).toBe('');
    expect(toTrustedHtml('<strong>scope</strong>')).toBe('&lt;strong&gt;scope&lt;/strong&gt;');
    expect(toTrustedSanitizedHtml('<strong>scope</strong>')).toBe('<strong>scope</strong>');
    expect(toTrustedSanitizedHtml('<mark onclick="alert(1)">scope</mark><img src=x onerror=alert(1)>'))
      .toBe('&lt;mark onclick=&quot;alert(1)&quot;&gt;scope</mark>&lt;img src=x onerror=alert(1)&gt;');
  });

  it('installs the default policy once and reuses the scope HTML policy', async () => {
    type PolicyRules = {
      createHTML: (input: string) => string;
      createScript?: (input: string) => string;
    };
    const policies = new Map<string, { createHTML: (input: string) => string; createScript?: (input: string) => string }>();
    const trustedTypes = {
      createPolicy: vi.fn((name: string, policy: PolicyRules) => {
        if (policies.has(name)) {
          throw new Error('duplicate policy');
        }

        const createdPolicy = {
          createHTML: vi.fn((input: string) => `trusted:${policy.createHTML(input)}`),
          ...(policy.createScript
            ? { createScript: vi.fn((input: string) => `trusted-script:${policy.createScript?.(input)}`) }
            : {}),
        };
        policies.set(name, createdPolicy);
        return createdPolicy;
      }),
    };
    vi.stubGlobal('window', {
      ...window,
      trustedTypes,
    });

    const { installTrustedTypesDefaultPolicy, toTrustedHtml, toTrustedSanitizedHtml } = await import('@/utils/trustedHtml');

    installTrustedTypesDefaultPolicy();
    installTrustedTypesDefaultPolicy();

    expect(trustedTypes.createPolicy).toHaveBeenCalledTimes(1);
    expect(trustedTypes.createPolicy).toHaveBeenCalledWith('default', expect.objectContaining({
      createHTML: expect.any(Function),
      createScript: expect.any(Function),
    }));
    const defaultPolicyRules = trustedTypes.createPolicy.mock.calls[0]?.[1];
    expect(defaultPolicyRules?.createHTML('<scope-default>')).toBe('&lt;scope-default&gt;');
    expect(defaultPolicyRules?.createScript?.('/wasm/dist/scope_wasm.js')).toBe('/wasm/dist/scope_wasm.js');
    expect(defaultPolicyRules?.createScript?.('/wasm/dist/scope_wasm.generated.js')).toBe('/wasm/dist/scope_wasm.generated.js');
    expect(defaultPolicyRules?.createScript?.(`${globalThis.location.origin}/wasm/dist/scope_wasm.js`))
      .toBe(`${globalThis.location.origin}/wasm/dist/scope_wasm.js`);
    expect(() => defaultPolicyRules?.createScript?.('https://example.com/wasm/dist/scope_wasm.js')).toThrow(TypeError);
    expect(() => defaultPolicyRules?.createScript?.('/wasm/dist/scope_wasm.js.evil')).toThrow(TypeError);

    expect(toTrustedHtml('<p>first</p>')).toBe('trusted:&lt;p&gt;first&lt;/p&gt;');
    expect(toTrustedSanitizedHtml('<p>second</p>')).toBe('trusted:<p>second</p>');
    expect(toTrustedSanitizedHtml('<script>alert(1)</script><br />')).toBe('trusted:&lt;script&gt;alert(1)&lt;/script&gt;<br>');
    expect(trustedTypes.createPolicy).toHaveBeenCalledTimes(2);
  });

  it('falls back to the original value when policy creation fails', async () => {
    vi.stubGlobal('window', {
      ...window,
      trustedTypes: {
        createPolicy: vi.fn(() => {
          throw new Error('policy blocked');
        }),
      },
    });

    const { installTrustedTypesDefaultPolicy, toTrustedHtml, toTrustedSanitizedHtml } = await import('@/utils/trustedHtml');

    expect(() => installTrustedTypesDefaultPolicy()).not.toThrow();
    expect(toTrustedHtml('<em>fallback</em>')).toBe('&lt;em&gt;fallback&lt;/em&gt;');
    expect(toTrustedSanitizedHtml('<em>fallback</em>')).toBe('&lt;em&gt;fallback&lt;/em&gt;');
  });
});
