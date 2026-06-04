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
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('supports editable captions and remove actions for uploads', async () => {
    const wrapper = mount(PhotoGallery, {
      props: {
        photos,
        removable: true,
        captionEditable: true,
      },
      attachTo: document.body,
    });

    await wrapper.find('input').setValue('Updated caption');
    await wrapper.get('button[aria-label="Remove Golden hour hero shot"]').trigger('click');

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

  it('opens a lightbox preview for a gallery item', async () => {
    const wrapper = mount(PhotoGallery, {
      props: {
        photos,
      },
      attachTo: document.body,
    });

    await wrapper.get('button[aria-label="Open Golden hour hero shot preview"]').trigger('click');

    expect(document.body.textContent).toContain('Photo lightbox');
    expect(document.body.textContent).toContain('Golden hour hero shot');

    const closeButton = document.body.querySelector<HTMLButtonElement>('.modal-close');
    expect(closeButton).not.toBeNull();
    closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: 'Modal' }).props('open')).toBe(false);
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

  it('uses gallery fallbacks for existing photos without captions or metadata', async () => {
    const wrapper = mount(PhotoGallery, {
      props: {
        photos: [
          {
            id: 'photo-2',
            url: 'https://images.example.com/existing.jpg',
            source: 'existing',
          },
        ],
        removable: true,
      },
      attachTo: document.body,
    });

    expect(wrapper.text()).toContain('Community upload');
    expect(wrapper.text()).toContain('Existing photo');

    await wrapper.get('button[aria-label="Remove photo"]').trigger('click');
    expect(wrapper.emitted('remove')?.[0]?.[0]).toEqual({
      id: 'photo-2',
      source: 'existing',
    });

    await wrapper.get('button[aria-label="Open photo preview"]').trigger('click');
    expect(document.body.textContent).toContain('Existing gallery image');
  });
});
