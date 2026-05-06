#ifndef SCOPE_MEDIA_H
#define SCOPE_MEDIA_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(_WIN32) || defined(__CYGWIN__)
    #ifdef SCOPE_MEDIA_BUILD
        #define SCOPE_MEDIA_API __declspec(dllexport)
    #else
        #define SCOPE_MEDIA_API __declspec(dllimport)
    #endif
#else
    #define SCOPE_MEDIA_API
#endif

#define SCOPE_MEDIA_VERSION_MAJOR 0
#define SCOPE_MEDIA_VERSION_MINOR 1
#define SCOPE_MEDIA_VERSION_PATCH 0

typedef enum scope_media_status {
    SCOPE_MEDIA_STATUS_OK = 0,
    SCOPE_MEDIA_STATUS_INVALID_ARGUMENT = 1,
    SCOPE_MEDIA_STATUS_UNSUPPORTED_FORMAT = 2,
    SCOPE_MEDIA_STATUS_DECODE_ERROR = 3,
    SCOPE_MEDIA_STATUS_IO_ERROR = 4,
    SCOPE_MEDIA_STATUS_NO_MEMORY = 5,
    SCOPE_MEDIA_STATUS_NOT_IMPLEMENTED = 6
} scope_media_status;

typedef enum scope_media_format {
    SCOPE_MEDIA_FORMAT_UNKNOWN = 0,
    SCOPE_MEDIA_FORMAT_JPEG = 1,
    SCOPE_MEDIA_FORMAT_PNG = 2,
    SCOPE_MEDIA_FORMAT_GIF = 3,
    SCOPE_MEDIA_FORMAT_WEBP = 4
} scope_media_format;

typedef struct scope_media_buffer {
    uint8_t *data;
    size_t length;
} scope_media_buffer;

typedef struct scope_media_image {
    uint32_t width;
    uint32_t height;
    uint8_t channels;
    uint8_t *pixels;
    size_t length;
} scope_media_image;

typedef struct scope_media_thumbnail_options {
    uint32_t max_width;
    uint32_t max_height;
    uint8_t channels;
} scope_media_thumbnail_options;

SCOPE_MEDIA_API const char *scope_media_version(void);
SCOPE_MEDIA_API const char *scope_media_status_name(scope_media_status status);
SCOPE_MEDIA_API scope_media_status scope_media_detect_format(const uint8_t *data, size_t length, scope_media_format *format);
SCOPE_MEDIA_API scope_media_status scope_media_strip_exif(const uint8_t *input, size_t input_length, scope_media_buffer *output);
SCOPE_MEDIA_API scope_media_status scope_media_generate_thumbnail(
    const scope_media_image *input,
    const scope_media_thumbnail_options *options,
    scope_media_image *output
);
SCOPE_MEDIA_API scope_media_status scope_media_encode_blurhash(
    const scope_media_image *input,
    uint32_t components_x,
    uint32_t components_y,
    char *output,
    size_t output_length
);
SCOPE_MEDIA_API void scope_media_free_buffer(scope_media_buffer *buffer);
SCOPE_MEDIA_API void scope_media_free_image(scope_media_image *image);

#ifdef __cplusplus
}
#endif

#endif
