<template>
  <div class="avatar" :style="avatarStyle" :aria-label="label ?? name">
    <LazyImage v-if="imageSource" :src="imageSource" :alt="label ?? name" @error="onImageError" />
    <span v-else>{{ initials }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LazyImage from '@/components/common/LazyImage.vue';
import { getInitials } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    name: string;
    src?: string;
    label?: string;
    size?: number;
  }>(),
  {
    src: undefined,
    label: undefined,
    size: 48,
  },
);

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const initials = computed(() => getInitials(props.name));
const imageSource = computed(() => (props.src && !failed.value ? props.src : undefined));
const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  minWidth: `${props.size}px`,
  minHeight: `${props.size}px`,
}));

function onImageError() {
  failed.value = true;
}
</script>

<style scoped>
.avatar {
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background:
    radial-gradient(circle at top, var(--accent-gold-light), transparent 55%),
    linear-gradient(135deg, var(--accent-teal-light), var(--bg-tertiary));
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-sm);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

span {
  font-size: var(--font-size-small);
  letter-spacing: 0.08em;
}
</style>
