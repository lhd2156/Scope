import type { SpotFormSubmission } from '@/types';

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
    vi.useRealTimers();
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

  it('builds, updates, filters, and previews demo spots and itineraries through sanitized helpers', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const {
      buildItineraryPreview,
      createMockSpot,
      filterSpots,
      getSpotById,
      getTripById,
      mockUsers,
      mockTrips,
      updateMockSpot,
    } = await import('@/services/mockData');

    const author = mockUsers[1]!;
    const submission: SpotFormSubmission = {
      spot: {
        title: '  Neon River Walk  ',
        description: '  Late-night route stop with a safe public promenade.  ',
        latitude: 32.777,
        longitude: -96.797,
        address: '  100 River St  ',
        city: 'Dallas',
        country: 'United States',
        category: 'scenic',
        pillars: ['photo-worthy', 'group-friendly'],
        vibe: 'river lights',
        rating: 4.6,
        visitedAt: '2026-05-01',
        isPublic: true,
      },
      existingPhotos: [],
      newPhotos: [
        {
          id: 'upload-1',
          file: new File(['demo'], 'river.jpg', { type: 'image/jpeg' }),
          previewUrl: 'https://images.example.com/river.jpg',
          caption: '  River lights  ',
          mimeType: 'image/jpeg',
          sizeBytes: 4,
        },
      ],
    };

    const created = createMockSpot(submission, author);
    expect(created).toMatchObject({
      title: 'Neon River Walk',
      city: 'Dallas',
      author: expect.objectContaining({ id: author.id }),
    });
    expect(getSpotById(created.id)?.photos[0]).toMatchObject({
      url: 'https://images.example.com/river.jpg',
      caption: 'River lights',
    });

    const updated = updateMockSpot(created.id, {
      ...submission,
      spot: {
        ...submission.spot,
        title: 'Neon River Garden',
        category: 'nature',
        vibe: 'quiet garden',
      },
      existingPhotos: created.photos,
      newPhotos: [],
    }, author);
    expect(updated).toMatchObject({
      id: created.id,
      title: 'Neon River Garden',
      category: 'nature',
    });
    await expect(() => updateMockSpot('missing-spot', submission, author)).toThrow('Spot missing-spot not found');

    const filtered = filterSpots({ category: 'nature', city: 'Dallas', vibe: 'garden' });
    expect(filtered.map((spot) => spot.id)).toContain(created.id);
    expect(getTripById(mockTrips[0]!.id)?.members.length).toBeGreaterThan(0);

    const preview = buildItineraryPreview({
      destination: 'Dallas, TX',
      endDestination: 'Austin, TX',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      budgetFloor: 250,
      budget: 900,
      interests: ['nature', 'food'],
      pace: 'packed',
      groupSize: 4,
    });
    expect(preview.destination).toBe('Dallas, TX to Austin, TX');
    expect(preview.days).toHaveLength(3);
    expect(preview.days.flatMap((day) => day.spots).length).toBeGreaterThanOrEqual(2);
    expect(preview.totalEstimatedCost).toBeGreaterThan(0);
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

  it('uses local demo auth flows for registration, refresh, logout, and Cognito entry', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));

    const authService = await import('@/services/authService');
    const registered = await authService.register({
      firstName: 'Demo',
      lastName: 'Traveler',
      username: '',
      email: 'demo.traveler@example.com',
      password: 'Scope2024!',
      confirmPassword: 'Scope2024!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    });
    const refreshed = await authService.refreshSession();
    const cognito = await authService.loginWithCognito('ignored-demo-token');
    await authService.logout('ignored-refresh-token');

    expect(registered).toMatchObject({
      username: 'demo-traveler',
      email: 'demo.traveler@example.com',
      displayName: 'Demo Traveler',
    });
    expect(refreshed.accessToken).toContain('demo-access-');
    expect(refreshed.accessToken).toContain(String(Date.parse('2026-05-20T12:00:00.000Z')));
    expect(cognito.email).toBe('demo@scope.travel');
    expect(apiMock.post).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
