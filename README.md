# Lendly

Plataforma comunitária de empréstimo e aluguel de objetos entre vizinhos — cadastre um item, empreste de graça ou alugue por diária via Pix, combine tudo pelo chat e avalie ao final.

## Stack

- **Backend:** Python 3.11 + FastAPI
- **Banco de dados:** MongoDB via MongoEngine
- **Frontend web:** Next.js 14 (App Router) — em `frontend/`, não coberto por este README
- **Autenticação:** JWT (python-jose + passlib/bcrypt), com 2FA opcional via TOTP
- **Pagamentos:** Mercado Pago (Pix, split automático de taxa da plataforma)
- **E-mail:** SMTP (MailHog em desenvolvimento)
- **Containerização:** Docker + Docker Compose
- **Qualidade de código:** Ruff, mypy, pytest, pre-commit, GitHub Actions

Este README cobre o backend (`web/`). O frontend (`frontend/`) tem seu próprio `package.json`/scripts e não está documentado aqui.

---

## Estrutura do repositório

```
lendly/
├── web/            # Backend — FastAPI + MongoEngine (este README)
├── frontend/        # Frontend web — Next.js 14
└── mobile/          # App mobile (Flutter) — fora do controle de versão por enquanto
```

### `web/app/`

```
app/
├── main.py              # Entrada da aplicação, middlewares, rotas públicas (/health, /categories, /announcement)
├── config.py             # Variáveis de ambiente (pydantic-settings)
├── database.py           # Conexão MongoEngine
├── dependencies.py       # get_current_user / get_current_admin (injeção de dependência)
├── rate_limit.py          # Configuração do slowapi (limite de requisições)
├── ws_manager.py          # Conexões WebSocket ativas (chat em tempo real)
├── models/                # Documentos MongoEngine (ODM) — 11 modelos
├── schemas/                # Pydantic v2 — validação de request/response — 19 arquivos
├── routers/                 # Endpoints FastAPI, um arquivo por domínio — 107 rotas ao todo
├── services/                 # Regras de negócio — 25 arquivos
└── utils/                     # Segurança, criptografia, validadores (CPF/CNPJ), data/hora
```

### `web/` (raiz)

```
web/
├── Dockerfile              # Imagem de produção — só requirements.txt
├── docker-compose.yml       # api + mongo + mailhog
├── requirements.txt          # Dependências de runtime
├── requirements-dev.txt       # + ruff, mypy, pytest, httpx, pre-commit (nunca entra na imagem)
├── pyproject.toml              # Config do Ruff, mypy e pytest
├── seed.py                      # Popula o banco com dados de exemplo via HTTP
├── tests/                        # Suíte pytest (auth, empréstimos, pagamento)
└── .env.example
```

---

## Como rodar localmente

### Com Docker Compose (recomendado)

```bash
cd web

# 1. Crie o .env a partir do exemplo
cp .env.example .env
# Edite .env — no mínimo troque SECRET_KEY e ENCRYPTION_KEY antes de qualquer
# coisa parecida com produção (veja "Variáveis de ambiente" abaixo)

# 2. Suba os containers (api + mongo + mailhog)
docker compose up --build
```

A API fica em `http://localhost:8000`, a documentação interativa em `http://localhost:8000/docs`, e o MailHog (captura os e-mails enviados em dev) em `http://localhost:8025`.

### Sem Docker (desenvolvimento local)

```bash
cd web

# Pré-requisito: MongoDB rodando em localhost:27017

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt   # runtime + ferramentas de dev

cp .env.example .env
uvicorn app.main:app --reload
```

### Popular com dados de exemplo

Com a API já rodando (`http://localhost:8000` por padrão):

```bash
python web/seed.py
```

Cria ~20 usuários (5 contas empresariais), ~112 itens, 3 grupos e ~35 empréstimos finalizados com avaliações — tudo centrado em Campo Grande, Recife (PE), pra testar busca por proximidade.

---

## Variáveis de ambiente

`web/.env.example` traz todas com um valor padrão de desenvolvimento. As que precisam de um valor real antes de qualquer coisa próxima de produção estão marcadas.

| Variável | Padrão (dev) | Descrição |
|---|---|---|
| `MONGODB_URL` | `mongodb://localhost:27017` | URI de conexão com o MongoDB |
| `MONGODB_DB` | `lendly` | Nome do banco de dados |
| `SECRET_KEY` | *(trocar!)* | Chave para assinar os JWT |
| `ALGORITHM` | `HS256` | Algoritmo de assinatura do JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Validade do access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Validade do refresh token |
| `SMTP_HOST` / `SMTP_PORT` | `mailhog` / `1025` | Servidor de e-mail (verificação de conta, notificações) |
| `SMTP_USER` / `SMTP_PASS` | *(vazio)* | Credenciais SMTP — vazio funciona com o MailHog do compose |
| `SMTP_FROM` | `noreply@lendly.app` | Remetente dos e-mails |
| `SMTP_TLS` | `false` | Usar TLS na conexão SMTP |
| `EMAIL_VERIFICATION_EXPIRE_HOURS` | `24` | Validade do link de verificação de e-mail |
| `FRONTEND_URL` | `http://localhost:3000` | Usado para montar links absolutos (verificação de e-mail, callback do Mercado Pago) |
| `TOTP_ISSUER` | `Lendly` | Nome exibido no app autenticador (2FA) |
| `API_PUBLIC_URL` | `http://localhost:8000` | Base para URLs absolutas de fotos — trocar para `http://10.0.2.2:8000` no emulador Android |
| `ENCRYPTION_KEY` | *(trocar!)* | Chave Fernet (32 bytes base64) usada para criptografar os tokens do Mercado Pago em repouso |
| `MP_APP_ID` / `MP_CLIENT_SECRET` | *(vazio)* | Credenciais OAuth do app Mercado Pago |
| `MP_ACCESS_TOKEN` | *(vazio)* | Token da conta Mercado Pago da própria Lendly |
| `MP_WEBHOOK_SECRET` | *(vazio)* | Segredo pra validar a assinatura dos webhooks do Mercado Pago |
| `PLATFORM_FEE_PERCENT` | `0.05` | Percentual retido pela Lendly em cada empréstimo pago (5%) |

