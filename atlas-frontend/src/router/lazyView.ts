import { defineAsyncComponent, type Component } from 'vue';
import RouteViewLoader from '@/components/common/RouteViewLoader.vue';

type AsyncViewModule = { default: Component };
type AsyncViewLoader = () => Promise<AsyncViewModule>;

const ASYNC_VIEW_DELAY_MS = 120;
const ASYNC_VIEW_TIMEOUT_MS = 20000;
const MAX_CHUNK_RETRIES = 2;

function isRetryableChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('fetch') || message.includes('import') || message.includes('chunk');
}

export function lazyView(loader: AsyncViewLoader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: RouteViewLoader,
    delay: ASYNC_VIEW_DELAY_MS,
    timeout: ASYNC_VIEW_TIMEOUT_MS,
    suspensible: false,
    onError(error, retry, fail, attempts) {
      if (isRetryableChunkError(error) && attempts <= MAX_CHUNK_RETRIES) {
        retry();
        return;
      }

      fail();
    },
  });
}
