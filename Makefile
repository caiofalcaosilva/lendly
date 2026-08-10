.PHONY: dev backend frontend down logs seed install

# Brings up Mongo + API + MailHog (detached, via docker compose) and then
# the Next.js dev server in the foreground — Ctrl+C stops the frontend
# only; run `make down` to stop the backend containers.
dev: backend
	$(MAKE) frontend

backend: web/.env
	cd web && docker compose up --build -d
	@echo "API:      http://localhost:8000"
	@echo "Docs:     http://localhost:8000/docs"
	@echo "MailHog:  http://localhost:8025"

frontend: frontend/.env frontend/node_modules
	cd frontend && npm run dev

down:
	cd web && docker compose down

logs:
	cd web && docker compose logs -f

seed:
	python3 web/seed.py

install: frontend/node_modules

frontend/node_modules:
	cd frontend && npm install

# Generates real dev secrets on first run instead of copying the
# placeholder SECRET_KEY/ENCRYPTION_KEY verbatim — the backend refuses to
# start with those (see app/config.py:assert_secrets_configured).
web/.env: web/.env.example
	cp web/.env.example web/.env
	@python3 -c "\
import base64, secrets; \
path = 'web/.env'; \
text = open(path).read(); \
text = text.replace('SECRET_KEY=changeme-in-production', 'SECRET_KEY=' + secrets.token_urlsafe(48)); \
text = text.replace('ENCRYPTION_KEY=changeme-32-byte-fernet-key-base64==', 'ENCRYPTION_KEY=' + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()); \
open(path, 'w').write(text)"

frontend/.env: frontend/.env.example
	cp frontend/.env.example frontend/.env
