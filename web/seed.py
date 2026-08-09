#!/usr/bin/env python3
"""
Seed script: 20 users (5 business) + 112 items + 3 groups + ~35 finished
loan requests with reviews. Everything centered on Campo Grande, Recife (PE)
and its neighboring bairros.
Run from the repo root:  python web/seed.py
Requires: pip install requests
"""

import contextlib
import itertools
import os
import random
import time
from datetime import UTC, datetime, timedelta

import requests

BASE = os.environ.get("SEED_API_URL", "http://localhost:8000")

random.seed(42)


def post_retrying(url: str, **kwargs) -> requests.Response:
    """POST that waits out 429s from the auth rate limiter (5/min on
    register & login)."""
    while True:
        r = requests.post(url, **kwargs)
        if r.status_code != 429:
            return r
        wait = 13
        with contextlib.suppress(TypeError, ValueError):
            wait = max(wait, int(float(r.headers.get("Retry-After", wait))) + 1)
        print(f"    ⏳ rate limited, aguardando {wait}s...")
        time.sleep(wait)


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def past(days: int) -> datetime:
    return datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)


# ── Neighborhoods — Campo Grande, Recife (PE) + the RPA-2/Norte bairros around it ──

NEIGHBORHOODS = {
    "Campo Grande": {
        "zip": "52031-380",
        "lat": -8.0397,
        "lng": -34.9022,
        "street": "Rua José Osório",
    },
    "Encruzilhada": {
        "zip": "52041-013",
        "lat": -8.0409,
        "lng": -34.8908,
        "street": "Rua do Hospício",
    },
    "Rosarinho": {
        "zip": "52061-400",
        "lat": -8.0328,
        "lng": -34.8871,
        "street": "Rua Conselheiro Portela",
    },
    "Arruda": {
        "zip": "52070-000",
        "lat": -8.0294,
        "lng": -34.9016,
        "street": "Estrada do Arraial",
    },
    "Fundão": {
        "zip": "52060-320",
        "lat": -8.0342,
        "lng": -34.9068,
        "street": "Rua do Futuro",
    },
    "Hipódromo": {
        "zip": "52050-050",
        "lat": -8.0466,
        "lng": -34.9010,
        "street": "Avenida Beira Rio",
    },
    "Torreão": {
        "zip": "53040-000",
        "lat": -8.0508,
        "lng": -34.8971,
        "street": "Rua Torreão",
    },
    "Água Fria": {
        "zip": "52080-030",
        "lat": -8.0180,
        "lng": -34.9080,
        "street": "Estrada de Água Fria",
    },
    "Campina do Barreto": {
        "zip": "52090-005",
        "lat": -8.0110,
        "lng": -34.9040,
        "street": "Rua Campina do Barreto",
    },
    "Peixinhos": {
        "zip": "53230-540",
        "lat": -7.9980,
        "lng": -34.8730,
        "street": "Avenida Presidente Kennedy",
    },
    "Cajueiro": {
        "zip": "52100-070",
        "lat": -8.0230,
        "lng": -34.9130,
        "street": "Rua do Cajueiro",
    },
    "Beberibe": {
        "zip": "52110-030",
        "lat": -7.9950,
        "lng": -34.9100,
        "street": "Estrada de Beberibe",
    },
}


def addr(neighborhood: str, number: str, complement: str = None) -> dict:
    n = NEIGHBORHOODS[neighborhood]
    d = {
        "zip_code": n["zip"],
        "street": n["street"],
        "number": number,
        "neighborhood": neighborhood,
        "city": "Recife",
        "state": "PE",
        "latitude": n["lat"],
        "longitude": n["lng"],
    }
    if complement:
        d["complement"] = complement
    return d


# ── Users ──────────────────────────────────────────────────────────────────────
# idx 0-14: individuals. idx 15-19: businesses.

