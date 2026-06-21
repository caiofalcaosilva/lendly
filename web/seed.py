#!/usr/bin/env python3
"""
Seed script: 8 users + 50 items + 20 finished loan requests + ~35 reviews.
Run from the repo root:  python web/seed.py
Requires: pip install requests
"""

import requests
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:8000"


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def past(days: int) -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)


# ── Users ──────────────────────────────────────────────────────────────────────

USERS = [
    {
        "name": "Ana Carvalho",
        "email": "ana.carvalho@exemplo.com",
        "password": "senha123",
        "phone": "(11) 98765-4321",
        "zip_code": "01310-100",
        "street": "Avenida Paulista",
        "number": "1578",
        "complement": "Apto 42",
        "neighborhood": "Bela Vista",
        "city": "São Paulo",
        "state": "SP",
    },
    {
        "name": "Bruno Martins",
        "email": "bruno.martins@exemplo.com",
        "password": "senha123",
        "phone": "(21) 97654-3210",
        "zip_code": "20040-020",
        "street": "Avenida Rio Branco",
        "number": "200",
        "neighborhood": "Centro",
        "city": "Rio de Janeiro",
        "state": "RJ",
    },
    {
        "name": "Camila Souza",
        "email": "camila.souza@exemplo.com",
        "password": "senha123",
        "phone": "(31) 96543-2109",
        "zip_code": "30112-010",
        "street": "Rua dos Caetés",
        "number": "85",
        "neighborhood": "Centro",
        "city": "Belo Horizonte",
        "state": "MG",
    },
    {
        "name": "Diego Ferreira",
        "email": "diego.ferreira@exemplo.com",
        "password": "senha123",
        "phone": "(41) 95432-1098",
        "zip_code": "80010-020",
        "street": "Rua XV de Novembro",
        "number": "450",
        "neighborhood": "Centro",
        "city": "Curitiba",
        "state": "PR",
    },
    {
        "name": "Elena Rocha",
        "email": "elena.rocha@exemplo.com",
        "password": "senha123",
        "phone": "(51) 94321-0987",
        "zip_code": "90010-150",
        "street": "Rua dos Andradas",
        "number": "1234",
        "complement": "Sala 3",
        "neighborhood": "Centro Histórico",
        "city": "Porto Alegre",
        "state": "RS",
    },
    {
        "name": "Felipe Lima",
        "email": "felipe.lima@exemplo.com",
        "password": "senha123",
        "phone": "(85) 93210-9876",
        "zip_code": "60135-220",
        "street": "Avenida Beira Mar",
        "number": "3003",
        "neighborhood": "Meireles",
        "city": "Fortaleza",
        "state": "CE",
    },
    {
        "name": "Gabriela Nunes",
        "email": "gabriela.nunes@exemplo.com",
        "password": "senha123",
        "phone": "(71) 92109-8765",
        "zip_code": "40020-010",
        "street": "Avenida Sete de Setembro",
        "number": "777",
        "neighborhood": "Pelourinho",
        "city": "Salvador",
        "state": "BA",
    },
    {
        "name": "Hugo Pereira",
        "email": "hugo.pereira@exemplo.com",
        "password": "senha123",
        "phone": "(62) 91098-7654",
        "zip_code": "74015-010",
        "street": "Avenida Goiás",
        "number": "500",
        "complement": "Bloco B",
        "neighborhood": "Setor Central",
        "city": "Goiânia",
        "state": "GO",
    },
]

# ── Items ──────────────────────────────────────────────────────────────────────
# Items are distributed round-robin across users:
#   item[i] is owned by user[i % 8]

