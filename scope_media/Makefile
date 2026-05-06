PYTHON ?= C:/Users/dongu/AppData/Local/Python/bin/python.exe
CC ?= gcc
BUILD_DIR := build
INCLUDE_DIR := include
SRC_DIR := src
TEST_DIR := tests
TARGET_NAME := scope_media
BUILD_SCRIPT := build.py

.DEFAULT_GOAL := test

.PHONY: all build test scaffold clean compiler-check

all: build

compiler-check:
	$(PYTHON) -c "import shutil, sys; compiler = shutil.which('cl') or shutil.which('gcc'); print(compiler or 'No C compiler found in PATH'); sys.exit(0 if compiler else 1)"

build: compiler-check
	$(PYTHON) $(BUILD_SCRIPT)

test:
	$(PYTHON) -m pytest $(TEST_DIR)

scaffold:
	$(PYTHON) -m pytest $(TEST_DIR)/test_scaffold.py

clean:
	$(PYTHON) -c "from pathlib import Path; import shutil; shutil.rmtree(Path('$(BUILD_DIR)'), ignore_errors=True)"
