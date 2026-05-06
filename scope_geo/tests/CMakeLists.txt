include(FetchContent)
include(GoogleTest)

set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)

FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.zip
)

FetchContent_MakeAvailable(googletest)

add_executable(scope_geo_unit_tests
    haversine_test.cpp
    rtree_test.cpp
    pathfinding_test.cpp
    hull_test.cpp
    cluster_test.cpp
)

target_link_libraries(scope_geo_unit_tests
    PRIVATE
        scope_geo
        GTest::gtest_main
)

gtest_discover_tests(scope_geo_unit_tests)
