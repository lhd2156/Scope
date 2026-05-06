<template>
  <div class="avatar" :class="{ 'avatar--placeholder': isPlaceholder }" :style="avatarStyle" role="img" :aria-label="label ?? name">
    <LazyImage
      v-if="hasImage && !failed"
      :src="imageSource"
      eager
      alt=""
      aria-hidden="true"
      @error="onImageError"
    />
    <ScopeIcon v-else class="avatar__silhouette" name="user" label="Default profile picture" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';

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
  () => [props.src, props.name, props.size] as const,
  () => {
    failed.value = false;
  },
);

const imageSource = computed(() => props.src?.trim() ?? '');
const hasImage = computed(() => imageSource.value.length > 0);
const isPlaceholder = computed(() => !hasImage.value || failed.value);
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
  position: relative;
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

/*
  Instagram-style neutral placeholder: a flat gray disc with a white
  silhouette. Used when no avatar URL has been set (or the image failed
  to load) so new accounts never show a seeded face that isn't theirs.
*/
.avatar--placeholder {
  background: color-mix(in srgb, var(--bg-tertiary) 82%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--text-secondary) 22%, transparent);
  color: color-mix(in srgb, var(--text-secondary) 92%, var(--text-primary));
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar__silhouette {
  width: 68%;
  height: 68%;
  stroke-width: 1.6;
}
</style>
