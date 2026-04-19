#ifndef ATLAS_MEDIA_H
#define ATLAS_MEDIA_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(_WIN32) || defined(__CYGWIN__)
    #ifdef ATLAS_MEDIA_BUILD
        #define ATLAS_MEDIA_API __declspec(dllexport)
    #else
        #define ATLAS_MEDIA_API __declspec(dllimport)
    #endif
#else
    #define ATLAS_MEDIA_API
#endif

#define ATLAS_MEDIA_VERSION_MAJOR 0
#define ATLAS_MEDIA_VERSION_MINOR 1
#define ATLAS_MEDIA_VERSION_PATCH 0

typedef enum atlas_media_status {
    ATLAS_MEDIA_STATUS_OK = 0,
    ATLAS_MEDIA_STATUS_INVALID_ARGUMENT = 1,
    ATLAS_MEDIA_STATUS_UNSUPPORTED_FORMAT = 2,
    ATLAS_MEDIA_STATUS_DECODE_ERROR = 3,
    ATLAS_MEDIA_STATUS_IO_ERROR = 4,
    ATLAS_MEDIA_STATUS_NO_MEMORY = 5,
    ATLAS_MEDIA_STATUS_NOT_IMPLEMENTED = 6
} atlas_media_status;

typedef enum atlas_media_format {
    ATLAS_MEDIA_FORMAT_UNKNOWN = 0,
    ATLAS_MEDIA_FORMAT_JPEG = 1,
    ATLAS_MEDIA_FORMAT_PNG = 2,
    ATLAS_MEDIA_FORMAT_GIF = 3,
    ATLAS_MEDIA_FORMAT_WEBP = 4
} atlas_media_format;

typedef struct atlas_media_buffer {
    uint8_t *data;
    size_t length;
} atlas_media_buffer;

typedef struct atlas_media_image {
    uint32_t width;
    uint32_t height;
    uint8_t channels;
    uint8_t *pixels;
    size_t length;
} atlas_media_image;

typedef struct atlas_media_thumbnail_options {
    uint32_t max_width;
    uint32_t max_height;
    uint8_t channels;
} atlas_media_thumbnail_options;

ATLAS_MEDIA_API const char *atlas_media_version(void);
ATLAS_MEDIA_API const char *atlas_media_status_name(atlas_media_status status);
ATLAS_MEDIA_API atlas_media_status atlas_media_detect_format(const uint8_t *data, size_t length, atlas_media_format *format);
ATLAS_MEDIA_API atlas_media_status atlas_media_strip_exif(const uint8_t *input, size_t input_length, atlas_media_buffer *output);
ATLAS_MEDIA_API atlas_media_status atlas_media_generate_thumbnail(
    const atlas_media_image *input,
    const atlas_media_thumbnail_options *options,
    atlas_media_image *output
);
ATLAS_MEDIA_API atlas_media_status atlas_media_encode_blurhash(
    const atlas_media_image *input,
    uint32_t components_x,
    uint32_t components_y,
    char *output,
    size_t output_length
);
ATLAS_MEDIA_API void atlas_media_free_buffer(atlas_media_buffer *buffer);
ATLAS_MEDIA_API void atlas_media_free_image(atlas_media_image *image);

#ifdef __cplusplus
}
#endif

#endif
