#include "scope_media.h"

#include <stddef.h>
#include <string.h>

static int scope_media_matches_magic(const uint8_t *data, size_t length, const uint8_t *magic, size_t magic_length) {
    return data != NULL && magic != NULL && length >= magic_length && memcmp(data, magic, magic_length) == 0;
}

SCOPE_MEDIA_API scope_media_status scope_media_detect_format(
    const uint8_t *data,
    size_t length,
    scope_media_format *format
) {
    static const uint8_t jpeg_magic[] = {0xFF, 0xD8, 0xFF};
    static const uint8_t png_magic[] = {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    static const uint8_t riff_magic[] = {'R', 'I', 'F', 'F'};
    static const uint8_t webp_magic[] = {'W', 'E', 'B', 'P'};

    if (data == NULL || length == 0 || format == NULL) {
        return SCOPE_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    *format = SCOPE_MEDIA_FORMAT_UNKNOWN;

    if (scope_media_matches_magic(data, length, jpeg_magic, sizeof(jpeg_magic))) {
        *format = SCOPE_MEDIA_FORMAT_JPEG;
        return SCOPE_MEDIA_STATUS_OK;
    }

    if (scope_media_matches_magic(data, length, png_magic, sizeof(png_magic))) {
        *format = SCOPE_MEDIA_FORMAT_PNG;
        return SCOPE_MEDIA_STATUS_OK;
    }

    if (scope_media_matches_magic(data, length, (const uint8_t *)"GIF87a", 6)
        || scope_media_matches_magic(data, length, (const uint8_t *)"GIF89a", 6)) {
        *format = SCOPE_MEDIA_FORMAT_GIF;
        return SCOPE_MEDIA_STATUS_OK;
    }

    if (length >= 12 && scope_media_matches_magic(data, length, riff_magic, sizeof(riff_magic))
        && memcmp(data + 8, webp_magic, sizeof(webp_magic)) == 0) {
        *format = SCOPE_MEDIA_FORMAT_WEBP;
        return SCOPE_MEDIA_STATUS_OK;
    }

    return SCOPE_MEDIA_STATUS_UNSUPPORTED_FORMAT;
}
