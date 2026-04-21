#include "atlas_media.h"

#include <assert.h>
#include <string.h>

int main(void)
{
  assert(atlas_media_version_major() == ATLAS_MEDIA_VERSION_MAJOR);
  assert(atlas_media_version_minor() == ATLAS_MEDIA_VERSION_MINOR);
  assert(atlas_media_version_patch() == ATLAS_MEDIA_VERSION_PATCH);
  assert(strcmp(atlas_media_version_string(), ATLAS_MEDIA_VERSION_STRING) == 0);
  assert(strcmp(atlas_media_status_string(ATLAS_MEDIA_STATUS_OK), "ok") == 0);
  assert(strcmp(atlas_media_status_string(ATLAS_MEDIA_STATUS_NOT_IMPLEMENTED), "not_implemented") == 0);

  return 0;
}
