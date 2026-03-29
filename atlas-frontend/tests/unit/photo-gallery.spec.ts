import { mount } from '@vue/test-utils';
import PhotoGallery from '@/components/spots/PhotoGallery.vue';
import type { PhotoGalleryItem } from '@/types';

const photos: PhotoGalleryItem[] = [
  {
    id: 'photo-1',
    url: 'https://images.example.com/spot.jpg',
    caption: 'Golden hour hero shot',
    source: 'upload',
    meta: '1.2 MB · WEBP',
  },
];

describe('PhotoGallery', () => {
  it('supports editable captions and remove actions for uploads', async () => {
    const wrapper = mount(PhotoGallery, {
      props: {
        photos,
        removable: true,
        captionEditable: true,
      },
    });

    await wrapper.find('input').setValue('Updated caption');
    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('update:caption')?.[0]?.[0]).toEqual({
      id: 'photo-1',
      source: 'upload',
      caption: 'Updated caption',
    });
    expect(wrapper.emitted('remove')?.[0]?.[0]).toEqual({
      id: 'photo-1',
      source: 'upload',
    });
  });

  it('renders the empty state when no photos are available', () => {
    const wrapper = mount(PhotoGallery, {
      props: {
        photos: [],
        emptyTitle: 'No photos yet',
        emptyCopy: 'Upload a hero image to get started.',
      },
    });

    expect(wrapper.text()).toContain('No photos yet');
    expect(wrapper.text()).toContain('Upload a hero image to get started.');
  });
});
