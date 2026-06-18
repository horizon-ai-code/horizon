# ==========================================
# MANUAL INSTALLATION (GPU FORCE BUILD - FIXED)
# ==========================================

# 1. Point to System CUDA
export CUDACXX=/usr/local/cuda/bin/nvcc

# 2. Point to the "Time Capsule" Compilers (Conda)
export CC=$CONDA_PREFIX/bin/x86_64-conda-linux-gnu-gcc
export CXX=$CONDA_PREFIX/bin/x86_64-conda-linux-gnu-g++

# 3. Force the Compile with Explicit Host Compiler Pointer
# We add -DCMAKE_CUDA_HOST_COMPILER to force nvcc to use your GCC 12
# We add -allow-unsupported-compiler as a secondary safety net
CMAKE_ARGS="-DGGML_CUDA=on \
-DCMAKE_CUDA_HOST_COMPILER=$CXX"

pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir
