if(NOT ATLAS_GEO_FETCH_PYBIND11)
    message(STATUS "Skipping atlas_geo pybind11 module because ATLAS_GEO_FETCH_PYBIND11=OFF")
    return()
endif()

find_package(Python REQUIRED COMPONENTS Interpreter Development.Module)

set(ATLAS_GEO_PYTHON_OUTPUT_DIR "${CMAKE_BINARY_DIR}/python")

pybind11_add_module(_atlas_geo MODULE atlas_geo_bindings.cpp)

target_link_libraries(_atlas_geo PRIVATE atlas_geo)
target_compile_features(_atlas_geo PRIVATE cxx_std_20)

if(MSVC)
    target_compile_options(_atlas_geo PRIVATE /W4 /permissive- /EHsc)
else()
    target_compile_options(_atlas_geo PRIVATE -Wall -Wextra -Wpedantic)
endif()

set_target_properties(_atlas_geo PROPERTIES
    OUTPUT_NAME "_atlas_geo"
    LIBRARY_OUTPUT_DIRECTORY "${ATLAS_GEO_PYTHON_OUTPUT_DIR}"
    RUNTIME_OUTPUT_DIRECTORY "${ATLAS_GEO_PYTHON_OUTPUT_DIR}"
    ARCHIVE_OUTPUT_DIRECTORY "${ATLAS_GEO_PYTHON_OUTPUT_DIR}"
)

foreach(config DEBUG RELEASE RELWITHDEBINFO MINSIZEREL)
    set_target_properties(_atlas_geo PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY_${config} "${ATLAS_GEO_PYTHON_OUTPUT_DIR}"
        RUNTIME_OUTPUT_DIRECTORY_${config} "${ATLAS_GEO_PYTHON_OUTPUT_DIR}"
        ARCHIVE_OUTPUT_DIRECTORY_${config} "${ATLAS_GEO_PYTHON_OUTPUT_DIR}"
    )
endforeach()