USERS = [
    {
        "name": "Ana Beatriz Lima",
        "email": "ana.lima@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98811-2233",
        **addr("Campo Grande", "145"),
    },
    {
        "name": "Bruno Henrique Costa",
        "email": "bruno.costa@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98722-3344",
        **addr("Encruzilhada", "302", "Apto 201"),
    },
    {
        "name": "Camila Ferreira Dias",
        "email": "camila.dias@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98633-4455",
        **addr("Rosarinho", "88"),
    },
    {
        "name": "Diego Almeida Souza",
        "email": "diego.souza@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98544-5566",
        **addr("Arruda", "410"),
    },
    {
        "name": "Elaine Cristina Rocha",
        "email": "elaine.rocha@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98455-6677",
        **addr("Fundão", "67", "Casa 2"),
    },
    {
        "name": "Fábio Nascimento Silva",
        "email": "fabio.silva@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98366-7788",
        **addr("Hipódromo", "230"),
    },
    {
        "name": "Gabriela Torres Melo",
        "email": "gabriela.melo@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98277-8899",
        **addr("Torreão", "512"),
    },
    {
        "name": "Hugo Ribeiro Santos",
        "email": "hugo.santos@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98188-9900",
        **addr("Água Fria", "95"),
    },
    {
        "name": "Isabela Cavalcanti Souza",
        "email": "isabela.souza@exemplo.com",
        "password": "senha123",
        "phone": "(81) 98099-0011",
        **addr("Campina do Barreto", "178"),
    },
    {
        "name": "João Vitor Barros",
        "email": "joao.barros@exemplo.com",
        "password": "senha123",
        "phone": "(81) 97911-0022",
        **addr("Peixinhos", "340"),
    },
    {
        "name": "Karina Duarte Alves",
        "email": "karina.alves@exemplo.com",
        "password": "senha123",
        "phone": "(81) 97822-1133",
        **addr("Cajueiro", "56"),
    },
    {
        "name": "Leonardo Pinto Farias",
        "email": "leonardo.farias@exemplo.com",
        "password": "senha123",
        "phone": "(81) 97733-2244",
        **addr("Beberibe", "410"),
    },
    {
        "name": "Mariana Cordeiro Lima",
        "email": "mariana.lima@exemplo.com",
        "password": "senha123",
        "phone": "(81) 97644-3355",
        **addr("Campo Grande", "620", "Bloco B"),
    },
    {
        "name": "Nicolas Barbosa Melo",
        "email": "nicolas.melo@exemplo.com",
        "password": "senha123",
        "phone": "(81) 97555-4466",
        **addr("Encruzilhada", "77"),
    },
    {
        "name": "Otávio Ramos Guedes",
        "email": "otavio.guedes@exemplo.com",
        "password": "senha123",
        "phone": "(81) 97466-5577",
        **addr("Rosarinho", "204"),
    },
    # ── Business accounts (5) ──
    {
        "name": "Marcelo Andrade",
        "email": "locadoracampogrande@exemplo.com",
        "password": "senha123",
        "phone": "(81) 3222-1010",
        **addr("Campo Grande", "890"),
        "account_type": "business",
        "company_name": "Locadora Campo Grande Ferramentas LTDA",
        "trade_name": "Locadora Ferramentas Campo Grande",
        "cnpj": "10433218000193",
        "business_category": "Locação de ferramentas e equipamentos",
        "business_phone": "(81) 3222-1010",
        "business_hours": "Seg-Sex 7h30-18h, Sáb 8h-13h",
        "website": "https://locadoracampogrande.com.br",
    },
    {
        "name": "Patrícia Gomes",
        "email": "eletrofesta@exemplo.com",
        "password": "senha123",
        "phone": "(81) 3223-2020",
        **addr("Encruzilhada", "455"),
        "account_type": "business",
        "company_name": "EletroFesta Recife Eventos LTDA",
        "trade_name": "EletroFesta Recife",
        "cnpj": "19600133000127",
        "business_category": "Locação de som, iluminação e equipamentos para eventos",
        "business_phone": "(81) 3223-2020",
        "business_hours": "Seg-Sáb 9h-19h",
        "website": "https://eletrofestarecife.com.br",
    },
    {
        "name": "Renato Lucena",
        "email": "bikeecia@exemplo.com",
        "password": "senha123",
        "phone": "(81) 3224-3030",
        **addr("Rosarinho", "150"),
        "account_type": "business",
        "company_name": "Bike e Cia Comércio e Locação LTDA",
        "trade_name": "Bike & Cia Recife",
        "cnpj": "89083863000183",
        "business_category": "Locação de bicicletas e equipamentos esportivos",
        "business_phone": "(81) 3224-3030",
        "business_hours": "Ter-Dom 8h-17h",
        "website": "https://bikeeciarecife.com.br",
    },
    {
        "name": "Sandra Melo",
        "email": "kidsfesta@exemplo.com",
        "password": "senha123",
        "phone": "(81) 3225-4040",
        **addr("Água Fria", "210"),
        "account_type": "business",
        "company_name": "Kids Festa Brinquedos e Eventos LTDA",
        "trade_name": "Kids Festa Brinquedos",
        "cnpj": "79402654000100",
        "business_category": "Locação de brinquedos e infláveis para festas infantis",
        "business_phone": "(81) 3225-4040",
        "business_hours": "Seg-Sáb 8h-18h",
        "website": "https://kidsfestabrinquedos.com.br",
    },
    {
        "name": "Thiago Nogueira",
        "email": "cozinhapro@exemplo.com",
        "password": "senha123",
        "phone": "(81) 3226-5050",
        **addr("Arruda", "330"),
        "account_type": "business",
        "company_name": "Cozinha Pro Equipamentos para Eventos LTDA",
        "trade_name": "Cozinha Pro Equipamentos",
        "cnpj": "23511615000188",
        "business_category": "Locação de equipamentos de cozinha e gastronomia",
        "business_phone": "(81) 3226-5050",
        "business_hours": "Seg-Sex 8h-18h, Sáb 8h-12h",
        "website": "https://cozinhaproeventos.com.br",
    },
]

BUSINESS_START_IDX = 15

# ── Photo pools ──────────────────────────────────────────────────────────────────

PHOTO_POOLS = {
    "tools": [
        "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600",
        "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600",
        "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600",
        "https://images.unsplash.com/photo-1560472355-536de3962603?w=600",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600",
    ],
    "electronics": [
        "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600",
        "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600",
        "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600",
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600",
        "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600",
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600",
        "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=600",
    ],
    "sports": [
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
        "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600",
        "https://images.unsplash.com/photo-1611251135345-18c56206b863?w=600",
        "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600",
        "https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=600",
        "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600",
    ],
    "garden": [
        "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600",
        "https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=600",
    ],
    "kitchen": [
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600",
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600",
        "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600",
        "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
        "https://images.unsplash.com/photo-1593759608142-e9b58f000a53?w=600",
    ],
    "books": [
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600",
        "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?w=600",
        "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=600",
    ],
    "toys": [
        "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600",
        "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600",
        "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600",
        "https://images.unsplash.com/photo-1611251135345-18c56206b863?w=600",
    ],
    "clothing": [
        "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",
        "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600",
        "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600",
    ],
    "furniture": [
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600",
        "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600",
        "https://images.unsplash.com/photo-1586105449897-20b5efeb3233?w=600",
    ],
    "other": [
        "https://images.unsplash.com/photo-1558171813-7cb24b1a1570?w=600",
        "https://images.unsplash.com/photo-1446776709462-d6b525b9c0e0?w=600",
        "https://images.unsplash.com/photo-1586105449897-20b5efeb3233?w=600",
        "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600",
    ],
}
_photo_cycles = {cat: itertools.cycle(pool) for cat, pool in PHOTO_POOLS.items()}


