<template>
  <div
    ref="containerRef"
    class="virtual-list"
    :class="{ 'virtual-list--stagger': stagger }"
    :style="containerStyle"
    role="list"
    :aria-label="listLabel"
    @scroll="handleScroll"
  >
    <div class="virtual-list__spacer" :style="{ height: `${totalHeight}px` }" aria-hidden="true" />

    <div
      v-for="entry in visibleEntries"
      :key="getItemKey(entry.item, entry.index)"
      class="virtual-list__item"
      role="listitem"
      :style="{ transform: `translateY(${entry.top}px)`, height: `${itemHeight}px` }"
    >
      <div class="virtual-list__item-content">
        <slot :item="entry.item" :index="entry.index" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface VirtualEntry<T> {
  item: T;
  index: number;
  top: number;
}

const props = withDefaults(
  defineProps<{
    items: ReadonlyArray<unknown>;
    itemHeight: number;
    viewportHeight: number;
    overscan?: number;
    listLabel?: string;
    itemKey?: (item: unknown, index: number) => string | number;
    stagger?: boolean;
  }>(),
  {
    overscan: 3,
    listLabel: 'Virtualized Atlas list',
    itemKey: undefined,
    stagger: false,
  },
);

const containerRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);

const totalHeight = computed(() => props.items.length * props.itemHeight);
const containerStyle = computed(() => ({
  height: `${props.viewportHeight}px`,
}));
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan));
const visibleCount = computed(() => Math.ceil(props.viewportHeight / props.itemHeight) + props.overscan * 2);
const endIndex = computed(() => Math.min(props.items.length, startIndex.value + visibleCount.value));
const visibleEntries = computed<VirtualEntry<unknown>[]>(() => {
  const entries: VirtualEntry<unknown>[] = [];

  for (let index = startIndex.value; index < endIndex.value; index += 1) {
    entries.push({
      item: props.items[index],
      index,
      top: index * props.itemHeight,
    });
  }

  return entries;
});

function handleScroll() {
  scrollTop.value = containerRef.value?.scrollTop ?? 0;
}

function getItemKey(item: unknown, index: number): string | number {
  if (props.itemKey) {
    return props.itemKey(item, index);
  }

  if (typeof item === 'object' && item !== null && 'id' in item) {
    const id = (item as { id?: string | number }).id;
    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }
  }

  return index;
}

watch(
  () => props.items.length,
  () => {
    if (!containerRef.value) {
      scrollTop.value = 0;
      return;
    }

    const maxScrollTop = Math.max(0, totalHeight.value - props.viewportHeight);
    if (containerRef.value.scrollTop > maxScrollTop) {
      containerRef.value.scrollTop = maxScrollTop;
      scrollTop.value = maxScrollTop;
    }
  },
);
</script>

<style scoped>
.virtual-list {
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.virtual-list__spacer {
  width: 100%;
}

.virtual-list__item {
  position: absolute;
  inset-inline: 0;
  top: 0;
}

.virtual-list__item-content {
  height: 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .virtual-list--stagger .virtual-list__item-content {
    animation: fadeInUp 0.4s ease both;
  }

  .virtual-list--stagger .virtual-list__item:nth-child(1) .virtual-list__item-content {
    animation-delay: 0ms;
  }

  .virtual-list--stagger .virtual-list__item:nth-child(2) .virtual-list__item-content {
    animation-delay: 80ms;
  }

  .virtual-list--stagger .virtual-list__item:nth-child(3) .virtual-list__item-content {
    animation-delay: 160ms;
  }

  .virtual-list--stagger .virtual-list__item:nth-child(4) .virtual-list__item-content {
    animation-delay: 240ms;
  }
}

@media (prefers-reduced-motion: reduce) {
  .virtual-list--stagger .virtual-list__item-content {
    animation: none;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