Sem `MP_ACCESS_TOKEN` configurado, tudo relacionado a pagamento fica inerte (itens gratuitos e o resto da plataforma funcionam normalmente).

---

## Funcionalidades

A API tem 107 rotas — a listagem completa, com descrição de cada uma, está em `/docs` (Swagger, gerado a partir das docstrings de cada handler). Por domínio:

- **Autenticação** (`/auth`) — cadastro com verificação de e-mail, login, refresh token, 2FA via TOTP, dispositivos confiáveis
- **Usuários** (`/users`) — perfil, meus itens/favoritos/solicitações, analytics do dono, exportação de dados pessoais (LGPD), conexão com Mercado Pago, contas empresariais (CNPJ) com diretório público
- **Itens** (`/items`) — CRUD, busca full-text + filtros + raio de distância, favoritos, lista de espera, fotos (com remoção de EXIF/GPS)
- **Solicitações de empréstimo** (`/requests`) — ciclo `pending → accepted → in_progress → finished`, extensão de prazo, chat em tempo real via WebSocket
- **Pagamentos** — cobrança Pix na aceitação, retenção até a retirada, liberação ao dono, estorno em cancelamento (ver [`web/docs/pagamento-online.md`](web/docs/pagamento-online.md) para o ciclo de vida completo)
- **Grupos** (`/groups`) — compartilhamento privado de itens por convite
- **Avaliações** (`/reviews`) — uma por participante por solicitação finalizada
- **Verificação de identidade** (`/verification`) — CPF + selfie + documento, fila de aprovação manual
- **Denúncias** (`/reports`) — de itens ou usuários, com fila de moderação
- **Administração** (`/admin`, 31 rotas) — dashboard, gestão de usuários/itens/grupos/avaliações/categorias, ações em lote, exportação CSV, histórico de ações administrativas, modo "ver como" (somente leitura)
- **Configurações da plataforma** — banner de aviso, limites de taxa, validade de token — editáveis sem redeploy

### Fluxo de status de uma solicitação

```
pending → accepted → in_progress → finished
pending → refused
pending / accepted → cancelled
```

---

## Regras de negócio (destaques)

- Usuário não pode solicitar seu próprio item; contas administrativas não cadastram itens nem fazem solicitações
- Apenas o dono aceita, recusa, inicia ou finaliza uma solicitação; qualquer um dos dois pode cancelar enquanto `pending`/`accepted`
- Item com solicitação `accepted`/`in_progress` bloqueia novas solicitações
- Item que exige verificação de identidade só aceita solicitações de quem tem `identity_status == "approved"`
- Item pago exige que o dono já tenha conectado uma conta Mercado Pago
- Retirada (`start`) de item pago fica bloqueada até o Pix ser confirmado
- Avaliação só depois de `finished`, uma por avaliador por solicitação
- Remoção de item/conta é sempre soft delete — nunca some do banco (referências de outros usuários continuam válidas)

---

## Qualidade de código

```bash
cd web
pip install -r requirements-dev.txt

ruff check app tests          # lint
ruff format app tests         # formatação
mypy app                       # checagem de tipos
pytest                          # suíte de testes (requer Mongo rodando)
```

`pre-commit install` (na raiz do repositório) roda lint + formatação + mypy automaticamente antes de cada commit — config em `.pre-commit-config.yaml`. O GitHub Actions (`.github/workflows/backend-ci.yml`) roda a mesma checagem, mais os testes, em todo push/PR que toca `web/**`.

---

## O que ainda falta

Boa parte do que era "melhoria futura" numa versão anterior deste README já foi implementado (pagamento online, chat, verificação de identidade, categorias com subcategorias, geolocalização, contas empresariais...). O que continua em aberto:

- [ ] App mobile (o diretório `mobile/` existe mas está fora do controle de versão por enquanto)
- [ ] Internacionalização (planejado: `next-intl`, inglês como segundo idioma no frontend)
- [ ] Programa de indicação (dois lados ganham destaque temporário no item ao indicar um novo usuário)
- [ ] Seguro/caução para itens de maior valor
- [ ] Cobertura de testes além dos fluxos de maior risco (hoje: autenticação, empréstimos, pagamento)