def photo(category: str) -> list:
    return [next(_photo_cycles[category])]


def item(
    owner_idx,
    title,
    description,
    category,
    availability_type,
    daily_rate=None,
    subcategory=None,
):
    d = {
        "owner_idx": owner_idx,
        "title": title,
        "description": description,
        "category": category,
        "availability_type": availability_type,
        "photos": photo(category),
    }
    if subcategory:
        d["subcategory"] = subcategory
    if daily_rate is not None:
        d["daily_rate"] = daily_rate
    return d


# ── Items ──────────────────────────────────────────────────────────────────────
# 45 from individuals (3 each, idx 0-14) + 67 from the 5 businesses (idx 15-19).

ITEMS = [
    # ── Ana Beatriz Lima (0) — tools
    item(
        0,
        "Furadeira de impacto Bosch 650W",
        "Furadeira de impacto em ótimo estado, acompanha maleta e brocas variadas.",
        "tools",
        "free",
        subcategory="electric",
    ),
    item(
        0,
        "Jogo de chaves de fenda e Phillips (32 peças)",
        "Estojo completo, ideal para pequenos reparos domésticos.",
        "tools",
        "free",
        subcategory="manual",
    ),
    item(
        0,
        "Trena a laser 40m",
        "Precisão de até 2mm, ótima para medições em reformas.",
        "tools",
        "paid",
        15.00,
        subcategory="measuring",
    ),
    # ── Bruno Henrique Costa (1) — electronics
    item(
        1,
        "Caixa de som Bluetooth JBL Charge 5",
        "Autonomia de 20h, à prova d'água. Ótima para praia e churrasco.",
        "electronics",
        "paid",
        40.00,
        subcategory="audio_video",
    ),
    item(
        1,
        "Notebook Dell Inspiron para trabalhos",
        "8GB RAM, SSD 256GB. Bom para textos, planilhas e reuniões online.",
        "electronics",
        "paid",
        70.00,
        subcategory="computers",
    ),
    item(
        1,
        "Câmera GoPro Hero 11",
        "Com case à prova d'água, bastão e 2 baterias extras.",
        "electronics",
        "paid",
        50.00,
        subcategory="cameras",
    ),
    # ── Camila Ferreira Dias (2) — sports
    item(
        2,
        "Bicicleta urbana aro 29",
        "21 marchas, ótima para pedalar pela orla do Recife.",
        "sports",
        "paid",
        35.00,
        subcategory="cycling",
    ),
    item(
        2,
        "Kit de yoga (tapete + blocos + faixa)",
        "Tapete antiderrapante, 2 blocos e faixa elástica.",
        "sports",
        "free",
        subcategory="fitness",
    ),
    item(
        2,
        "Barraca de camping 4 pessoas",
        "Impermeável, fácil montagem, ideal para trilhas de fim de semana.",
        "sports",
        "paid",
        45.00,
        subcategory="camping",
    ),
    # ── Diego Almeida Souza (3) — garden
    item(
        3,
        "Aparador de grama a bateria",
        "2 baterias inclusas, ótimo para gramados pequenos e médios.",
        "garden",
        "free",
        subcategory="gardening",
    ),
    item(
        3,
        "Regador de jardim + mangueira 20m",
        "Mangueira flexível com bico regulável e suporte enrolador.",
        "garden",
        "free",
        subcategory="gardening",
    ),
    item(
        3,
        "Kit de jardinagem (pá, ancinho, tesoura)",
        "Ferramentas manuais completas para cuidar de hortas e jardins.",
        "garden",
        "free",
        subcategory="gardening",
    ),
    # ── Elaine Cristina Rocha (4) — kitchen
    item(
        4,
        "Liquidificador industrial Philips Walita",
        "Copo de 2L, motor potente para vitaminas e sucos em quantidade.",
        "kitchen",
        "paid",
        20.00,
        subcategory="appliances",
    ),
    item(
        4,
        "Jogo de panelas antiaderentes (5 peças)",
        "Conjunto completo, cabos que não esquentam.",
        "kitchen",
        "free",
        subcategory="utensils",
    ),
    item(
        4,
        "Jogo de taças de cristal (12 unidades)",
        "Perfeitas para jantares e comemorações especiais.",
        "kitchen",
        "free",
        subcategory="dishware",
    ),
    # ── Fábio Nascimento Silva (5) — books
    item(
        5,
        "Coleção Percy Jackson (5 volumes)",
        "Edição brasileira, capa dura, em ótimo estado de conservação.",
        "books",
        "free",
        subcategory="fiction",
    ),
    item(
        5,
        "Livros de programação Python e JS (lote 6)",
        "Ideais para quem está começando em desenvolvimento web.",
        "books",
        "free",
        subcategory="non_fiction",
    ),
    item(
        5,
        "Gibis Turma da Mônica (30 edições)",
        "Coleção variada, ótima para crianças em fase de leitura.",
        "books",
        "free",
        subcategory="children",
    ),
    # ── Gabriela Torres Melo (6) — toys
    item(
        6,
        "Patinete elétrico infantil",
        "Velocidade limitada, bateria dura cerca de 1h30 de uso contínuo.",
        "toys",
        "paid",
        15.00,
        subcategory="outdoor",
    ),
    item(
        6,
        "Jogo Banco Imobiliário + Detetive (combo)",
        "Peças completas, ótimo para tardes em família.",
        "toys",
        "free",
        subcategory="board_games",
    ),
    item(
        6,
        "Blocos de montar educativos (500 peças)",
        "Compatível com as principais marcas do mercado.",
        "toys",
        "free",
        subcategory="educational",
    ),
    # ── Hugo Ribeiro Santos (7) — clothing
    item(
        7,
        "Terno social completo (tam M)",
        "Paletó, calça e gravata. Ideal para formaturas e casamentos.",
        "clothing",
        "paid",
        40.00,
    ),
    item(
        7,
        "Fantasia de super-herói infantil (Homem-Aranha)",
        "Tamanho 6-8 anos, com máscara. Usada apenas uma vez.",
        "clothing",
        "paid",
        20.00,
        subcategory="costumes",
    ),
    item(
        7,
        "Jaqueta corta-vento para trilha (tam G)",
        "Impermeável, leve, ótima para dias de chuva na trilha.",
        "clothing",
        "free",
        subcategory="sportswear",
    ),
    # ── Isabela Cavalcanti Souza (8) — furniture
    item(
        8,
        "Mesa dobrável + 4 cadeiras para eventos",
        "Fácil transporte, ideal para festas e reuniões de família.",
        "furniture",
        "paid",
        50.00,
        subcategory="living_room",
    ),
    item(
        8,
        "Berço portátil com colchonete",
        "Desmontável, colchonete lavável, em ótimo estado.",
        "furniture",
        "free",
        subcategory="bedroom",
    ),
    item(
        8,
        "Estante de livros modular",
        "3 módulos empilháveis, fácil de montar e desmontar.",
        "furniture",
        "free",
        subcategory="living_room",
    ),
    # ── João Vitor Barros (9) — other
    item(
        9,
        "Máquina de costura portátil",
        "14 pontos, ótima para iniciantes e pequenos reparos.",
        "other",
        "free",
    ),
    item(
        9,
        "Kit de ferramentas para pesca (varas + molinete)",
        "2 varas, molinetes e caixa de iscas. Pronto para pescaria.",
        "other",
        "paid",
        20.00,
    ),
    item(
        9,
        "Carrinho de bebê Burigotto",
        "Dobrável, com cesto e capota removível.",
        "other",
        "free",
    ),
    # ── Karina Duarte Alves (10) — tools
    item(
        10,
        "Serra tico-tico elétrica",
        "Com lâminas variadas, ótima para cortes precisos em madeira.",
        "tools",
        "paid",
        18.00,
        subcategory="electric",
    ),
    item(
        10,
        "Escada de alumínio 5 degraus",
        "Leve e resistente, suporta até 120kg.",
        "tools",
        "paid",
        15.00,
        subcategory="manual",
    ),
    item(
        10,
        "Nível a laser com tripé",
        "Projeção em linha cruzada, ótimo para instalações.",
        "tools",
        "free",
        subcategory="measuring",
    ),
    # ── Leonardo Pinto Farias (11) — electronics
    item(
        11,
        "Projetor portátil Full HD",
        "Ótimo para sessões de cinema em casa ou apresentações.",
        "electronics",
        "paid",
        60.00,
        subcategory="audio_video",
    ),
    item(
        11,
        "Console PlayStation 4 + 2 controles",
        "Com 3 jogos inclusos. Testado e funcionando perfeitamente.",
        "electronics",
        "paid",
        40.00,
        subcategory="games",
    ),
    item(
        11,
        "Tablet Samsung Galaxy Tab",
        'Tela 10.5", ótimo para estudos e leitura.',
        "electronics",
        "paid",
        25.00,
        subcategory="computers",
    ),
    # ── Mariana Cordeiro Lima (12) — sports
    item(
        12,
        "Prancha de stand up paddle (SUP)",
        "Inflável, com bomba e remo. Ideal para o Rio Capibaribe.",
        "sports",
        "paid",
        50.00,
        subcategory="water_sports",
    ),
    item(
        12,
        "Kit de halteres ajustáveis",
        "De 2 a 20kg por unidade, ótimo para treino em casa.",
        "sports",
        "free",
        subcategory="fitness",
    ),
    item(
        12,
        "Rede de vôlei de praia + bola",
        "Rede com hastes portáteis, fácil montagem na areia.",
        "sports",
        "free",
    ),
    # ── Nicolas Barbosa Melo (13) — kitchen
    item(
        13,
        "Air fryer Mondial 4L",
        "Pouco usada, ideal para refeições rápidas e saudáveis.",
        "kitchen",
        "free",
        subcategory="appliances",
    ),
    item(
        13,
        "Máquina de café expresso",
        "Com espumador de leite, faz cappuccino e café coado.",
        "kitchen",
        "paid",
        25.00,
        subcategory="appliances",
    ),
    item(
        13,
        "Jogo de facas profissionais",
        "6 facas com bloco de madeira, fio de qualidade.",
        "kitchen",
        "free",
        subcategory="utensils",
    ),
    # ── Otávio Ramos Guedes (14) — garden
    item(
        14,
        "Motosserra elétrica",
        "35cm de espada, ótima para poda de árvores e corte de lenha.",
        "garden",
        "paid",
        35.00,
        subcategory="gardening",
    ),
    item(
        14,
        "Vasos grandes para plantas (kit 4 unidades)",
        "Cerâmica resistente, ótimos para plantas de médio porte.",
        "garden",
        "free",
    ),
    item(
        14,
        "Cortador de grama manual",
        "Sem motor, silencioso, ideal para gramados pequenos.",
        "garden",
        "free",
        subcategory="gardening",
    ),
    # ═══ Locadora Ferramentas Campo Grande (15) — tools ═══
    item(
        15,
        "Furadeira de impacto profissional Bosch GSB",
        "Uso profissional, com maleta e jogo de brocas completo.",
        "tools",
        "paid",
        30.00,
        subcategory="electric",
    ),
    item(
        15,
        "Betoneira elétrica 400L",
        "Ideal para obras de médio porte. Retirada no local.",
        "tools",
        "paid",
        90.00,
    ),
    item(
        15,
        "Compressor de ar 100L",
        "Motor 2HP, ótimo para pintura e ferramentas pneumáticas.",
        "tools",
        "paid",
        60.00,
    ),
    item(
        15,
        "Gerador a gasolina 5000W",
        "Autonomia de 8h, ideal para obras e eventos sem energia.",
        "tools",
        "paid",
        100.00,
    ),
    item(
        15,
        "Andaime tubular completo (3m)",
        "2 módulos, capacidade 200kg. Ideal para fachadas.",
        "tools",
        "paid",
        65.00,
    ),
    item(
        15,
        "Máquina de solda inversora",
        "220V, com máscara de proteção e eletrodos inclusos.",
        "tools",
        "paid",
        45.00,
        subcategory="electric",
    ),
    item(
        15,
        "Lavadora de alta pressão profissional",
        "1900 PSI, ótima para limpeza de fachadas e calçadas.",
        "tools",
        "paid",
        40.00,
        subcategory="electric",
    ),
    item(
        15,
        "Cortadora de piso/azulejo elétrica",
        "Disco diamantado incluso, corte de precisão.",
        "tools",
        "paid",
        35.00,
        subcategory="electric",
    ),
    item(
        15,
        "Rompedor pneumático (martelete)",
        "Para quebra de concreto e alvenaria. Uso profissional.",
        "tools",
        "paid",
        55.00,
        subcategory="electric",
    ),
    item(
        15,
        "Escada extensiva de alumínio 7m",
        "Dupla função, suporta até 150kg.",
        "tools",
        "paid",
        25.00,
        subcategory="manual",
    ),
    item(
        15,
        "Parafusadeira de impacto industrial",
        "Torque alto, ideal para montagens estruturais.",
        "tools",
        "paid",
        30.00,
        subcategory="electric",
    ),
    item(
        15,
        "Serra mármore profissional",
        "Disco diamantado incluso, corte preciso em granito e mármore.",
        "tools",
        "paid",
        40.00,
        subcategory="electric",
    ),
    item(
        15,
        "Compactador de solo (placa vibratória)",
        "Ideal para calçamento e preparação de terrenos.",
        "tools",
        "paid",
        70.00,
    ),
    item(
        15,
        "Roçadeira costal a gasolina",
        "Motor 2 tempos, ótima para terrenos grandes.",
        "tools",
        "paid",
        40.00,
        subcategory="gardening",
    ),
    item(
        15,
        "Kit de andaime + escora para laje",
        "Conjunto completo para concretagem de lajes pequenas.",
        "tools",
        "paid",
        80.00,
    ),
    # ═══ EletroFesta Recife (16) — electronics / events ═══
    item(
        16,
        "Sistema de som completo para festas",
        '2 caixas ativas 15", mesa de som e 2 microfones.',
        "electronics",
        "paid",
        150.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Kit iluminação de LED para eventos",
        "8 refletores móveis com controle DMX.",
        "electronics",
        "paid",
        100.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Projetor + tela 3m para eventos corporativos",
        "Full HD, 4000 lumens. Ótimo para palestras e workshops.",
        "electronics",
        "paid",
        120.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Gerador silencioso 2000W para eventos externos",
        "Baixo ruído, ideal para casamentos ao ar livre.",
        "electronics",
        "paid",
        90.00,
    ),
    item(
        16,
        "Máquina de fumaça para festas",
        "Com líquido incluso para 2 horas de uso contínuo.",
        "electronics",
        "paid",
        50.00,
    ),
    item(
        16,
        "Caixa de som JBL PartyBox 310",
        "Bateria de longa duração, entrada para microfone e violão.",
        "electronics",
        "paid",
        70.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Kit microfone sem fio duplo",
        "Alcance de até 50m, ótimo para casamentos e formaturas.",
        "electronics",
        "paid",
        40.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Painel de LED para festas (backdrop)",
        "3x2m, RGB programável, com controle remoto.",
        "electronics",
        "paid",
        130.00,
    ),
    item(
        16,
        "Karaokê completo com telão",
        "Mais de 10 mil músicas, 2 microfones sem fio.",
        "electronics",
        "paid",
        90.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Pista de dança de LED 3x3m",
        "Módulos que se encaixam, efeito impressionante para festas.",
        "electronics",
        "paid",
        200.00,
    ),
    item(
        16,
        "Estrutura de tenda 6x6m para eventos",
        "Impermeável, fácil montagem, ideal para chuva ou sol.",
        "electronics",
        "paid",
        180.00,
    ),
    item(
        16,
        "Refletores de palco LED (kit 4 unidades)",
        "RGB com controle DMX, ótimos para shows e eventos.",
        "electronics",
        "paid",
        80.00,
        subcategory="audio_video",
    ),
    item(
        16,
        "Rack de DJ completo com mixer",
        "2 CDJs e mixer profissional, pronto para uso.",
        "electronics",
        "paid",
        160.00,
        subcategory="audio_video",
    ),
    # ═══ Bike & Cia Recife (17) — sports ═══
    item(
        17,
        "Bicicleta speed profissional",
        "Quadro em alumínio, 18 marchas, ótima para longas distâncias.",
        "sports",
        "paid",
        55.00,
        subcategory="cycling",
    ),
    item(
        17,
        "Bicicleta elétrica urbana",
        "Autonomia de 40km, ótima para o dia a dia na cidade.",
        "sports",
        "paid",
        70.00,
        subcategory="cycling",
    ),
    item(
        17,
        "Kayak caiaque individual",
        "Estável e leve, ideal para o Rio Capibaribe.",
        "sports",
        "paid",
        60.00,
        subcategory="water_sports",
    ),
    item(
        17,
        "Prancha de surf 6'0\"",
        "Shape tri-fin, ótima para ondas médias. Com capa protetora.",
        "sports",
        "paid",
        40.00,
        subcategory="water_sports",
    ),
    item(
        17,
        "Kit completo de mergulho",
        "Máscara, snorkel e nadadeiras. Vários tamanhos disponíveis.",
        "sports",
        "paid",
        30.00,
        subcategory="water_sports",
    ),
    item(
        17,
        "Bike infantil aro 20",
        "Com rodinhas de apoio removíveis, ótima para crianças de 6-9 anos.",
        "sports",
        "paid",
        25.00,
        subcategory="cycling",
    ),
    item(
        17,
        "Patins inline profissional",
        "Vários números disponíveis, com kit de proteção incluso.",
        "sports",
        "paid",
        30.00,
        subcategory="fitness",
    ),
    item(
        17,
        "Skate longboard",
        "Ótimo para deslocamento urbano e passeios na orla.",
        "sports",
        "paid",
        25.00,
    ),
    item(
        17,
        "Kit de escalada indoor",
        "Arnês, cordas e mosquetões. Equipamento certificado.",
        "sports",
        "paid",
        45.00,
        subcategory="fitness",
    ),
    item(
        17,
        "Barraca de camping 6 pessoas",
        "Espaçosa, impermeável, ideal para famílias e grupos.",
        "sports",
        "paid",
        65.00,
        subcategory="camping",
    ),
    item(
        17,
        "Caiaque caribenho duplo",
        "Estável, ótimo para passeios em dupla no rio.",
        "sports",
        "paid",
        80.00,
        subcategory="water_sports",
    ),
    item(
        17,
        "Kit de pesca esportiva completo",
        "2 varas, molinetes, caixa de iscas e apetrechos.",
        "sports",
        "paid",
        35.00,
    ),
    item(
        17,
        "Bicicleta de montanha full suspension",
        "Aro 29, suspensão dianteira e traseira. Para trilhas pesadas.",
        "sports",
        "paid",
        75.00,
        subcategory="cycling",
    ),
    # ═══ Kids Festa Brinquedos (18) — toys / clothing ═══
    item(
        18,
        "Pula-pula inflável (cama elástica)",
        "4x4m, com rede de proteção. Inclui compressor.",
        "toys",
        "paid",
        180.00,
        subcategory="outdoor",
    ),
    item(
        18,
        "Piscina de bolinhas grande",
        "2x2m, com mais de 1000 bolinhas coloridas.",
        "toys",
        "paid",
        120.00,
        subcategory="outdoor",
    ),
    item(
        18,
        "Fantasia de princesa infantil (kit 5 modelos)",
        "Tamanhos variados de 2 a 8 anos, com acessórios.",
        "clothing",
        "paid",
        30.00,
        subcategory="costumes",
    ),
    item(
        18,
        "Fantasia de super-herói (kit 5 modelos)",
        "Homem-Aranha, Batman, Super-Homem e outros. Tam. infantil.",
        "clothing",
        "paid",
        30.00,
        subcategory="costumes",
    ),
    item(
        18,
        "Mesa de air hockey infantil",
        "Compacta, elétrica, ótima para festas e eventos.",
        "toys",
        "paid",
        60.00,
        subcategory="board_games",
    ),
    item(
        18,
        "Casa de boneca infantil grande",
        "Em MDF, 2 andares, com móveis inclusos.",
        "toys",
        "paid",
        50.00,
        subcategory="educational",
    ),
    item(
        18,
        "Brinquedos educativos Montessori (kit)",
        "10 peças variadas, estimulam coordenação e raciocínio.",
        "toys",
        "free",
        subcategory="educational",
    ),
    item(
        18,
        "Escorregador inflável",
        "3m de altura, com piscina de recepção. Inclui compressor.",
        "toys",
        "paid",
        150.00,
        subcategory="outdoor",
    ),
    item(
        18,
        "Kit de fantoches para teatro infantil",
        "12 personagens variados, com teatrinho dobrável.",
        "toys",
        "free",
        subcategory="educational",
    ),
    item(
        18,
        "Mini cozinha de brinquedo",
        "Com pia, fogão e utensílios. Ótima para brincadeiras de faz de conta.",
        "toys",
        "paid",
        40.00,
        subcategory="educational",
    ),
    item(
        18,
        "Carrinho elétrico infantil",
        "Bateria recarregável, controle remoto para os pais.",
        "toys",
        "paid",
        70.00,
        subcategory="outdoor",
    ),
    item(
        18,
        "Piscina inflável com escorregador",
        "3m, ótima para dias quentes no quintal.",
        "toys",
        "paid",
        90.00,
        subcategory="outdoor",
    ),
    item(
        18,
        "Fantasias temáticas para festa junina (kit 10 unidades)",
        "Tamanhos variados, prontas para a quadrilha.",
        "clothing",
        "paid",
        60.00,
        subcategory="costumes",
    ),
    # ═══ Cozinha Pro Equipamentos (19) — kitchen ═══
    item(
        19,
        "Chafing dish elétrico completo (3 cubas)",
        "Mantém alimentos quentes por horas. Capacidade 15L.",
        "kitchen",
        "paid",
        45.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Máquina de algodão doce",
        "Pronta para uso, inclui bastões e açúcar colorido.",
        "kitchen",
        "paid",
        50.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Máquina de pipoca profissional",
        "Estilo cinema, inclui milho e óleo para 2h de uso.",
        "kitchen",
        "paid",
        55.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Churrasqueira a gás portátil",
        "3 queimadores, ótima para eventos ao ar livre.",
        "kitchen",
        "paid",
        60.00,
    ),
    item(
        19,
        "Forno de pizza a lenha portátil",
        "Assa uma pizza em até 90 segundos.",
        "kitchen",
        "paid",
        80.00,
    ),
    item(
        19,
        "Geladeira/frigobar para eventos",
        "80L, ótima para manter bebidas geladas em festas.",
        "kitchen",
        "paid",
        40.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Batedeira industrial 20L",
        "Ideal para confeitaria e produção em grande escala.",
        "kitchen",
        "paid",
        70.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Fritadeira industrial de imersão",
        "Capacidade 10L, ótima para eventos e food trucks.",
        "kitchen",
        "paid",
        65.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Cafeteira industrial para eventos",
        "Prepara até 100 xícaras por hora.",
        "kitchen",
        "paid",
        45.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Espetos e grelha para churrasco (kit completo)",
        "20 espetos, grelha grande e pegadores.",
        "kitchen",
        "paid",
        30.00,
        subcategory="utensils",
    ),
    item(
        19,
        "Liquidificador industrial de alta rotação",
        "Copo de 4L, motor potente para grandes volumes.",
        "kitchen",
        "paid",
        35.00,
        subcategory="appliances",
    ),
    item(
        19,
        "Fondue elétrico completo (kit 6 pessoas)",
        "Com garfos e rechaud elétrico. Ideal para jantares especiais.",
        "kitchen",
        "paid",
        40.00,
        subcategory="utensils",
    ),
    item(
        19,
        "Sanduicheira e chapa industrial",
        "Ótima para lanches em grande quantidade em eventos.",
        "kitchen",
        "paid",
        35.00,
        subcategory="appliances",
    ),
]

