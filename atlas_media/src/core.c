#include "atlas_media.h"

ATLAS_MEDIA_API const char *atlas_media_version_string(void)
{
  return ATLAS_MEDIA_VERSION_STRING;
}

ATLAS_MEDIA_API int atlas_media_version_major(void)
{
  return ATLAS_MEDIA_VERSION_MAJOR;
}

ATLAS_MEDIA_API int atlas_media_version_minor(void)
{
  return ATLAS_MEDIA_VERSION_MINOR;
}

ATLAS_MEDIA_API int atlas_media_version_patch(void)
{
  return ATLAS_MEDIA_VERSION_PATCH;
}

ATLAS_MEDIA_API const char *atlas_media_status_string(atlas_media_status status)
{
  switch (status) {
    case ATLAS_MEDIA_STATUS_OK:
      return "ok";
    case ATLAS_MEDIA_STATUS_INVALID_ARGUMENT:
      return "invalid_argument";
    case ATLAS_MEDIA_STATUS_IO_ERROR:
      return "io_error";
    case ATLAS_MEDIA_STATUS_OUT_OF_MEMORY:
      return "out_of_memory";
    case ATLAS_MEDIA_STATUS_NOT_SUPPORTED:
      return "not_supported";
    case ATLAS_MEDIA_STATUS_NOT_IMPLEMENTED:
      return "not_implemented";
    case ATLAS_MEDIA_STATUS_INTERNAL_ERROR:
      return "internal_error";
    default:
      return "unknown_status";
  }
}
