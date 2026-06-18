#!/bin/bash
# init.sh

ENV_NAME="horizon_code_env"
eval "$(conda shell.bash hook)"

conda create -n $ENV_NAME python=3.10 pip gxx_linux-64=12 gcc_linux-64=12 sysroot_linux-64=2.17 -c conda-forge -y

conda activate $ENV_NAME

pip install -requirements.txt

chmod +x install_llama_cpp.sh
chmod +x download_models.sh

./install_llama_cpp.sh
./download_models.sh