# ── Groups ─────────────────────────────────────────────────────────────────────
# member_idxs[0] is the creator.

GROUPS = [
    {
        "name": "Vizinhos do Campo Grande",
        "description": (
            "Grupo para vizinhos de Campo Grande, Encruzilhada e Rosarinho "
            "compartilharem itens com segurança."
        ),
        "member_idxs": [0, 1, 2, 12, 13, 14, 15],
    },
    {
        "name": "Zona Norte Compartilha",
        "description": (
            "Empréstimos entre vizinhos de Hipódromo, Torreão, Água Fria, "
            "Campina do Barreto e Peixinhos."
        ),
        "member_idxs": [5, 6, 7, 8, 9, 18],
    },
    {
        "name": "Comunidade Arruda e Fundão",
        "description": (
            "Grupo local para moradores de Arruda, Fundão, Cajueiro e Beberibe."
        ),
        "member_idxs": [3, 4, 10, 11, 16, 19],
    },
]

# ── Review comment templates (loan scenarios are generated, not hand-listed) ───

REQ_COMMENTS = [
    ("{item} funcionou perfeitamente durante todo o período. Recomendo muito!", 5),
    ("Ótima experiência com {item}, tudo exatamente como no anúncio.", 5),
    ("{item} chegou limpo e em ótimo estado. Combinação fácil pelo chat.", 5),
    ("Gostei bastante de {item}, só achei o valor um pouco alto pelo tempo de uso.", 4),
    (
        "{item} atendeu bem, mas veio com um pequeno detalhe de uso não "
        "informado antes.",
        4,
    ),
    ("Sem reclamações! {item} em excelente estado e retirada tranquila.", 5),
    ("{item} salvou meu evento. Super recomendo o anúncio!", 5),
    ("Boa experiência no geral, {item} funcionou como esperado.", 4),
    ("{item} estava impecável, e a comunicação foi rápida do início ao fim.", 5),
]

