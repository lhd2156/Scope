#include "scope_media.h"

#include <stdlib.h>

const char *scope_media_version(void) {
    return "0.1.0";
}

const char *scope_media_status_name(scope_media_status status) {
    switch (status) {
        case SCOPE_MEDIA_STATUS_OK:
            return "ok";
        case SCOPE_MEDIA_STATUS_INVALID_ARGUMENT:
            return "invalid_argument";
        case SCOPE_MEDIA_STATUS_UNSUPPORTED_FORMAT:
            return "unsupported_format";
        case SCOPE_MEDIA_STATUS_DECODE_ERROR:
            return "decode_error";
        case SCOPE_MEDIA_STATUS_IO_ERROR:
            return "io_error";
        case SCOPE_MEDIA_STATUS_NO_MEMORY:
            return "no_memory";
        case SCOPE_MEDIA_STATUS_NOT_IMPLEMENTED:
            return "not_implemented";
        default:
            return "unknown_status";
    }
}

void scope_media_free_buffer(scope_media_buffer *buffer) {
    if (buffer == NULL || buffer->data == NULL) {
        return;
    }

    free(buffer->data);
    buffer->data = NULL;
    buffer->length = 0;
}

void scope_media_free_image(scope_media_image *image) {
    if (image == NULL || image->pixels == NULL) {
        return;
    }

    free(image->pixels);
    image->pixels = NULL;
    image->length = 0;
    image->width = 0;
    image->height = 0;
    image->channels = 0;
}
