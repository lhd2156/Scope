.DEFAULT_GOAL := all

PYTHON ?= python
ROOT_DIR := .
BUILD_DIR := $(ROOT_DIR)/build
INCLUDE_DIR := $(ROOT_DIR)/include
SRC_DIR := $(ROOT_DIR)/src
TEST_DIR := $(ROOT_DIR)/tests
LIBRARY_SOURCES := $(SRC_DIR)/core.c

ifeq ($(OS),Windows_NT)
  ifeq ($(origin CC), default)
    CL_PATH := $(strip $(shell $(PYTHON) -c "import shutil; print(shutil.which('cl') or '')"))
    GCC_PATH := $(strip $(shell $(PYTHON) -c "import shutil; print(shutil.which('gcc') or '')"))
    ifneq ($(CL_PATH),)
      CC := cl
    else ifneq ($(GCC_PATH),)
      CC := gcc
    else
      CC :=
    endif
  endif

  SHARED_LIBRARY := $(BUILD_DIR)/atlas_media.dll
  TEST_BINARY := $(BUILD_DIR)/atlas_media_smoke.exe
else
  CC ?= cc

  UNAME_S := $(shell uname -s)
  TEST_BINARY := $(BUILD_DIR)/atlas_media_smoke

  ifeq ($(UNAME_S),Darwin)
    SHARED_LIBRARY := $(BUILD_DIR)/libatlas_media.dylib
  else
    SHARED_LIBRARY := $(BUILD_DIR)/libatlas_media.so
  endif
endif

ifeq ($(strip $(CC)),)
  $(error No supported C compiler found on PATH. Expected cl.exe or gcc.exe on Windows.)
endif

CC_BASENAME := $(notdir $(firstword $(CC)))

ifneq ($(filter cl cl.exe,$(CC_BASENAME)),)
  COMPILER_KIND := msvc
else
  COMPILER_KIND := gcc
endif

COMMON_GCC_FLAGS := -std=c17 -Wall -Wextra -Werror -pedantic -I$(INCLUDE_DIR)
COMMON_MSVC_FLAGS := /nologo /std:c17 /W4 /WX /I$(INCLUDE_DIR)

.PHONY: all clean compiler-check print-config smoke-test pytest test

all: $(SHARED_LIBRARY)

$(BUILD_DIR):
	$(PYTHON) -c "from pathlib import Path; Path(r'$(BUILD_DIR)').mkdir(parents=True, exist_ok=True)"

$(SHARED_LIBRARY): $(LIBRARY_SOURCES) | $(BUILD_DIR)
ifeq ($(COMPILER_KIND),msvc)
	$(CC) $(COMMON_MSVC_FLAGS) /DATLAS_MEDIA_BUILD_SHARED /LD $(LIBRARY_SOURCES) /Fe:$@
else
	$(CC) $(COMMON_GCC_FLAGS) -DATLAS_MEDIA_BUILD_SHARED -shared -fPIC $(LIBRARY_SOURCES) -o $@
endif

$(TEST_BINARY): $(LIBRARY_SOURCES) $(TEST_DIR)/native_smoke.c | $(BUILD_DIR)
ifeq ($(COMPILER_KIND),msvc)
	$(CC) $(COMMON_MSVC_FLAGS) $(LIBRARY_SOURCES) $(TEST_DIR)/native_smoke.c /Fe:$@
else
	$(CC) $(COMMON_GCC_FLAGS) $(LIBRARY_SOURCES) $(TEST_DIR)/native_smoke.c -o $@
endif

compiler-check:
	@echo Using compiler: $(CC)
ifeq ($(COMPILER_KIND),msvc)
	$(CC) /?
else
	$(CC) --version
endif

print-config:
	@echo CC=$(CC)
	@echo COMPILER_KIND=$(COMPILER_KIND)
	@echo SHARED_LIBRARY=$(SHARED_LIBRARY)
	@echo TEST_BINARY=$(TEST_BINARY)

smoke-test: $(TEST_BINARY)
	$(TEST_BINARY)

pytest: $(SHARED_LIBRARY)
	$(PYTHON) -m pytest $(TEST_DIR)

test: smoke-test pytest

clean:
	$(PYTHON) -c "import shutil; shutil.rmtree(r'$(BUILD_DIR)', ignore_errors=True)"
