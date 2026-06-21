FROM nvidia/cuda:13.0.3-devel-ubuntu22.04 AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3.10 python3.10-venv python3-pip python3.10-dev && \
    rm -rf /var/lib/apt/lists/*

RUN python3.10 -m venv /venv
ENV PATH="/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .

ENV CMAKE_ARGS="-DGGML_CUDA=on"
ENV FORCE_CMAKE=1

# llama-cpp-python needs explicit CUDA build (not in requirements.txt)
RUN CMAKE_ARGS="-DGGML_CUDA=on" FORCE_CMAKE=1 \
    pip install --no-cache-dir llama-cpp-python

RUN pip install --no-cache-dir -r requirements.txt

FROM nvidia/cuda:13.0.3-runtime-ubuntu22.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3.10 python3-pip libgomp1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy venv site-packages to system Python path
COPY --from=builder /venv/lib/python3.10/site-packages /usr/local/lib/python3.10/dist-packages

COPY app/ ./app/
COPY model_config.yaml prompts.yaml ./
COPY scripts/ ./scripts/
COPY models/ /app/models/

RUN mkdir -p /app/db

EXPOSE 8000

CMD ["/app/scripts/entrypoint.sh"]
