if(NOT SCOPE_GEO_FETCH_PYBIND11)
    message(STATUS "Skipping scope_geo pybind11 module because SCOPE_GEO_FETCH_PYBIND11=OFF")
    return()
endif()

find_package(Python REQUIRED COMPONENTS Interpreter Development.Module)

set(SCOPE_GEO_PYTHON_OUTPUT_DIR "${CMAKE_BINARY_DIR}/python")

pybind11_add_module(_scope_geo MODULE scope_geo_bindings.cpp)

target_link_libraries(_scope_geo PRIVATE scope_geo)
target_compile_features(_scope_geo PRIVATE cxx_std_20)

if(MSVC)
    target_compile_options(_scope_geo PRIVATE /W4 /permissive- /EHsc)
else()
    target_compile_options(_scope_geo PRIVATE -Wall -Wextra -Wpedantic)
endif()

set_target_properties(_scope_geo PROPERTIES
    OUTPUT_NAME "_scope_geo"
    LIBRARY_OUTPUT_DIRECTORY "${SCOPE_GEO_PYTHON_OUTPUT_DIR}"
    RUNTIME_OUTPUT_DIRECTORY "${SCOPE_GEO_PYTHON_OUTPUT_DIR}"
    ARCHIVE_OUTPUT_DIRECTORY "${SCOPE_GEO_PYTHON_OUTPUT_DIR}"
)

foreach(config DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(_scope_geo PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY_${config} "${SCOPE_GEO_PYTHON_OUTPUT_DIR}"
        RUNTIME_OUTPUT_DIRECTORY_${config} "${SCOPE_GEO_PYTHON_OUTPUT_DIR}"
        ARCHIVE_OUTPUT_DIRECTORY_${config} "${SCOPE_GEO_PYTHON_OUTPUT_DIR}"
    )
endforeach()
