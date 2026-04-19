cmake_minimum_required(VERSION 3.20)
project(atlas_wasm LANGUAGES CXX)

if (NOT EMSCRIPTEN)
  message(WARNING "atlas-frontend/wasm is intended to be configured with emcmake/emmake from the Emscripten SDK.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(ATLAS_WASM_OUTPUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/dist")
file(MAKE_DIRECTORY "${ATLAS_WASM_OUTPUT_DIR}")

add_executable(atlas_wasm
  src/atlas_wasm.cpp
)

target_compile_options(atlas_wasm PRIVATE
  -O3
  -Wall
  -Wextra
  -Wpedantic
)

target_link_options(atlas_wasm PRIVATE
  "--bind"
  "-sWASM=1"
  "-sMODULARIZE=1"
  "-sEXPORT_ES6=1"
  "-sEXPORT_NAME=createAtlasWasmModule"
  "-sENVIRONMENT=web,worker"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sFILESYSTEM=0"
  "-sINITIAL_MEMORY=16777216"
  "-sASSERTIONS=1"
  "-sEXPORTED_RUNTIME_METHODS=[]"
)

set_target_properties(atlas_wasm PROPERTIES
  OUTPUT_NAME "atlas_wasm"
  SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${ATLAS_WASM_OUTPUT_DIR}"
)
