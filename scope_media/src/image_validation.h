#ifndef SCOPE_MEDIA_IMAGE_VALIDATION_H
#define SCOPE_MEDIA_IMAGE_VALIDATION_H

#include "scope_media.h"

static int scope_media_validate_image(const scope_media_image *image) {
    size_t pixel_count;
    size_t expected_length;

    if (image == NULL || image->pixels == NULL || image->width == 0 || image->height == 0 || image->channels == 0) {
        return 0;
    }

    if (image->channels > 4) {
        return 0;
    }

    if ((size_t)image->width > (SIZE_MAX / (size_t)image->height)) {
        return 0;
    }

    pixel_count = (size_t)image->width * (size_t)image->height;
    if (pixel_count == 0 || pixel_count > (SIZE_MAX / (size_t)image->channels)) {
        return 0;
    }

    expected_length = pixel_count * (size_t)image->channels;
    return image->length >= expected_length;
}

#endif