OWNER_COMMENTS = [
    (
        "Devolveu {item} no prazo combinado e em ótimo estado. Recomendo "
        "como locatário(a)!",
        5,
    ),
    ("Combinação tranquila do início ao fim. {item} voltou limpo e organizado.", 5),
    ("Locatário(a) cuidadoso(a), {item} voltou impecável.", 5),
    ("Pontual na retirada e na devolução de {item}. Sem intercorrências.", 5),
    (
        "{item} voltou com um pequeno atraso, mas avisou com antecedência. "
        "Tudo certo no final.",
        4,
    ),
    ("Boa experiência, {item} devolvido em bom estado geral.", 4),
    ("Ótimo(a) locatário(a), {item} voltou como se estivesse novo(a).", 5),
]

LOAN_COUNT = 35

# ── Helpers ────────────────────────────────────────────────────────────────────


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def advance_request(req_id: str, owner_token: str, requester_token: str) -> bool:
    """accept → start (both sides confirm) → finish (both sides confirm) —
    pickup/return each require confirmation from both owner and requester
    since they became two-sided (see loan_request_service.lifecycle)."""
    r = requests.patch(
        f"{BASE}/requests/{req_id}/accept", headers=auth_header(owner_token)
    )
    if r.status_code not in (200, 201):
        print(f"    ✗ accept failed: {r.status_code} {r.text[:80]}")
        return False

    for action in ("start", "finish"):
        for token in (owner_token, requester_token):
            r = requests.patch(
                f"{BASE}/requests/{req_id}/{action}", headers=auth_header(token)
            )
            if r.status_code not in (200, 201):
                print(f"    ✗ {action} failed: {r.status_code} {r.text[:80]}")
                return False
    return True


