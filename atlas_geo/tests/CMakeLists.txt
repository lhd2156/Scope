include(FetchContent)
include(GoogleTest)

set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)

FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.zip
)

FetchContent_MakeAvailable(googletest)

add_executable(atlas_geo_unit_tests
    haversine_test.cpp
    rtree_test.cpp
    pathfinding_test.cpp
)

target_link_libraries(atlas_geo_unit_tests
    PRIVATE
        atlas_geo
        GTest::gtest_main
)

gtest_discover_tests(atlas_geo_unit_tests)
