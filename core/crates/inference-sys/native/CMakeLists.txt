cmake_minimum_required(VERSION 3.22)
project(inference_native C CXX)

# llama.cpp is added first so its ggml becomes the only ggml target; whisper.cpp skips
# its vendored copy when `TARGET ggml` already exists.
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)

add_subdirectory(${THIRD_PARTY_DIR}/llama.cpp llama.cpp)
add_subdirectory(${THIRD_PARTY_DIR}/whisper.cpp whisper.cpp)
