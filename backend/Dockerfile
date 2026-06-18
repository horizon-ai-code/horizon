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

RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.10-slim

WORKDIR /app

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY app/ ./app/
COPY model_config.yaml prompts.yaml ./

RUN mkdir -p /app/db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
