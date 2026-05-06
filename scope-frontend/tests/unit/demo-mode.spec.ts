const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

describe('demo mode fixtures', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads the seeded demo fixture counts when VITE_DEMO_MODE is enabled', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const { mockUsers, mockSpots, mockTrips, mockFeed, mockNotifications, mockViewport } = await import('@/services/mockData');

    expect(mockUsers).toHaveLength(5);
    expect(mockSpots).toHaveLength(20);
    expect(mockTrips).toHaveLength(3);
    expect(mockFeed).toHaveLength(15);
    expect(mockNotifications).toHaveLength(10);
    expect(mockUsers[0]).toMatchObject({
      id: 'demo-user-1',
      email: 'demo@scope.travel',
    });
    expect(mockViewport.style).toBe('mapbox://styles/mapbox/dark-v11');
  });

  it('accepts only the shared demo credentials when VITE_DEMO_MODE is enabled', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const authService = await import('@/services/authService');

    await expect(
      authService.login({
        email: 'louis@example.com',
        password: 'SecurePass123!',
      }),
    ).rejects.toThrow('Use demo@scope.travel / Scope2024! to enter Scope demo mode.');

    const payload = await authService.login({
      email: ' demo@scope.travel ',
      password: 'Scope2024!',
    });

    expect(payload).toMatchObject({
      id: 'demo-user-1',
      email: 'demo@scope.travel',
    });
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
