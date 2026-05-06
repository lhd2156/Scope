"""CUDA / CPU device detection for PyTorch inference."""

import logging

import torch

logger = logging.getLogger(__name__)

_device = None


def get_device() -> torch.device:
    """Return the best available device. Caches result."""
    global _device
    if _device is not None:
        return _device

    if torch.cuda.is_available():
        _device = torch.device("cuda")
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_mem / (1024 ** 3)
        logger.info("Using CUDA device: %s (%.1f GB VRAM)", gpu_name, vram)
    else:
        _device = torch.device("cpu")
        logger.info("CUDA not available - using CPU")

    return _device


def device_info() -> dict:
    """Return device information for health/debug endpoints."""
    dev = get_device()
    info = {
        "device": str(dev),
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__,
    }
    if torch.cuda.is_available():
        info["gpu_name"] = torch.cuda.get_device_name(0)
        info["gpu_memory_gb"] = round(torch.cuda.get_device_properties(0).total_mem / (1024 ** 3), 1)
        info["cuda_version"] = torch.version.cuda
    return info
