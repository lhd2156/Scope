import type { Component } from 'vue';

type AsyncViewModule = { default: Component };
type AsyncViewLoader = () => Promise<AsyncViewModule>;

const MAX_CHUNK_RETRIES = 2;

function isRetryableChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('fetch') || message.includes('import') || message.includes('chunk');
}

async function loadWithRetry(loader: AsyncViewLoader, attempt = 0): Promise<AsyncViewModule> {
  try {
    return await loader();
  } catch (error) {
    if (isRetryableChunkError(error) && attempt < MAX_CHUNK_RETRIES) {
      return loadWithRetry(loader, attempt + 1);
    }

    throw error;
  }
}

// Returns a plain factory so Vue Router can resolve it natively
// without the `defineAsyncComponent` wrapper it warns about.
// Chunk-load retries are preserved for transient network/import failures.
export function lazyView(loader: AsyncViewLoader): AsyncViewLoader {
  return () => loadWithRetry(loader);
}
