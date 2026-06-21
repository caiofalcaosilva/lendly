# Lendly

Plataforma comunitária de empréstimo e aluguel de objetos entre vizinhos.

## Stack

- **Backend:** Python 3.11 + FastAPI
- **Banco de dados:** MongoDB via MongoEngine
- **Autenticação:** JWT (python-jose + passlib/bcrypt)
- **Containerização:** Docker + Docker Compose

---

## Estrutura do projeto

```
web/
├── app/
│   ├── main.py              # Entrada da aplicação, middlewares, routers
│   ├── config.py            # Variáveis de ambiente (pydantic-settings)
│   ├── database.py          # Conexão MongoEngine
│   ├── dependencies.py      # get_current_user (injeção de dependência)
│   ├── models/              # Documentos MongoEngine (ODM)
│   │   ├── user.py
│   │   ├── item.py
│   │   ├── loan_request.py
│   │   └── review.py
│   ├── schemas/             # Pydantic v2 — request/response validation
│   │   ├── user.py
│   │   ├── item.py
│   │   ├── loan_request.py
│   │   └── review.py
│   ├── routers/             # Endpoints FastAPI
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── items.py
│   │   ├── loan_requests.py
│   │   └── reviews.py
│   ├── services/            # Regras de negócio
│   │   ├── auth_service.py
│   │   ├── item_service.py
│   │   ├── loan_request_service.py
│   │   └── review_service.py
│   └── utils/
│       └── security.py      # Hash de senha, criação/decodificação de JWT
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Como rodar localmente

### Com Docker Compose (recomendado)

```bash
cd web

# 1. Crie o .env a partir do exemplo
cp .env.example .env
# Edite .env e defina um SECRET_KEY forte

# 2. Suba os containers
docker compose up --build
```

A API ficará disponível em `http://localhost:8000`.  
Documentação interativa: `http://localhost:8000/docs`

### Sem Docker (desenvolvimento local)

```bash
cd web

# Pré-requisito: MongoDB rodando em localhost:27017

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env

uvicorn app.main:app --reload
```

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `MONGODB_URL` | `mongodb://localhost:27017` | URI de conexão com o MongoDB |
| `MONGODB_DB` | `lendly` | Nome do banco de dados |
| `SECRET_KEY` | *(obrigatório em produção)* | Chave para assinar JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Validade do token (24 h) |

---

## Endpoints da API

### Autenticação — `/auth`

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cadastrar novo usuário |
| `POST` | `/auth/login` | Login, retorna JWT |
| `GET` | `/auth/me` | Perfil do usuário autenticado |

### Usuários — `/users`

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `PUT` | `/users/me` | ✅ | Atualizar meu perfil |
| `GET` | `/users/me/items` | ✅ | Meus itens cadastrados |
| `GET` | `/users/me/requests/sent` | ✅ | Solicitações que enviei |
| `GET` | `/users/me/requests/received` | ✅ | Solicitações que recebi |
| `GET` | `/users/me/history` | ✅ | Histórico de empréstimos |
| `GET` | `/users/{user_id}` | — | Perfil público de um usuário |

### Itens — `/items`

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `GET` | `/items` | — | Listar/buscar itens (com filtros) |
| `GET` | `/items/{item_id}` | — | Detalhe de um item |
| `POST` | `/items` | ✅ | Cadastrar item |
| `PUT` | `/items/{item_id}` | ✅ | Editar item |
| `DELETE` | `/items/{item_id}` | ✅ | Remover item (soft delete) |
| `PATCH` | `/items/{item_id}/activate` | ✅ | Marcar como disponível |
| `PATCH` | `/items/{item_id}/deactivate` | ✅ | Marcar como indisponível |

**Filtros disponíveis em `GET /items`:**
- `search` — busca por título (case-insensitive)
- `category` — `tools`, `electronics`, `sports`, `garden`, `kitchen`, `books`, `toys`, `clothing`, `furniture`, `other`
- `availability_type` — `free` ou `paid`
- `neighborhood` — filtro de bairro
- `city` — filtro de cidade
- `skip` / `limit` — paginação

