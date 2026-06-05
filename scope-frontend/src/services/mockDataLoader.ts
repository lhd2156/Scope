type MockDataModule = typeof import('@/services/mockData');

const MOCK_DATA_ALLOWED_IN_BUILD = import.meta.env.MODE !== 'production' || import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === 'true';

export const loadMockData: () => Promise<MockDataModule> = MOCK_DATA_ALLOWED_IN_BUILD
  ? async () => import('@/services/mockData')
  : async () => {
    throw new Error('Local preview data is not available in this production build.');
  };