ITEMS = [
    # Tools (0–6) → users 0,1,2,3,4,5,6
    {"title": "Furadeira Bosch 650W com maleta", "description": "Furadeira de impacto em ótimo estado, acompanha 10 brocas e maleta original.", "category": "tools", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"]},
    {"title": "Serra circular DeWalt 7 ¼\"", "description": "Serra profissional, usada apenas 3 vezes. Inclui disco diamantado.", "category": "tools", "availability_type": "paid", "daily_rate": 35.00, "photos": ["https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600"]},
    {"title": "Nível a laser Tramontina", "description": "Nível laser com tripé. Perfeito para instalações e reformas.", "category": "tools", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600"]},
    {"title": "Parafusadeira a bateria Makita", "description": "2 baterias, carregador e estojo. Carga dura o dia todo.", "category": "tools", "availability_type": "paid", "daily_rate": 25.00, "photos": ["https://images.unsplash.com/photo-1560472355-536de3962603?w=600"]},
    {"title": "Esmerilhadeira angular 4½\"", "description": "Usada uma vez, com disco de corte e disco de desbaste extras.", "category": "tools", "availability_type": "paid", "daily_rate": 20.00, "photos": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]},
    {"title": "Betoneira elétrica 120 L", "description": "Ótima para pequenas obras. Capacidade 120 litros. Retirada no local.", "category": "tools", "availability_type": "paid", "daily_rate": 80.00, "photos": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600"]},
    {"title": "Lixadeira orbital 5\" Black+Decker", "description": "Com lixa de diferentes granulações incluídas.", "category": "tools", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600"]},
    # Electronics (7–13) → users 7,0,1,2,3,4,5
    {"title": "Projetor Epson 3500 lúmens", "description": "Full HD, HDMI. Tela de projeção de 2m inclusa. Ideal para eventos e apresentações.", "category": "electronics", "availability_type": "paid", "daily_rate": 120.00, "photos": ["https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600"]},
    {"title": "Caixa de som JBL Boombox 2", "description": "Som potente, bateria para 24h. Perfeita para festas ao ar livre.", "category": "electronics", "availability_type": "paid", "daily_rate": 60.00, "photos": ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600"]},
    {"title": "Drone DJI Mini 3 com câmera 4K", "description": "Voo de até 38 min, câmera 4K. Inclui 2 baterias e controle.", "category": "electronics", "availability_type": "paid", "daily_rate": 150.00, "photos": ["https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600"]},
    {"title": "Câmera mirrorless Sony A6400", "description": "Com lente kit 16-50mm. Perfeita para eventos e fotos profissionais.", "category": "electronics", "availability_type": "paid", "daily_rate": 200.00, "photos": ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600"]},
    {"title": "Notebook gamer para fins específicos", "description": "RTX 3060, 16GB RAM, SSD 512GB. Para uso em design ou edição de vídeo.", "category": "electronics", "availability_type": "paid", "daily_rate": 100.00, "photos": ["https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600"]},
    {"title": "iPad Pro 12.9\" com Apple Pencil", "description": "Para designers e artistas. Inclui case e carregador.", "category": "electronics", "availability_type": "paid", "daily_rate": 80.00, "photos": ["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600"]},
    {"title": "Ring Light 18\" com tripé", "description": "3 temperaturas de cor, controle remoto. Perfeita para gravações e fotos.", "category": "electronics", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=600"]},
    # Sports (14–19) → users 6,7,0,1,2,3
    {"title": "Bicicleta de montanha Caloi 29\"", "description": "21 velocidades, freio a disco. Em excelente estado. Capacete incluso.", "category": "sports", "availability_type": "paid", "daily_rate": 45.00, "photos": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]},
    {"title": "Prancha de surf 6'2\"", "description": "Shape tri-fin para ondas médias. Com capa protetora.", "category": "sports", "availability_type": "paid", "daily_rate": 30.00, "photos": ["https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600"]},
    {"title": "Kit de tênis de mesa completo", "description": "2 raquetes, 6 bolinhas e rede retrátil para mesa. Pronto para jogar.", "category": "sports", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1611251135345-18c56206b863?w=600"]},
    {"title": "Kayak inflável 2 lugares", "description": "Com remos, bomba de ar e bolsa de transporte. Ideal para rios calmos e lagoas.", "category": "sports", "availability_type": "paid", "daily_rate": 70.00, "photos": ["https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600"]},
    {"title": "Skate completo profissional", "description": "Shape 8.0, rodas Bones, rolamentos Reds. Para skatistas intermediários.", "category": "sports", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=600"]},
    {"title": "Kit de camping completo (2 pessoas)", "description": "Barraca 2 lugares, 2 sacos de dormir, colchão inflável. Para 3 noites.", "category": "sports", "availability_type": "paid", "daily_rate": 55.00, "photos": ["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600"]},
    # Garden (20–23) → users 4,5,6,7
    {"title": "Roçadeira elétrica 1200W", "description": "Corta grama e ervas daninhas. Fio de nylon extra incluso.", "category": "garden", "availability_type": "paid", "daily_rate": 30.00, "photos": ["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600"]},
    {"title": "Cortador de grama a gasolina", "description": "Motor 160cc, corte regulável. Para gramados de até 500m².", "category": "garden", "availability_type": "paid", "daily_rate": 50.00, "photos": ["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600"]},
    {"title": "Mangueira de jardim 30m + carrinho", "description": "Com bico regulável e suporte enrolador. Ótima para jardins e lavagens.", "category": "garden", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600"]},
    {"title": "Motosserra elétrica 35 cm", "description": "Para poda de árvores e corte de lenha. Inclui equipamentos de proteção.", "category": "garden", "availability_type": "paid", "daily_rate": 40.00, "photos": ["https://images.unsplash.com/photo-1547447134-cd3f5c716030?w=600"]},
    # Kitchen (24–29) → users 0,1,2,3,4,5
    {"title": "Batedeira planetária KitchenAid", "description": "Tigela 4,8L, 10 velocidades. Acessórios: gancho, batedor e raquete.", "category": "kitchen", "availability_type": "paid", "daily_rate": 50.00, "photos": ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600"]},
    {"title": "Chafing dish elétrico 3 cubas", "description": "Para manter alimentos quentes em eventos. Capacidade total 15L.", "category": "kitchen", "availability_type": "paid", "daily_rate": 45.00, "photos": ["https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600"]},
    {"title": "Máquina de waffle e crepe", "description": "2 em 1. Placas antiaderentes removíveis. Perfeita para brunch e festas.", "category": "kitchen", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600"]},
    {"title": "Sorveteira elétrica 1,5L", "description": "Faz sorvete em 20 minutos. Tigela interna para congelar antecipadamente.", "category": "kitchen", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600"]},
    {"title": "Cervejeira/adega 48 latas", "description": "Temperatura ajustável. Para festas e churrasco. Silenciosa.", "category": "kitchen", "availability_type": "paid", "daily_rate": 35.00, "photos": ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"]},
    {"title": "Air fryer Philips 5,7L", "description": "Capacidade família. Tira-gosto e almoços saudáveis. Limpa e conservada.", "category": "kitchen", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1593759608142-e9b58f000a53?w=600"]},
    # Books (30–33) → users 6,7,0,1
    {"title": "Coleção Harry Potter (7 volumes)", "description": "Edição brasileira Rocco, capa dura. Todos em ótimo estado.", "category": "books", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600"]},
    {"title": "Curso de Direito Civil — Flávio Tartuce (5 vols)", "description": "Edição 2022. Ideais para concursos e faculdade.", "category": "books", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600"]},
    {"title": "Box Senhor dos Anéis (3 volumes)", "description": "Tradução Lenita Esteves, Martins Fontes. Conservados.", "category": "books", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?w=600"]},
    {"title": "Livros de culinária (lote 8 livros)", "description": "Receitas brasileiras, italiana, japonesa e vegana. Todos com fotos.", "category": "books", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=600"]},
    # Toys (34–37) → users 2,3,4,5
    {"title": "Lego Technic Bugatti Chiron (3.599 peças)", "description": "Conjunto completo, já montado uma vez e desmontado com cuidado.", "category": "toys", "availability_type": "paid", "daily_rate": 25.00, "photos": ["https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600"]},
    {"title": "Videogame PlayStation 5 com 2 controles", "description": "Com jogos FIFA 24, God of War Ragnarök e Spider-Man 2.", "category": "toys", "availability_type": "paid", "daily_rate": 80.00, "photos": ["https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600"]},
    {"title": "Nintendo Switch OLED com 5 jogos", "description": "Mario Kart 8, Zelda BOTW, Mario Odyssey, Animal Crossing e Splatoon 3.", "category": "toys", "availability_type": "paid", "daily_rate": 60.00, "photos": ["https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600"]},
    {"title": "Mesa de sinuca mini 5 pés", "description": "Para ambientes internos. Completa com tacos, bolas e triângulo.", "category": "toys", "availability_type": "paid", "daily_rate": 40.00, "photos": ["https://images.unsplash.com/photo-1611251135345-18c56206b863?w=600"]},
    # Clothing (38–41) → users 6,7,0,1
    {"title": "Fantasia Mulher Maravilha adulto M/G", "description": "Alta qualidade, usada 1 vez. Acompanha tiara, pulseiras e laço.", "category": "clothing", "availability_type": "paid", "daily_rate": 30.00, "photos": ["https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600"]},
    {"title": "Smoking completo masculino (P/M)", "description": "Paletó, calça e gravata borboleta. Ideal para formaturas e casamentos.", "category": "clothing", "availability_type": "paid", "daily_rate": 70.00, "photos": ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600"]},
    {"title": "Vestido de festa longo dourado (38/40)", "description": "Um ombro só, com bordados. Perfeito para eventos sociais.", "category": "clothing", "availability_type": "paid", "daily_rate": 55.00, "photos": ["https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600"]},
    {"title": "Fantasia Astronauta criança (4-8 anos)", "description": "Com capacete, luvas e mochila simulada. Ótima qualidade.", "category": "clothing", "availability_type": "paid", "daily_rate": 20.00, "photos": ["https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600"]},
    # Furniture (42–45) → users 2,3,4,5
    {"title": "Mesa de jantar com 6 cadeiras", "description": "Em madeira maciça, 1,80m. Disponível para eventos e festas. Retirada no local.", "category": "furniture", "availability_type": "paid", "daily_rate": 90.00, "photos": ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600"]},
    {"title": "Cadeiras dobráveis (lote 20 un.)", "description": "Alumínio, suporte 120kg. Ideais para festas, eventos e confraternizações.", "category": "furniture", "availability_type": "paid", "daily_rate": 60.00, "photos": ["https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600"]},
    {"title": "Mesa bistrô alta + 4 banquetas", "description": "Estilo industrial. Perfeita para happy hour e eventos externos.", "category": "furniture", "availability_type": "paid", "daily_rate": 50.00, "photos": ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600"]},
    {"title": "Berço portátil (0-3 anos)", "description": "Desmontável, com colchonete lavável. Em excelente estado de conservação.", "category": "furniture", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1586105449897-20b5efeb3233?w=600"]},
    # Other (46–49) → users 6,7,0,1
    {"title": "Máquina de costura Singer Facilita", "description": "14 pontos, com acessórios. Ótima para iniciantes e reparos.", "category": "other", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1558171813-7cb24b1a1570?w=600"]},
    {"title": "Telescópio refrator 70mm", "description": "Com tripé, ocular 10mm e 25mm. Para observação lunar e planetária.", "category": "other", "availability_type": "paid", "daily_rate": 45.00, "photos": ["https://images.unsplash.com/photo-1446776709462-d6b525b9c0e0?w=600"]},
    {"title": "Carrinho de bebê Burigotto duplo", "description": "Para gêmeos ou irmãos próximos. Dobrável, com mosquiteiro.", "category": "other", "availability_type": "free", "photos": ["https://images.unsplash.com/photo-1586105449897-20b5efeb3233?w=600"]},
    {"title": "Andaime tubular 3m (2 módulos)", "description": "Capacidade 200kg. Ideal para pintura de fachadas e serviços em altura.", "category": "other", "availability_type": "paid", "daily_rate": 65.00, "photos": ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600"]},
]

# ── Loan + Review scenarios ────────────────────────────────────────────────────
# Each tuple:
#   (requester_idx, item_idx, days_ago_start, duration_days,
#    review_by_requester, review_by_owner)
#
# review_by_* is None (no review) or (rating, comment)
# item[i] is owned by user[i % 8]  →  requester_idx must != item_idx % 8

LOAN_SCENARIOS = [
    # requester=1(Bruno)  item=0(Ana's furadeira)
    (1, 0, 60, 3,
     (5, "Furadeira em perfeito estado e proprietária super atenciosa. Resolveu minha reforma com folga!"),
     (5, "Bruno devolveu no prazo e com o item impecável. Recomendo sem hesitar!")),

    # requester=2(Camila)  item=1(Bruno's serra)
    (2, 1, 55, 2,
     (4, "Serra funcionou muito bem, só havia um pequeno arranhão não mencionado. No geral, ótima experiência."),
     (5, "Camila cuidou da serra como se fosse dela. Devolveu limpa e no prazo combinado.")),

    # requester=3(Diego)  item=2(Camila's nível)
    (3, 2, 50, 1,
     (5, "Nível calibrado e funcionando perfeitamente. Camila foi muito solícita no combinado de retirada."),
     (5, "Diego foi pontual na retirada e na devolução. Perfeito!")),

    # requester=4(Elena)  item=3(Diego's parafusadeira)
    (4, 3, 48, 2,
     (5, "As duas baterias carregaram o dia todo. Excelente estado de conservação. Super recomendo!"),
     (4, "Elena devolveu no prazo, mas uma das baterias voltou com carga baixa. Sem problemas graves.")),

    # requester=5(Felipe)  item=4(Elena's esmerilhadeira)
    (5, 4, 45, 1,
     (5, "Exatamente como descrito. Elena respondeu rápido e o item veio com discos extras. Ótimo!"),
     (5, "Felipe foi extremamente cuidadoso. Devolveu com tudo no lugar.")),

    # requester=6(Gabriela)  item=5(Felipe's betoneira)
    (6, 5, 40, 4,
     (4, "Betoneira funcionou bem, mas estava um pouco suja na entrega. No geral, boa experiência."),
     (5, "Gabriela usou por 4 dias e devolveu em perfeito estado. Pagamento pontual.")),

    # requester=7(Hugo)  item=6(Gabriela's lixadeira)
    (7, 6, 38, 2,
     (5, "Lixadeira com todas as lixas. Acabamento da minha marcenaria ficou excelente. Obrigado!"),
     (5, "Hugo devolveu com as lixas novas repostas. Locatário exemplar!")),

    # requester=0(Ana)  item=7(Hugo's projetor)
    (0, 7, 35, 1,
     (5, "Projetor incrível! A tela inclusa fez toda a diferença na apresentação da empresa."),
     (5, "Ana cuidou do projetor com muito zelo. Devolveu tudo organizado na maleta.")),

    # requester=2(Camila)  item=8(Ana's caixa JBL)
    (2, 8, 30, 2,
     (5, "Caixa de som perfeita para a festa. Som potente e bateria durou as 24h prometidas!"),
     (4, "Camila devolveu com um dia de atraso mas avisou com antecedência. Tudo ok no final.")),

    # requester=3(Diego)  item=9(Bruno's drone)
    (3, 9, 28, 1,
     (4, "Drone excelente para fotos aéreas. Uma das baterias carregou menos que o esperado. No geral, ótimo!"),
     (5, "Diego é piloto experiente. Devolveu o drone sem nenhum arranhão.")),

    # requester=4(Elena)  item=10(Camila's câmera)
    (4, 10, 25, 3,
     (5, "Câmera top! As fotos do casamento ficaram profissionais. Camila foi super prestativa com dicas de uso."),
     (5, "Elena é fotógrafa talentosa. Devolveu a câmera e a lente impecáveis.")),

    # requester=5(Felipe)  item=11(Diego's notebook)
    (5, 11, 22, 5,
     (5, "Notebook rodou todos os softwares de edição sem travar. Perfeito para o projeto."),
     (5, "Felipe usou o notebook intensamente por 5 dias e devolveu em excelente estado.")),

    # requester=6(Gabriela)  item=12(Elena's iPad)
    (6, 12, 20, 2,
     (3, "iPad bom mas o Apple Pencil veio com a ponta desgastada. Elena foi atenciosa ao explicar."),
     (4, "Gabriela devolveu o iPad bem, mas esqueceu o cabo carregador e precisei buscar.")),

    # requester=7(Hugo)  item=13(Felipe's ring light)
    (7, 13, 18, 1,
     (5, "Ring light fez toda a diferença no meu vídeo de produto. Montagem simples e resultado profissional."),
     (5, "Hugo devolveu a ring light montada e limpa. Recomendo como locatário!")),

    # requester=0(Ana)  item=14(Gabriela's bicicleta)
    (0, 14, 15, 2,
     (5, "Bike em estado impecável. Capacete incluso foi um ótimo bônus. Passeio incrível na ciclovia!"),
     (5, "Ana devolveu a bicicleta lavada e com os pneus calibrados. Perfeita!")),

    # requester=1(Bruno)  item=15(Hugo's prancha de surf)
    (1, 15, 12, 3,
     (5, "Prancha perfeita para as ondas da praia do Leblon. Hugo deu ótimas dicas de locais."),
     (5, "Bruno surfou bem e devolveu a prancha sem um arranhão. Volte sempre!")),

    # requester=3(Diego)  item=16(Ana's kit tênis de mesa)
    (3, 16, 10, 4,
     (5, "Kit completo e em ótimo estado. Animou o happy hour da empresa!"),
     (5, "Diego devolveu tudo certinho, inclusive as bolinhas que haviam sumido. Ótimo locatário!")),

    # requester=4(Elena)  item=17(Bruno's kayak)
    (4, 17, 8, 2,
     (5, "Kayak fácil de inflar e super estável no lago. Acessórios completos. Recomendo muito!"),
     (5, "Elena devolveu o kayak seco, limpo e bem dobrado. Nota 10!")),

    # requester=5(Felipe)  item=18(Camila's skate)
    (5, 18, 6, 1,
     (4, "Skate em boas condições, os rolamentos fazem um leve barulho mas funcionam. Boa experiência."),
     (5, "Felipe devolveu o skate e deixou os rolamentos mais silenciosos ainda. Grato!")),

    # requester=6(Gabriela)  item=19(Diego's kit camping)
    (6, 19, 4, 3,
     (5, "Kit camping completo salvou minha trilha! Barraca fácil de montar e saco de dormir muito quentinho."),
     (5, "Gabriela devolveu tudo limpo e organizado nos sacos originais. Locatária exemplar!")),
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def advance_request(req_id: str, owner_token: str) -> bool:
    """accept → start → finish"""
    for action in ("accept", "start", "finish"):
        r = requests.patch(f"{BASE}/requests/{req_id}/{action}", headers=auth_header(owner_token))
        if r.status_code not in (200, 201):
            print(f"    ✗ {action} failed: {r.status_code} {r.text[:80]}")
            return False
    return True


# ── Seed ───────────────────────────────────────────────────────────────────────

def _verify_user_in_db(email: str) -> None:
    """Seed users bypass email verification via direct DB update."""
    import subprocess
    subprocess.run(
        ["docker", "exec", "lendly-mongo", "mongosh", "lendly", "--quiet", "--eval",
         f'db.users.updateOne({{email:"{email}"}},{{$set:{{is_verified:true}}}})'],
        capture_output=True,
    )


def seed():
    # 1. Users
    tokens: list[str] = []
    print(f"Registering {len(USERS)} users...")
    for u in USERS:
        r = requests.post(f"{BASE}/auth/register", json=u)
        if r.status_code == 201:
            # Mark verified immediately so login works on re-runs
            _verify_user_in_db(u["email"])
            tokens.append(r.json()["access_token"])
            print(f"  ✓ {u['name']}")
        elif r.status_code == 409:
            # Ensure existing user is verified before logging in
            _verify_user_in_db(u["email"])
            r2 = requests.post(f"{BASE}/auth/login", json={"email": u["email"], "password": u["password"]})
            if r2.status_code == 200:
                tokens.append(r2.json()["access_token"])
                print(f"  ~ {u['name']} (já existia, login ok)")
            else:
                print(f"  ✗ {u['name']} — login falhou: {r2.text}")
        else:
            print(f"  ✗ {u['name']} — {r.status_code}: {r.text}")

    if len(tokens) < len(USERS):
        print("Atenção: nem todos os usuários foram obtidos.")

    # 2. Items
    item_ids: list[str] = []
    print(f"\nCreating {len(ITEMS)} items...")
    for i, item in enumerate(ITEMS):
        token = tokens[i % len(tokens)]
        r = requests.post(f"{BASE}/items", json=item, headers=auth_header(token))
        if r.status_code == 201:
            item_ids.append(r.json()["id"])
            print(f"  ✓ [{item['category']:12s}] {item['title'][:55]}")
        else:
            item_ids.append("")
            print(f"  ✗ {item['title'][:55]} — {r.status_code}: {r.text[:80]}")

    # 3. Loan requests + reviews
    print(f"\nCreating {len(LOAN_SCENARIOS)} finished loan requests + reviews...")
    loan_ok = 0
    review_ok = 0

    for (req_idx, item_idx, days_ago, duration, rev_req, rev_owner) in LOAN_SCENARIOS:
        item_id = item_ids[item_idx] if item_idx < len(item_ids) else ""
        if not item_id:
            print(f"  ✗ item[{item_idx}] sem ID, pulando")
            continue

        owner_idx = item_idx % len(tokens)
        requester_token = tokens[req_idx]
        owner_token = tokens[owner_idx]

        pickup = past(days_ago)
        returndt = past(days_ago - duration)

        loan_payload = {
            "item_id": item_id,
            "pickup_date": iso(pickup),
            "expected_return_date": iso(returndt),
            "notes": "Solicitação gerada pelo seed de dados.",
        }

        r = requests.post(f"{BASE}/requests", json=loan_payload, headers=auth_header(requester_token))
        if r.status_code not in (200, 201):
            print(f"  ✗ loan para item[{item_idx}]: {r.status_code} {r.text[:80]}")
            continue

        loan_id = r.json()["id"]
        item_title = r.json()["item_title"]

        if not advance_request(loan_id, owner_token):
            print(f"  ✗ não foi possível finalizar loan {loan_id}")
            continue

        loan_ok += 1
        print(f"  ✓ {USERS[req_idx]['name'][:12]:12s} → {item_title[:40]}")

        # Review pelo solicitante
        if rev_req:
            rating, comment = rev_req
            r = requests.post(
                f"{BASE}/reviews/request/{loan_id}",
                json={"rating": rating, "comment": comment},
                headers=auth_header(requester_token),
            )
            if r.status_code == 201:
                review_ok += 1
                print(f"    ★ {rating}/5 (solicitante) — \"{comment[:50]}...\"")
            else:
                print(f"    ✗ review solicitante: {r.status_code} {r.text[:60]}")

        # Review pelo dono
        if rev_owner:
            rating, comment = rev_owner
            r = requests.post(
                f"{BASE}/reviews/request/{loan_id}",
                json={"rating": rating, "comment": comment},
                headers=auth_header(owner_token),
            )
            if r.status_code == 201:
                review_ok += 1
                print(f"    ★ {rating}/5 (dono)       — \"{comment[:50]}...\"")
            else:
                print(f"    ✗ review dono: {r.status_code} {r.text[:60]}")

    print(f"\nDone! {len(tokens)} usuários · {sum(1 for x in item_ids if x)} itens · {loan_ok} empréstimos finalizados · {review_ok} avaliações.")


if __name__ == "__main__":
    seed()
