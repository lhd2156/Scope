<template>
  <div class="avatar" :class="{ 'avatar--placeholder': isPlaceholder }" :style="avatarStyle" role="img" :aria-label="label ?? name">
    <img
      v-if="hasImage && !failed"
      class="avatar__image"
      :src="imageSource"
      :class="{ 'is-loaded': loaded }"
      loading="eager"
      decoding="async"
      alt=""
      aria-hidden="true"
      @load="onImageLoad"
      @error="onImageError"
    />
    <ScopeIcon
      v-if="isPlaceholder"
      class="avatar__placeholder-icon"
      name="user"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';

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
const loaded = ref(false);

watch(
  () => [props.src, props.name, props.size] as const,
  () => {
    failed.value = false;
    loaded.value = false;
  },
);

const imageSource = computed(() => props.src?.trim() ?? '');
const hasImage = computed(() => imageSource.value.length > 0);
const isPlaceholder = computed(() => !hasImage.value || failed.value || !loaded.value);
const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  minWidth: `${props.size}px`,
  minHeight: `${props.size}px`,
  fontSize: `${Math.max(13, Math.round(props.size * 0.34))}px`,
}));

function onImageError() {
  failed.value = true;
  loaded.value = false;
}

function onImageLoad() {
  loaded.value = true;
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

.avatar--placeholder {
  background:
    radial-gradient(circle at 30% 24%, color-mix(in srgb, var(--accent-gold) 26%, transparent), transparent 48%),
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 38%, var(--bg-tertiary)), var(--bg-secondary));
  border-color: color-mix(in srgb, var(--accent-teal) 34%, transparent);
  color: var(--text-primary);
}

.avatar__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.avatar__image.is-loaded {
  opacity: 1;
}

.avatar__placeholder-icon {
  width: 58%;
  height: 58%;
  color: var(--text-secondary);
}
</style>
