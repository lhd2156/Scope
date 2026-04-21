<template>
  <section class="photo-gallery">
    <div v-if="photos.length" class="gallery-grid">
      <article v-for="photo in photos" :key="`${photo.source}-${photo.id}`" class="gallery-card surface-card">
        <div class="gallery-media">
          <button
            type="button"
            class="preview-button"
            :aria-label="`Open ${photo.caption || 'photo'} preview`"
            @click="selectedPhoto = photo"
          >
            <LazyImage :src="photo.url" :alt="photo.caption || 'Spot upload preview'" class="gallery-image" />
          </button>
          <button
            v-if="removable"
            type="button"
            class="remove-button"
            :aria-label="`Remove ${photo.caption || 'photo'}`"
            @click="$emit('remove', { id: photo.id, source: photo.source })"
          >
            <AtlasIcon name="trash" label="Remove photo" />
          </button>
        </div>

        <div class="gallery-copy">
          <label v-if="captionEditable" class="caption-field">
            <span>Caption</span>
            <input
              :value="photo.caption"
              type="text"
              maxlength="120"
              placeholder="Add a quick caption"
              @input="handleCaptionInput(photo, $event)"
            />
          </label>
          <p v-else class="caption-copy">{{ photo.caption || 'Community upload' }}</p>

          <div class="gallery-meta">
            <span class="meta-pill">{{ photo.source === 'upload' ? 'New upload' : 'Existing photo' }}</span>
            <span v-if="photo.meta" class="gallery-detail">{{ photo.meta }}</span>
          </div>
        </div>
      </article>
    </div>

    <article v-else class="empty-state surface-card">
      <AtlasIcon name="camera" label="Photo upload" />
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyCopy }}</p>
    </article>

    <Modal
      :open="Boolean(selectedPhoto)"
      title="Photo lightbox"
      eyebrow="Gallery preview"
      size="lg"
      @close="selectedPhoto = null"
    >
      <figure v-if="selectedPhoto" class="lightbox-figure">
        <LazyImage :src="selectedPhoto.url" :alt="selectedPhoto.caption || 'Spot photo preview'" class="lightbox-image" eager />
        <figcaption>
          <strong>{{ selectedPhoto.caption || 'Community upload' }}</strong>
          <span>{{ selectedPhoto.meta || (selectedPhoto.source === 'upload' ? 'New upload preview' : 'Existing gallery image') }}</span>
        </figcaption>
      </figure>
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import Modal from '@/components/common/Modal.vue';
import type { PhotoGalleryCaptionUpdate, PhotoGalleryItem } from '@/types';

withDefaults(
  defineProps<{
    photos: PhotoGalleryItem[];
    emptyTitle?: string;
    emptyCopy?: string;
    removable?: boolean;
    captionEditable?: boolean;
  }>(),
  {
    emptyTitle: 'No photos yet',
    emptyCopy: 'Upload a hero image, close-up, or alternate angle to give this pin context.',
    removable: false,
    captionEditable: false,
  },
);

const emit = defineEmits<{
  (event: 'remove', payload: { id: string; source: PhotoGalleryItem['source'] }): void;
  (event: 'update:caption', payload: PhotoGalleryCaptionUpdate): void;
}>();

const selectedPhoto = ref<PhotoGalleryItem | null>(null);

function handleCaptionInput(photo: PhotoGalleryItem, event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:caption', {
    id: photo.id,
    source: photo.source,
    caption: target.value,
  });
}
</script>

<style scoped>
.photo-gallery {
  display: grid;
  gap: var(--space-4);
}

.gallery-grid {
  column-gap: var(--space-4);
  columns: 3 14rem;
}

.gallery-card {
  break-inside: avoid;
  overflow: hidden;
  display: grid;
  margin-bottom: var(--space-4);
}

.gallery-media {
  position: relative;
  min-height: 11rem;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 40%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.preview-button {
  display: block;
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: zoom-in;
}

.gallery-image,
.preview-button {
  width: 100%;
  height: 100%;
}

.gallery-image {
  object-fit: cover;
}

.preview-button:hover .gallery-image,
.preview-button:focus-visible .gallery-image {
  transform: scale(1.015);
}

.preview-button:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: -2px;
}

.gallery-image {
  transition: transform var(--transition-normal);
}

.remove-button {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  color: var(--text-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.remove-button:hover,
.remove-button:focus-visible {
  transform: translateY(-0.0625rem);
  border-color: var(--danger);
  background: var(--bg-secondary);
  outline: none;
}

.remove-button :deep(.atlas-icon),
.empty-state :deep(.atlas-icon) {
  width: 1.15rem;
  height: 1.15rem;
}

.gallery-copy {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.caption-field {
  display: grid;
  gap: var(--space-2);
}

.caption-field span,
.caption-copy,
.gallery-detail,
.lightbox-figure figcaption span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.caption-copy,
.lightbox-figure figcaption strong,
.lightbox-figure figcaption span {
  display: block;
}

.caption-copy,
.lightbox-figure figcaption {
  margin: 0;
}

.caption-copy {
  line-height: var(--line-height-relaxed);
}

.caption-field input {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.75rem 0.9rem;
}

.caption-field input:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 1px;
}

.gallery-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.7rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.empty-state {
  min-height: 12rem;
  display: grid;
  place-items: center;
  gap: var(--space-2);
  padding: var(--space-5);
  text-align: center;
}

.empty-state strong {
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.empty-state :deep(.atlas-icon) {
  color: var(--accent-teal);
}

.lightbox-figure {
  display: grid;
  gap: var(--space-4);
}

.lightbox-image {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
}

.lightbox-figure figcaption {
  display: grid;
  gap: var(--space-2);
}

@media (max-width: 960px) {
  .gallery-grid {
    columns: 2 12rem;
  }
}

@media (max-width: 640px) {
  .gallery-grid {
    columns: 1;
  }
}
</style>
