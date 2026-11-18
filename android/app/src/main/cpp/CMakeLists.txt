cmake_minimum_required(VERSION 3.22.1)
project(quizclass_node_bridge)

add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES
    IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libnode.so"
)

add_library(native-lib SHARED node_bridge.cpp)
target_include_directories(native-lib PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/libnode/include/node")
find_library(log-lib log)
find_library(android-lib android)
find_library(dl-lib dl)
find_library(z-lib z)
find_library(m-lib m)
find_library(cxx-shared-lib c++_shared)
target_link_libraries(native-lib node ${log-lib} ${android-lib} ${dl-lib} ${z-lib} ${m-lib} ${cxx-shared-lib})
