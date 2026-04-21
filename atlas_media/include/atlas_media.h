#ifndef ATLAS_MEDIA_H
#define ATLAS_MEDIA_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define ATLAS_MEDIA_VERSION_MAJOR 0
#define ATLAS_MEDIA_VERSION_MINOR 1
#define ATLAS_MEDIA_VERSION_PATCH 0
#define ATLAS_MEDIA_VERSION_STRING "0.1.0"

#if defined(_WIN32) || defined(__CYGWIN__)
  #if defined(ATLAS_MEDIA_BUILD_SHARED)
    #define ATLAS_MEDIA_API __declspec(dllexport)
  #elif defined(ATLAS_MEDIA_USE_SHARED)
    #define ATLAS_MEDIA_API __declspec(dllimport)
  #else
    #define ATLAS_MEDIA_API
  #endif
#else
  #if defined(__GNUC__) && __GNUC__ >= 4
    #define ATLAS_MEDIA_API __attribute__((visibility("default")))
  #else
    #define ATLAS_MEDIA_API
  #endif
#endif

typedef enum atlas_media_status {
  ATLAS_MEDIA_STATUS_OK = 0,
  ATLAS_MEDIA_STATUS_INVALID_ARGUMENT = 1,
  ATLAS_MEDIA_STATUS_IO_ERROR = 2,
  ATLAS_MEDIA_STATUS_OUT_OF_MEMORY = 3,
  ATLAS_MEDIA_STATUS_NOT_SUPPORTED = 4,
  ATLAS_MEDIA_STATUS_NOT_IMPLEMENTED = 5,
  ATLAS_MEDIA_STATUS_INTERNAL_ERROR = 6
} atlas_media_status;

typedef enum atlas_media_image_format {
  ATLAS_MEDIA_IMAGE_FORMAT_UNKNOWN = 0,
  ATLAS_MEDIA_IMAGE_FORMAT_JPEG = 1,
  ATLAS_MEDIA_IMAGE_FORMAT_PNG = 2,
  ATLAS_MEDIA_IMAGE_FORMAT_GIF = 3,
  ATLAS_MEDIA_IMAGE_FORMAT_WEBP = 4
} atlas_media_image_format;

typedef struct atlas_media_byte_span {
  const uint8_t *data;
  size_t length;
} atlas_media_byte_span;

typedef struct atlas_media_mutable_byte_span {
  uint8_t *data;
  size_t length;
} atlas_media_mutable_byte_span;

typedef struct atlas_media_image_info {
  atlas_media_image_format format;
  uint32_t width;
  uint32_t height;
  uint16_t orientation;
  uint8_t channels;
} atlas_media_image_info;

ATLAS_MEDIA_API const char *atlas_media_version_string(void);
ATLAS_MEDIA_API int atlas_media_version_major(void);
ATLAS_MEDIA_API int atlas_media_version_minor(void);
ATLAS_MEDIA_API int atlas_media_version_patch(void);
ATLAS_MEDIA_API const char *atlas_media_status_string(atlas_media_status status);

#ifdef __cplusplus
}
#endif

#endif
