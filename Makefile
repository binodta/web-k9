.PHONY: build build-frontend build-backend clean

BINARY_NAME=web-k9

build: build-frontend build-backend

build-frontend:
	cd frontend && pnpm install && pnpm build

build-backend:
	cd backend && go build -o ../$(BINARY_NAME) main.go

clean:
	rm -f $(BINARY_NAME)
	rm -rf backend/frontend/dist