def _verify_user_in_db(email: str) -> None:
    """Seed users bypass email verification via direct DB update."""
    import subprocess

    subprocess.run(
        [
            "docker",
            "exec",
            "lendly-mongo",
            "mongosh",
            "lendly",
            "--quiet",
            "--eval",
            f'db.users.updateOne({{email:"{email}"}},{{$set:{{is_verified:true}}}})',
        ],
        capture_output=True,
    )


# ── Seed ───────────────────────────────────────────────────────────────────────


def seed():
    # 1. Users
    tokens: list[str] = []
    print(
        f"Registering {len(USERS)} users ({BUSINESS_START_IDX} individuais + "
        f"{len(USERS) - BUSINESS_START_IDX} empresas)..."
    )
    for u in USERS:
        r = post_retrying(f"{BASE}/auth/register", json=u)
        if r.status_code == 201:
            _verify_user_in_db(u["email"])
            tokens.append(r.json()["access_token"])
            tag = "🏢" if u.get("account_type") == "business" else "  "
            print(f"  ✓ {tag} {u['name']}")
        elif r.status_code == 409:
            _verify_user_in_db(u["email"])
            r2 = post_retrying(
                f"{BASE}/auth/login",
                json={"email": u["email"], "password": u["password"]},
            )
            if r2.status_code == 200:
                tokens.append(r2.json()["access_token"])
                print(f"  ~ {u['name']} (já existia, login ok)")
            else:
                print(f"  ✗ {u['name']} — login falhou: {r2.text}")
        else:
            print(f"  ✗ {u['name']} — {r.status_code}: {r.text}")

    if len(tokens) < len(USERS):
        print("Atenção: nem todos os usuários foram obtidos.")
        return

    # 2. Items
    item_ids: list[str] = []
    print(f"\nCreating {len(ITEMS)} items...")
    for it in ITEMS:
        token = tokens[it["owner_idx"]]
        payload = {k: v for k, v in it.items() if k != "owner_idx"}
        r = requests.post(f"{BASE}/items/", json=payload, headers=auth_header(token))
        if r.status_code == 201:
            item_ids.append(r.json()["id"])
            print(f"  ✓ [{it['category']:12s}] {it['title'][:55]}")
        else:
            item_ids.append("")
            print(f"  ✗ {it['title'][:55]} — {r.status_code}: {r.text[:80]}")

    ok_items = sum(1 for x in item_ids if x)

    # 3. Groups
    print(f"\nCreating {len(GROUPS)} groups...")
    for g in GROUPS:
        creator_idx = g["member_idxs"][0]
        creator_token = tokens[creator_idx]
        r = requests.post(
            f"{BASE}/groups/",
            json={"name": g["name"], "description": g["description"]},
            headers=auth_header(creator_token),
        )
        if r.status_code != 201:
            print(f"  ✗ {g['name']} — {r.status_code}: {r.text[:80]}")
            continue
        group = r.json()
        invite_code = group["invite_code"]
        print(
            f"  ✓ {g['name']} (código: {invite_code}) — criado por "
            f"{USERS[creator_idx]['name']}"
        )
        for member_idx in g["member_idxs"][1:]:
            jr = requests.post(
                f"{BASE}/groups/join",
                json={"invite_code": invite_code},
                headers=auth_header(tokens[member_idx]),
            )
            if jr.status_code == 200:
                print(f"      + {USERS[member_idx]['name']}")
            else:
                print(
                    f"      ✗ {USERS[member_idx]['name']} não entrou: "
                    f"{jr.status_code} {jr.text[:60]}"
                )

    # 4. Loan requests + reviews (generated pairs, requester != owner)
    print(f"\nCreating {LOAN_COUNT} finished loan requests + reviews...")
    valid_positions = [i for i, iid in enumerate(item_ids) if iid]
    loan_ok = 0
    review_ok = 0
    days_ago = 70

    for _ in range(LOAN_COUNT):
        pos = random.choice(valid_positions)
        owner_idx = ITEMS[pos]["owner_idx"]
        candidates = [i for i in range(len(USERS)) if i != owner_idx]
        requester_idx = random.choice(candidates)

        item_id = item_ids[pos]
        item_title = ITEMS[pos]["title"]
        duration = random.randint(1, 5)
        days_ago -= random.randint(1, 3)
        if days_ago < 2:
            break

        pickup = past(days_ago)
        returndt = past(days_ago - duration)

        loan_payload = {
            "item_id": item_id,
            "pickup_date": iso(pickup),
            "expected_return_date": iso(returndt),
            "notes": "Solicitação gerada pelo seed de dados.",
        }

        r = requests.post(
            f"{BASE}/requests",
            json=loan_payload,
            headers=auth_header(tokens[requester_idx]),
        )
        if r.status_code not in (200, 201):
            print(f"  ✗ loan para '{item_title[:40]}': {r.status_code} {r.text[:80]}")
            continue

        loan_id = r.json()["id"]

        if not advance_request(loan_id, tokens[owner_idx], tokens[requester_idx]):
            print(f"  ✗ não foi possível finalizar loan {loan_id}")
            continue

        loan_ok += 1
        print(f"  ✓ {USERS[requester_idx]['name'][:20]:20s} → {item_title[:40]}")

        req_text, req_rating = random.choice(REQ_COMMENTS)
        r = requests.post(
            f"{BASE}/reviews/request/{loan_id}",
            json={"rating": req_rating, "comment": req_text.format(item=item_title)},
            headers=auth_header(tokens[requester_idx]),
        )
        if r.status_code == 201:
            review_ok += 1
            print(f"    ★ {req_rating}/5 (solicitante)")
        else:
            print(f"    ✗ review solicitante: {r.status_code} {r.text[:60]}")

        owner_text, owner_rating = random.choice(OWNER_COMMENTS)
        r = requests.post(
            f"{BASE}/reviews/request/{loan_id}",
            json={
                "rating": owner_rating,
                "comment": owner_text.format(item=item_title),
            },
            headers=auth_header(tokens[owner_idx]),
        )
        if r.status_code == 201:
            review_ok += 1
            print(f"    ★ {owner_rating}/5 (dono)")
        else:
            print(f"    ✗ review dono: {r.status_code} {r.text[:60]}")

    print(
        f"\nDone! {len(tokens)} usuários (5 empresas) · {ok_items} itens · "
        f"{len(GROUPS)} grupos · {loan_ok} empréstimos finalizados · "
        f"{review_ok} avaliações."
    )


if __name__ == "__main__":
    seed()
