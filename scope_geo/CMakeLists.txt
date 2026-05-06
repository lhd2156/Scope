cmake_minimum_required(VERSION 3.24)

project(
    scope_geo
    VERSION 0.1.0
    DESCRIPTION "Native geospatial computation library for Scope Intel"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

include(FetchContent)

option(SCOPE_GEO_BUILD_TESTS "Build scope_geo C++ unit tests" ON)
option(SCOPE_GEO_FETCH_PYBIND11 "Fetch pybind11 during configure" ON)

set(PYBIND11_FINDPYTHON ON)

add_library(scope_geo STATIC
    src/core.cpp
    src/haversine.cpp
    src/rtree.cpp
    src/pathfinding.cpp
    src/hull.cpp
    src/cluster.cpp
)
add_library(scope::geo ALIAS scope_geo)

target_include_directories(scope_geo
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_features(scope_geo PUBLIC cxx_std_20)

if(MSVC)
    target_compile_options(scope_geo PRIVATE /W4 /permissive- /EHsc)
else()
    target_compile_options(scope_geo PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(SCOPE_GEO_FETCH_PYBIND11)
    FetchContent_Declare(
        pybind11
        GIT_REPOSITORY https://github.com/pybind/pybind11.git
        GIT_TAG v2.13.6
        GIT_SHALLOW TRUE
    )

    FetchContent_MakeAvailable(pybind11)
endif()

add_subdirectory(python)

if(SCOPE_GEO_BUILD_TESTS)
    include(CTest)

    if(BUILD_TESTING)
        add_subdirectory(tests)
    endif()
endif()

message(STATUS "scope_geo configured with the scaffold, haversine primitive, packed R-tree spatial index, native pathfinding engine, convex hull utilities, viewport clustering, a pybind11 module, and mixed GoogleTest plus pytest integration coverage.")
