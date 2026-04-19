#include "atlas_media.h"

#include <math.h>
#include <stddef.h>
#include <stdlib.h>

#define ATLAS_MEDIA_PI 3.14159265358979323846
#define ATLAS_MEDIA_BLURHASH_MAX_COMPONENTS 9u

static const char ATLAS_MEDIA_BASE83_ALPHABET[] =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

typedef struct atlas_media_linear_rgb {
    double red;
    double green;
    double blue;
} atlas_media_linear_rgb;

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

static double atlas_media_srgb_to_linear(uint8_t value) {
    double normalized = (double)value / 255.0;

    if (normalized <= 0.04045) {
        return normalized / 12.92;
    }

    return pow((normalized + 0.055) / 1.055, 2.4);
}

static uint8_t atlas_media_linear_to_srgb_u8(double value) {
    double clamped = value;

    if (clamped < 0.0) {
        clamped = 0.0;
    } else if (clamped > 1.0) {
        clamped = 1.0;
    }

    if (clamped <= 0.0031308) {
        return (uint8_t)(clamped * 12.92 * 255.0 + 0.5);
    }

    return (uint8_t)((1.055 * pow(clamped, 1.0 / 2.4) - 0.055) * 255.0 + 0.5);
}

static double atlas_media_sign_pow(double value, double exponent) {
    if (value < 0.0) {
        return -pow(-value, exponent);
    }

    return pow(value, exponent);
}

static uint32_t atlas_media_pow83(size_t exponent) {
    uint32_t value = 1u;
    size_t index;

    for (index = 0; index < exponent; ++index) {
        value *= 83u;
    }

    return value;
}

static void atlas_media_encode83(uint32_t value, size_t length, char *output) {
    size_t index;

    for (index = 0; index < length; ++index) {
        uint32_t divisor = atlas_media_pow83(length - index - 1u);
        uint32_t digit = (value / divisor) % 83u;
        output[index] = ATLAS_MEDIA_BASE83_ALPHABET[digit];
    }
}

static void atlas_media_load_linear_rgb(
    const atlas_media_image *image,
    size_t pixel_offset,
    atlas_media_linear_rgb *pixel
) {
    double alpha;
    double inverse_alpha;
    double gray;

    switch (image->channels) {
        case 1:
            gray = atlas_media_srgb_to_linear(image->pixels[pixel_offset]);
            pixel->red = gray;
            pixel->green = gray;
            pixel->blue = gray;
            return;
        case 2:
            gray = atlas_media_srgb_to_linear(image->pixels[pixel_offset]);
            alpha = (double)image->pixels[pixel_offset + 1u] / 255.0;
            inverse_alpha = 1.0 - alpha;
            pixel->red = (gray * alpha) + inverse_alpha;
            pixel->green = (gray * alpha) + inverse_alpha;
            pixel->blue = (gray * alpha) + inverse_alpha;
            return;
        case 3:
            pixel->red = atlas_media_srgb_to_linear(image->pixels[pixel_offset]);
            pixel->green = atlas_media_srgb_to_linear(image->pixels[pixel_offset + 1u]);
            pixel->blue = atlas_media_srgb_to_linear(image->pixels[pixel_offset + 2u]);
            return;
        case 4:
            alpha = (double)image->pixels[pixel_offset + 3u] / 255.0;
            inverse_alpha = 1.0 - alpha;
            pixel->red = (atlas_media_srgb_to_linear(image->pixels[pixel_offset]) * alpha) + inverse_alpha;
            pixel->green = (atlas_media_srgb_to_linear(image->pixels[pixel_offset + 1u]) * alpha) + inverse_alpha;
            pixel->blue = (atlas_media_srgb_to_linear(image->pixels[pixel_offset + 2u]) * alpha) + inverse_alpha;
            return;
        default:
            pixel->red = 0.0;
            pixel->green = 0.0;
            pixel->blue = 0.0;
            return;
    }
}

static atlas_media_linear_rgb atlas_media_multiply_basis_function(
    const atlas_media_image *image,
    uint32_t component_x,
    uint32_t component_y
) {
    atlas_media_linear_rgb factor = {0.0, 0.0, 0.0};
    double normalization = (component_x == 0u && component_y == 0u) ? 1.0 : 2.0;
    uint32_t y;

    for (y = 0; y < image->height; ++y) {
        double basis_y = cos((ATLAS_MEDIA_PI * (double)component_y * (double)y) / (double)image->height);
        uint32_t x;

        for (x = 0; x < image->width; ++x) {
            size_t pixel_offset = (((size_t)y * (size_t)image->width) + (size_t)x) * (size_t)image->channels;
            double basis_x = cos((ATLAS_MEDIA_PI * (double)component_x * (double)x) / (double)image->width);
            double basis = normalization * basis_x * basis_y;
            atlas_media_linear_rgb pixel;

            atlas_media_load_linear_rgb(image, pixel_offset, &pixel);
            factor.red += basis * pixel.red;
            factor.green += basis * pixel.green;
            factor.blue += basis * pixel.blue;
        }
    }

    {
        double scale = 1.0 / ((double)image->width * (double)image->height);
        factor.red *= scale;
        factor.green *= scale;
        factor.blue *= scale;
    }

    return factor;
}

