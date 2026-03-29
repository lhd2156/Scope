const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

const axiosPutMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');

  return {
    ...actual,
    default: {
      ...actual.default,
      put: axiosPutMock,
    },
  };
});

describe('API service fallbacks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    axiosPutMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a demo auth payload when login is still mocked', async () => {
    apiMock.post.mockRejectedValue(new Error('network down'));

    const authService = await import('@/services/authService');
    const payload = await authService.login({
      email: 'maya@example.com',
      password: 'SecurePass123!',
    });

    expect(payload.email).toBe('maya@example.com');
    expect(payload.accessToken).toContain('demo-token');
    expect(payload.refreshToken).toBeTruthy();
  });

  it('falls back to local spot search for geocoding', async () => {
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Botanic River Walk', 3);

    expect(response.data[0]).toMatchObject({
      placeName: 'Botanic River Walk',
      city: 'Fort Worth',
    });
  });

  it('builds a local presigned target and short-circuits blob uploads', async () => {
    apiMock.get.mockRejectedValue(new Error('s3 unavailable'));
    const createObjectURL = vi.fn(() => 'blob:atlas-upload');
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });

    const s3Service = await import('@/services/s3Service');
    const target = await s3Service.getPresignedUploadTarget({
      fileName: 'cover-photo.webp',
      contentType: 'image/webp',
      sizeBytes: 1024,
    });
    const fileUrl = await s3Service.uploadFileToPresignedTarget(target, new Blob(['atlas']));

    expect(target.uploadUrl).toBe('blob:atlas-upload');
    expect(fileUrl).toBe('blob:atlas-upload');
    expect(axiosPutMock).not.toHaveBeenCalled();
  });

  it('returns mock vibe matches while the intel API is offline', async () => {
    apiMock.post.mockRejectedValue(new Error('intel unavailable'));

    const intelService = await import('@/services/intelService');
    const response = await intelService.vibeMatch({
      vibe: 'electric',
      limit: 2,
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]?.title).toBe('Sunset Rooftop Tacos');
  });

  it('sanitizes notification payloads received from the API before display', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'notification-xss',
            title: '  Trip <b>member</b> joined\u0000 ',
            body: ' Hello\u0000 traveler\n\n\nSee you soon ',
            isRead: false,
            createdAt: '2026-03-27T03:00:00Z',
            type: ' trip.member.added ',
          },
        ],
        meta: {
          page: 1,
          pageSize: 1,
          total: 1,
          totalPages: 1,
        },
      },
    });

    const feedService = await import('@/services/feedService');
    const response = await feedService.getNotifications(1, 1);

    expect(response.data[0]).toMatchObject({
      title: 'Trip <b>member</b> joined',
      body: 'Hello traveler\n\nSee you soon',
      type: 'trip.member.added',
    });
  });
});