### Solicitações — `/requests`

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/requests` | ✅ | Criar solicitação |
| `GET` | `/requests/{id}` | ✅ | Ver detalhes (apenas participantes) |
| `PATCH` | `/requests/{id}/accept` | ✅ (dono) | Aceitar solicitação |
| `PATCH` | `/requests/{id}/refuse` | ✅ (dono) | Recusar solicitação |
| `PATCH` | `/requests/{id}/start` | ✅ (dono) | Iniciar empréstimo |
| `PATCH` | `/requests/{id}/finish` | ✅ (dono) | Finalizar empréstimo |
| `PATCH` | `/requests/{id}/cancel` | ✅ (ambos) | Cancelar solicitação |

**Fluxo de status:**
```
pending → accepted → in_progress → finished
pending → refused
pending / accepted → cancelled
```

### Avaliações — `/reviews`

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/reviews/request/{request_id}` | ✅ | Avaliar após solicitação finalizada |
| `GET` | `/reviews/user/{user_id}` | — | Ver avaliações de um usuário |

---

## Exemplos de chamadas

### Cadastrar usuário
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "password": "senha123",
    "phone": "11999990000",
    "neighborhood": "Vila Madalena",
    "city": "São Paulo",
    "approximate_address": "Rua Harmonia, próximo ao metrô"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "maria@example.com", "password": "senha123"}'
```

### Cadastrar item (requer token)
```bash
curl -X POST http://localhost:8000/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Furadeira Bosch",
    "description": "Furadeira de impacto 650W, brocas incluídas",
    "category": "tools",
    "availability_type": "paid",
    "daily_rate": 25.00,
    "usage_rules": "Devolver limpa e com todas as brocas",
    "neighborhood": "Vila Madalena",
    "city": "São Paulo"
  }'
```

### Buscar itens gratuitos em São Paulo
```bash
curl "http://localhost:8000/items?city=São+Paulo&availability_type=free"
```

### Solicitar um item
```bash
curl -X POST http://localhost:8000/requests \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": "<item_id>",
    "pickup_date": "2026-07-01T10:00:00",
    "expected_return_date": "2026-07-03T10:00:00",
    "notes": "Vou usar para reformar o banheiro"
  }'
```

### Avaliar após finalizar
```bash
curl -X POST http://localhost:8000/reviews/request/<request_id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "comment": "Ótima experiência, item em perfeito estado!"}'
```

---

## Regras de negócio implementadas

- Apenas usuários autenticados podem cadastrar itens ou fazer solicitações
- Usuário não pode solicitar seu próprio item
- Apenas o dono aceita, recusa, inicia ou finaliza uma solicitação
- Ambos (dono e solicitante) podem cancelar enquanto `pending` ou `accepted`
- Avaliação só é possível após status `finished`
- Cada participante avalia apenas uma vez por solicitação
- Itens com solicitação ativa (`accepted` ou `in_progress`) bloqueiam novas solicitações
- Remoção de item é soft delete (`is_active = false`)

---

## Sugestões de melhorias futuras

### Curto prazo (próximas iterações)
- [ ] Upload real de fotos (S3 / Cloudflare R2)
- [ ] Notificações por e-mail (SendGrid) ao aceitar/recusar solicitações
- [ ] Refresh token para renovação de sessão sem novo login
- [ ] Rate limiting por IP para evitar abuso de cadastros

### Médio prazo
- [ ] Pagamento online integrado (Stripe ou Pix via Mercado Pago)
- [ ] Chat entre dono e solicitante dentro da plataforma
- [ ] Mapa de itens por geolocalização (MongoDB `$near`)
- [ ] Sistema de categorias hierárquicas (ex: Ferramentas > Elétricas)
- [ ] Busca full-text com Atlas Search ou Elasticsearch

### Produto completo
- [ ] App mobile (React Native / Flutter)
- [ ] Verificação de identidade (CPF + foto) para aumentar confiança
- [ ] Seguro para itens de alto valor
- [ ] Sistema de caução/depósito
- [ ] Grupos de vizinhança com convites privados
- [ ] Dashboard de analytics para o dono (quantas vezes o item foi emprestado, receita gerada)
- [ ] API de CEP para autocompletar endereço e normalizar dados de localização
