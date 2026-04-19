#include "atlas_media.h"

#include <stdlib.h>
#include <string.h>

static int atlas_media_validate_image(const atlas_media_image *image) {
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

static atlas_media_status atlas_media_allocate_output(
    uint32_t width,
    uint32_t height,
    uint8_t channels,
    atlas_media_image *output
) {
    size_t pixel_count;
    size_t output_length;
    uint8_t *pixels;

    if ((size_t)width > (SIZE_MAX / (size_t)height)) {
        return ATLAS_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    pixel_count = (size_t)width * (size_t)height;
    if (pixel_count == 0 || pixel_count > (SIZE_MAX / (size_t)channels)) {
        return ATLAS_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    output_length = pixel_count * (size_t)channels;
    pixels = (uint8_t *)malloc(output_length);
    if (pixels == NULL) {
        return ATLAS_MEDIA_STATUS_NO_MEMORY;
    }

    output->width = width;
    output->height = height;
    output->channels = channels;
    output->pixels = pixels;
    output->length = output_length;
    return ATLAS_MEDIA_STATUS_OK;
}

static double atlas_media_clamp_double(double value, double minimum, double maximum) {
    if (value < minimum) {
        return minimum;
    }

    if (value > maximum) {
        return maximum;
    }

    return value;
}

static uint32_t atlas_media_round_dimension(double value) {
    uint32_t rounded = (uint32_t)(value + 0.5);
    return rounded == 0 ? 1u : rounded;
}

static void atlas_media_compute_thumbnail_size(
    const atlas_media_image *input,
    const atlas_media_thumbnail_options *options,
    uint32_t *target_width,
    uint32_t *target_height
) {
    double width_scale;
    double height_scale;
    double scale;

    if (input->width <= options->max_width && input->height <= options->max_height) {
        *target_width = input->width;
        *target_height = input->height;
        return;
    }

    width_scale = (double)options->max_width / (double)input->width;
    height_scale = (double)options->max_height / (double)input->height;
    scale = width_scale < height_scale ? width_scale : height_scale;

    if (scale > 1.0) {
        scale = 1.0;
    }

    *target_width = atlas_media_round_dimension((double)input->width * scale);
    *target_height = atlas_media_round_dimension((double)input->height * scale);

    if (*target_width > options->max_width) {
        *target_width = options->max_width;
    }

    if (*target_height > options->max_height) {
        *target_height = options->max_height;
    }
}

ATLAS_MEDIA_API atlas_media_status atlas_media_generate_thumbnail(
    const atlas_media_image *input,
    const atlas_media_thumbnail_options *options,
    atlas_media_image *output
) {
    uint8_t output_channels;
    uint32_t target_width;
    uint32_t target_height;
    atlas_media_status allocate_status;
    uint32_t y;

    if (!atlas_media_validate_image(input) || options == NULL || output == NULL
        || options->max_width == 0 || options->max_height == 0) {
        return ATLAS_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    output->width = 0;
    output->height = 0;
    output->channels = 0;
    output->pixels = NULL;
    output->length = 0;

    output_channels = options->channels == 0 ? input->channels : options->channels;
    if (output_channels != input->channels) {
        return ATLAS_MEDIA_STATUS_NOT_IMPLEMENTED;
    }

    atlas_media_compute_thumbnail_size(input, options, &target_width, &target_height);
    allocate_status = atlas_media_allocate_output(target_width, target_height, output_channels, output);
    if (allocate_status != ATLAS_MEDIA_STATUS_OK) {
        return allocate_status;
    }

    if (target_width == input->width && target_height == input->height) {
        memcpy(output->pixels, input->pixels, output->length);
        return ATLAS_MEDIA_STATUS_OK;
    }

    for (y = 0; y < target_height; ++y) {
        double source_y = (((double)y + 0.5) * (double)input->height / (double)target_height) - 0.5;
        size_t y0;
        size_t y1;
        double y_weight;
        uint32_t x;

        source_y = atlas_media_clamp_double(source_y, 0.0, (double)input->height - 1.0);
        y0 = (size_t)source_y;
        y1 = y0 + 1 < input->height ? y0 + 1 : y0;
        y_weight = source_y - (double)y0;

        for (x = 0; x < target_width; ++x) {
            double source_x = (((double)x + 0.5) * (double)input->width / (double)target_width) - 0.5;
            size_t x0;
            size_t x1;
            double x_weight;
            double inverse_x_weight;
            double inverse_y_weight;
            size_t channel_index;
            size_t output_offset;
            size_t top_left_offset;
            size_t top_right_offset;
            size_t bottom_left_offset;
            size_t bottom_right_offset;

            source_x = atlas_media_clamp_double(source_x, 0.0, (double)input->width - 1.0);
            x0 = (size_t)source_x;
            x1 = x0 + 1 < input->width ? x0 + 1 : x0;
            x_weight = source_x - (double)x0;
            inverse_x_weight = 1.0 - x_weight;
            inverse_y_weight = 1.0 - y_weight;

            output_offset = ((size_t)y * (size_t)target_width + (size_t)x) * (size_t)output_channels;
            top_left_offset = ((y0 * (size_t)input->width) + x0) * (size_t)output_channels;
            top_right_offset = ((y0 * (size_t)input->width) + x1) * (size_t)output_channels;
            bottom_left_offset = ((y1 * (size_t)input->width) + x0) * (size_t)output_channels;
            bottom_right_offset = ((y1 * (size_t)input->width) + x1) * (size_t)output_channels;

            for (channel_index = 0; channel_index < (size_t)output_channels; ++channel_index) {
                double value =
                    ((double)input->pixels[top_left_offset + channel_index] * inverse_x_weight * inverse_y_weight)
                    + ((double)input->pixels[top_right_offset + channel_index] * x_weight * inverse_y_weight)
                    + ((double)input->pixels[bottom_left_offset + channel_index] * inverse_x_weight * y_weight)
                    + ((double)input->pixels[bottom_right_offset + channel_index] * x_weight * y_weight);

                if (value < 0.0) {
                    value = 0.0;
                } else if (value > 255.0) {
                    value = 255.0;
                }

                output->pixels[output_offset + channel_index] = (uint8_t)(value + 0.5);
            }
        }
    }

    return ATLAS_MEDIA_STATUS_OK;
}
