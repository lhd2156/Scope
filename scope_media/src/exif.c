#include "scope_media.h"

#include <stdlib.h>
#include <string.h>

static uint16_t scope_media_read_u16_be(const uint8_t *value) {
    return (uint16_t)(((uint16_t)value[0] << 8) | (uint16_t)value[1]);
}

static scope_media_status scope_media_copy_buffer(
    const uint8_t *input,
    size_t input_length,
    scope_media_buffer *output
) {
    uint8_t *copy = (uint8_t *)malloc(input_length);

    if (copy == NULL) {
        return SCOPE_MEDIA_STATUS_NO_MEMORY;
    }

    memcpy(copy, input, input_length);
    output->data = copy;
    output->length = input_length;
    return SCOPE_MEDIA_STATUS_OK;
}

static int scope_media_is_exif_app1_segment(const uint8_t *payload, uint16_t segment_length) {
    static const uint8_t exif_magic[] = {'E', 'x', 'i', 'f', 0x00, 0x00};

    return payload != NULL
        && segment_length >= 8
        && memcmp(payload, exif_magic, sizeof(exif_magic)) == 0;
}

SCOPE_MEDIA_API scope_media_status scope_media_strip_exif(
    const uint8_t *input,
    size_t input_length,
    scope_media_buffer *output
) {
    scope_media_format format = SCOPE_MEDIA_FORMAT_UNKNOWN;
    scope_media_status detect_status;
    uint8_t *buffer = NULL;
    size_t read_offset = 0;
    size_t write_offset = 0;

    if (input == NULL || input_length == 0 || output == NULL) {
        return SCOPE_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    output->data = NULL;
    output->length = 0;

    detect_status = scope_media_detect_format(input, input_length, &format);
    if (detect_status != SCOPE_MEDIA_STATUS_OK) {
        return detect_status;
    }

    if (format != SCOPE_MEDIA_FORMAT_JPEG) {
        return scope_media_copy_buffer(input, input_length, output);
    }

    if (input_length < 4 || input[0] != 0xFF || input[1] != 0xD8) {
        return SCOPE_MEDIA_STATUS_DECODE_ERROR;
    }

    buffer = (uint8_t *)malloc(input_length);
    if (buffer == NULL) {
        return SCOPE_MEDIA_STATUS_NO_MEMORY;
    }

    buffer[0] = input[0];
    buffer[1] = input[1];
    write_offset = 2;
    read_offset = 2;

    while (read_offset < input_length) {
        uint8_t marker;
        uint16_t segment_length;
        size_t segment_total_length;

        if (input[read_offset] != 0xFF) {
            free(buffer);
            return SCOPE_MEDIA_STATUS_DECODE_ERROR;
        }

        if (read_offset + 1 >= input_length) {
            free(buffer);
            return SCOPE_MEDIA_STATUS_DECODE_ERROR;
        }

        marker = input[read_offset + 1];

        if (marker == 0xD9 || marker == 0xDA) {
            memcpy(buffer + write_offset, input + read_offset, input_length - read_offset);
            write_offset += input_length - read_offset;
            break;
        }

        if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
            memcpy(buffer + write_offset, input + read_offset, 2);
            write_offset += 2;
            read_offset += 2;
            continue;
        }

        if (read_offset + 4 > input_length) {
            free(buffer);
            return SCOPE_MEDIA_STATUS_DECODE_ERROR;
        }

        segment_length = scope_media_read_u16_be(input + read_offset + 2);
        if (segment_length < 2) {
            free(buffer);
            return SCOPE_MEDIA_STATUS_DECODE_ERROR;
        }

        segment_total_length = (size_t)segment_length + 2;
        if (read_offset + segment_total_length > input_length) {
            free(buffer);
            return SCOPE_MEDIA_STATUS_DECODE_ERROR;
        }

        if (marker == 0xE1 && scope_media_is_exif_app1_segment(input + read_offset + 4, segment_length)) {
            read_offset += segment_total_length;
            continue;
        }

        memcpy(buffer + write_offset, input + read_offset, segment_total_length);
        write_offset += segment_total_length;
        read_offset += segment_total_length;
    }

    output->data = buffer;
    output->length = write_offset;
    return SCOPE_MEDIA_STATUS_OK;
}
