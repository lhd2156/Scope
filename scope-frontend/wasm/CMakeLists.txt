cmake_minimum_required(VERSION 3.20)
project(scope_wasm LANGUAGES CXX)

if (NOT EMSCRIPTEN)
  message(WARNING "scope-frontend/wasm is intended to be configured with emcmake/emmake from the Emscripten SDK.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(SCOPE_WASM_BUILD_NATIVE_LEXER_TESTS "Build the native Scope AI lexer regression test" OFF)

set(SCOPE_WASM_OUTPUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/dist")
file(MAKE_DIRECTORY "${SCOPE_WASM_OUTPUT_DIR}")

add_executable(scope_wasm
  src/scope_wasm.cpp
)

target_compile_options(scope_wasm PRIVATE
  -O3
  -Wall
  -Wextra
  -Wpedantic
)

target_link_options(scope_wasm PRIVATE
  "--bind"
  "-sWASM=1"
  "-sMODULARIZE=1"
  "-sEXPORT_ES6=1"
  "-sEXPORT_NAME=createScopeWasmModule"
  "-sENVIRONMENT=web,worker,node"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sFILESYSTEM=0"
  "-sINITIAL_MEMORY=16777216"
  "-sASSERTIONS=1"
  "-sEXPORTED_RUNTIME_METHODS=[]"
)

set_target_properties(scope_wasm PROPERTIES
  OUTPUT_NAME "scope_wasm"
  SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${SCOPE_WASM_OUTPUT_DIR}"
)

if(SCOPE_WASM_BUILD_NATIVE_LEXER_TESTS AND NOT EMSCRIPTEN)
  enable_testing()

  add_executable(scope_wasm_lexer_test
    tests/scope_ai_lexer_test.cpp
  )
  target_include_directories(scope_wasm_lexer_test PRIVATE src)
  if(MSVC)
    target_compile_options(scope_wasm_lexer_test PRIVATE /W4 /permissive- /EHsc)
  else()
    target_compile_options(scope_wasm_lexer_test PRIVATE
      -Wall
      -Wextra
      -Wpedantic
    )
  endif()

  add_test(NAME scope_wasm_lexer_test COMMAND scope_wasm_lexer_test)
endif()
