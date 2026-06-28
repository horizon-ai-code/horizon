.PHONY: build build-gpu build-cpu build-frontend push push-gpu push-cpu push-frontend up up-local up-cpu up-cpu-local down dev

build: build-gpu build-cpu build-frontend

build-gpu:
	docker build -t ghcr.io/horizon-ai-code/horizon-backend:latest -f backend/Dockerfile backend/

build-cpu:
	docker build -t ghcr.io/horizon-ai-code/horizon-backend:cpu -f backend/Dockerfile.cpu backend/

build-frontend:
	docker build -t ghcr.io/horizon-ai-code/horizon-frontend:latest \
		--build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
		--build-arg NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws \
		frontend/

push: push-gpu push-cpu push-frontend

push-gpu:
	docker push ghcr.io/horizon-ai-code/horizon-backend:latest

push-cpu:
	docker push ghcr.io/horizon-ai-code/horizon-backend:cpu

push-frontend:
	docker push ghcr.io/horizon-ai-code/horizon-frontend:latest

up:
	docker compose up -d && docker compose logs -f

up-local:
	docker compose up -d --pull never && docker compose logs -f

up-cpu:
	docker compose -f docker-compose.cpu.yml up -d && docker compose -f docker-compose.cpu.yml logs -f

up-cpu-local:
	docker compose -f docker-compose.cpu.yml up -d --pull never && docker compose -f docker-compose.cpu.yml logs -f

dev:
	trap 'kill 0' EXIT; \
		uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir backend & \
		npm --prefix frontend run dev & \
		wait

down:
	docker compose down