static double atlas_media_maximum_ac_value(const atlas_media_linear_rgb *factors, size_t factor_count) {
    double maximum_value = 0.0;
    size_t index;

    for (index = 1u; index < factor_count; ++index) {
        double red = fabs(factors[index].red);
        double green = fabs(factors[index].green);
        double blue = fabs(factors[index].blue);

        if (red > maximum_value) {
            maximum_value = red;
        }

        if (green > maximum_value) {
            maximum_value = green;
        }

        if (blue > maximum_value) {
            maximum_value = blue;
        }
    }

    return maximum_value;
}

static uint32_t atlas_media_encode_dc(atlas_media_linear_rgb factor) {
    uint32_t red = (uint32_t)atlas_media_linear_to_srgb_u8(factor.red);
    uint32_t green = (uint32_t)atlas_media_linear_to_srgb_u8(factor.green);
    uint32_t blue = (uint32_t)atlas_media_linear_to_srgb_u8(factor.blue);

    return (red << 16) + (green << 8) + blue;
}

static uint32_t atlas_media_quantize_ac_channel(double value, double maximum_value) {
    double transformed = atlas_media_sign_pow(value / maximum_value, 0.5) * 9.0 + 9.5;
    int quantized = (int)floor(transformed);

    if (quantized < 0) {
        quantized = 0;
    } else if (quantized > 18) {
        quantized = 18;
    }

    return (uint32_t)quantized;
}

static uint32_t atlas_media_encode_ac(atlas_media_linear_rgb factor, double maximum_value) {
    uint32_t quantized_red = atlas_media_quantize_ac_channel(factor.red, maximum_value);
    uint32_t quantized_green = atlas_media_quantize_ac_channel(factor.green, maximum_value);
    uint32_t quantized_blue = atlas_media_quantize_ac_channel(factor.blue, maximum_value);

    return (quantized_red * 19u * 19u) + (quantized_green * 19u) + quantized_blue;
}

ATLAS_MEDIA_API atlas_media_status atlas_media_encode_blurhash(
    const atlas_media_image *input,
    uint32_t components_x,
    uint32_t components_y,
    char *output,
    size_t output_length
) {
    size_t factor_count;
    size_t expected_length;
    atlas_media_linear_rgb *factors;
    uint32_t size_flag;
    double maximum_value;
    uint32_t quantized_maximum_value;
    size_t factor_index;
    size_t write_offset;
    uint32_t component_y;

    if (output != NULL && output_length > 0u) {
        output[0] = '\0';
    }

    if (!atlas_media_validate_image(input) || output == NULL || output_length == 0u) {
        return ATLAS_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    if (components_x == 0u || components_y == 0u
        || components_x > ATLAS_MEDIA_BLURHASH_MAX_COMPONENTS
        || components_y > ATLAS_MEDIA_BLURHASH_MAX_COMPONENTS) {
        return ATLAS_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    factor_count = (size_t)components_x * (size_t)components_y;
    expected_length = 4u + (2u * factor_count);
    if (output_length <= expected_length) {
        return ATLAS_MEDIA_STATUS_INVALID_ARGUMENT;
    }

    factors = (atlas_media_linear_rgb *)malloc(factor_count * sizeof(*factors));
    if (factors == NULL) {
        return ATLAS_MEDIA_STATUS_NO_MEMORY;
    }

    factor_index = 0u;
    for (component_y = 0u; component_y < components_y; ++component_y) {
        uint32_t component_x;

        for (component_x = 0u; component_x < components_x; ++component_x) {
            factors[factor_index] = atlas_media_multiply_basis_function(input, component_x, component_y);
            factor_index += 1u;
        }
    }

    size_flag = (components_x - 1u) + ((components_y - 1u) * 9u);
    atlas_media_encode83(size_flag, 1u, output);

    if (factor_count > 1u) {
        double actual_maximum_value = atlas_media_maximum_ac_value(factors, factor_count);
        int candidate = (int)floor(actual_maximum_value * 166.0 - 0.5);

        if (candidate < 0) {
            candidate = 0;
        } else if (candidate > 82) {
            candidate = 82;
        }

        quantized_maximum_value = (uint32_t)candidate;
        maximum_value = (double)(quantized_maximum_value + 1u) / 166.0;
    } else {
        quantized_maximum_value = 0u;
        maximum_value = 1.0;
    }

    atlas_media_encode83(quantized_maximum_value, 1u, output + 1u);
    atlas_media_encode83(atlas_media_encode_dc(factors[0]), 4u, output + 2u);

    write_offset = 6u;
    for (factor_index = 1u; factor_index < factor_count; ++factor_index) {
        atlas_media_encode83(atlas_media_encode_ac(factors[factor_index], maximum_value), 2u, output + write_offset);
        write_offset += 2u;
    }

    output[expected_length] = '\0';
    free(factors);
    return ATLAS_MEDIA_STATUS_OK;
}
