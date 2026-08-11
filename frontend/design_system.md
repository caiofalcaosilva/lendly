# Design System — Lendly

Este documento descreve o sistema de design **efetivamente implementado** no código do frontend (`frontend/src/`). Ele não documenta um sistema teórico — cada token, componente e valor aqui existe hoje em `tailwind.config.ts`, `globals.css` e nos componentes de `components/ui/`.

## 1. Visão geral

**O que é:** Lendly é uma plataforma comunitária de empréstimo e aluguel de objetos entre vizinhos, no Brasil.

**Personalidade da marca:** comunidade, confiança, praticidade, sustentabilidade (compartilhar em vez de comprar). Não é uma fintech nem um marketplace genérico — é vizinhança.

**Princípios de design adotados nesta implementação:**
- Reaproveitar o que já funcionava (paleta verde, Inter, lucide-react, dark mode) em vez de trocar por modismo.
- Cor com função: verde é exclusivamente a cor de ação/marca; nunca decorativa em outro contexto (ver §3 e §10).
- Elevação (sombra) é reservada para o que está "por cima" de algo — overlay e hover — não para todo card em repouso.
- Nenhuma segunda tipografia: a personalidade de destaque vem de peso e rastreamento do próprio Inter, não de uma fonte nova para carregar.
- Todo estado de erro silencioso encontrado na auditoria recebeu feedback visível (toast) — ver §16.

## 2. Marca

**Conceito:** duas folhas espelhadas em rotação (`LogoMark`, em `components/ui/Logo.tsx`) em vez de uma folha estática — representa a circulação do item (sai, é usado, volta), não só "natureza/verde" genérico.

**Antes:** o favicon (`icon.svg`) e o ícone usado no navbar/footer (`lucide-react`'s `Leaf`) eram dois desenhos diferentes representando a marca ao mesmo tempo. Corrigido: os dois agora usam o mesmo `LogoMark`.

**Variantes:**
- `LogoMark` — só o símbolo, circular, dois tons de verde. Usado no favicon (`app/[locale]/icon.svg`) e nos cabeçalhos de tela de autenticação (login/registro/etc.).
- `Logo` — `LogoMark` + wordmark "Lendly" (Inter 800, `tracking-tight`, cor `text-primary`). Usado no navbar e no footer.

**Tamanho mínimo:** 16px (testado como favicon — silhueta sólida, sem traços finos, permanece legível).

**Espaço de proteção:** o símbolo é um círculo cheio; não recortar nem sobrepor texto sobre ele.

**Uso inadequado:** não recolorir o símbolo fora da dupla de tons de verde do tema; não usar `lucide-react`'s `Leaf` como substituto da marca em nenhum lugar novo.

**Cor de marca:** ver token `primary` em §3.

## 3. Sistema de cores

Definidos como variáveis CSS em `globals.css` (formato `"R G B"`, para suportar modificadores de opacidade do Tailwind) e expostos como cores do Tailwind em `tailwind.config.ts` (`bg-primary`, `text-ink`, `border-border/40`, etc.). Cada token já resolve corretamente em claro e escuro — a maioria dos componentes não precisa mais escrever `dark:` em paralelo.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `bg` | `#FBFAF6` | `#14170F` | fundo da página (`body`) |
| `surface` | `#FFFFFF` | `#1C2016` | cards, modais, navbar, inputs |
| `surface-2` | `#F1EFE6` | `#242A1E` | fundo sutil (hover, chip neutro, seção alternada) |
| `border` | `#E5E2D6` | `#2F3527` | borda padrão (decorativa — ver nota de contraste abaixo) |
| `border-strong` | `#929084` | `#6A7656` | borda de foco/hover — precisa ser identificável por si só, ver auditoria abaixo |
| `ink` | `#14170F` | `#F3F1E9` | texto principal |
| `ink-muted` | `#5B6152` | `#9BA290` | texto secundário |
| `ink-subtle` | `#707466` | `#8A937E` | texto terciário, ícones inertes |
| `primary` / `primary-hover` / `primary-active` | `#1F7A46` / `#1A6B3D` / `#155C35` | `#4FD182` / `#3DBF70` / `#2DA860` | ação primária, links, marca |
| `primary-subtle` | `#E3F0E7` | `#182D20` | fundo de chip/avatar sobre a cor da marca |
| `primary-on` | branco | `#0B140D` | texto sobre fundo `primary` (inverte no escuro porque o verde escuro fica claro) |
| `danger` / `danger-subtle` / `danger-on` | `#B4232B` / `#F7E3E1` / branco | `#F0605F` / `#2A1818` / `#0B140D` | erro, ação destrutiva. `-on` é o texto para usar **sobre** `bg-danger` sólido (botão, badge de contador) |
| `warning` / `warning-subtle` / `warning-on` | `#904D05` / `#FDF0D2` / branco | `#D99B5C` / `#2A2114` / `#0B140D` | aviso. `-on` é o texto sobre `bg-warning` sólido |
| `info` / `info-subtle` | `#1E4FBC` / `#E0EBFD` | `#60A5FA` / `#141E32` | informativo |
| `clay` / `clay-subtle` | `#8C5320` / `#F1E4D2` | `#D79B5C` / `#282016` | acento secundário — hoje só nos badges de "conquista" (§10) |
| `accent` / `accent-subtle` / `accent-on` | `#7E22CE` / `#F3E8FF` / branco | `#C084FC` / `#2A1C35` / `#0B140D` | acento administrativo — badge de admin, "visualizando como", verificação pendente na navbar, card de verificações pendentes no admin |
| `business` / `business-subtle` | `#4338CA` / `#EEF2FF` | `#818CF8` / `#1E1C3A` | marca de conta empresa (`BusinessBadge`, listagem em `/empresas`) |

**Paleta de categoria (item):** 10 tons fixos do Tailwind (`CATEGORY_COLORS` em `ItemCard.tsx`), todos na escala `-600`/`-50`. Regra: **nenhuma categoria usa o mesmo tom do token `primary`** — por isso "jardim" foi movido de `green` para `lime`, que colidia visualmente com botões/links.

**Cobertura:** todo o app (páginas, admin, modais e componentes de perfil/itens/solicitações) foi migrado para os tokens acima — ver §23 para os poucos casos deixados de fora de propósito.

> Uma segunda auditoria (rodada de verificação do roadmap, depois da declaração inicial de "migração concluída") encontrou **mais de 20 usos literais que tinham escapado da primeira varredura** — a maioria caixas de alerta (`bg-red-50`/`bg-blue-50` com borda e texto da mesma cor) duplicando um padrão que em todo o resto do app já usava `danger-subtle`/`info-subtle`, e um roxo/índigo usado de forma consistente (não pontual) em ~8 lugares sem token nenhum. Todos corrigidos — detalhe abaixo e em §23.

**Auditoria de contraste WCAG AA** — cada par texto/fundo e ícone/fundo realmente usado no código foi calculado (fórmula de luminância relativa do WCAG 2.1), em claro e escuro. Nesta rodada e na anterior, os seguintes tokens não passavam e foram escurecidos/aprofundados até passar, sem mudar a família de cor:

| Token | Antes | Depois | Motivo |
|---|---|---|---|
| `text-subtle` (claro) | `#8C9180` (3.1:1 no fundo) | `#707466` (4.6:1) | abaixo do mínimo de 4.5:1 pra texto — usado em legendas/contadores curtos, mas ainda é texto |
| `warning` (claro) | `#B46006` (4.36:1 no fundo, 4.02:1 sobre `warning-subtle`) | `#904D05` (6.2:1 / 5.7:1) | badge "aguardando pagamento" e afins ficavam no limite |
| `info` (claro) | `#2563EB` (4.30:1 sobre `info-subtle`) | `#1E4FBC` (6.0:1) | badge de status "em andamento" e contador de seleção no admin |
| `border-strong` (claro e escuro) | `#D1CDBD` / `#424A36` (~1.5:1) | `#929084` / `#6A7656` (≥3:1) | é a borda de foco/hover — por WCAG 1.4.11 (contraste não-textual), um indicador de estado precisa ser perceptível por si só |
| `text-white` sobre `bg-danger`/`bg-warning` sólido, **modo escuro** (`Button` danger, contador não lido do `NotificationBell`, badge de pendências do dashboard) | 3.21:1 / 2.39:1 — falhava | Criados `danger-on`/`warning-on` (mesma ideia de `primary-on`: branco no claro, quase-preto `#0B140D` no escuro, porque a cor de base vira clara no escuro) — 5.84:1 / 7.85:1 | achado na rodada de verificação: quem escreveu `text-white` direto no componente não sabia que `danger`/`warning` invertem de tom no escuro; passou pela primeira auditoria porque ela só calculou pares de *token*, não os `text-white` literais espalhados no código |

Ficou de fora de propósito (não é falha, é decisão documentada):
- **`border`** (não-`strong`) continua em ~1.3:1 nos dois temas — é a mesma prática de praticamente todo produto construído sobre Tailwind (inclusive o `border-gray-300` padrão). Ela nunca é o único jeito de identificar um campo: label, placeholder e o anel de foco (`focus:ring-primary`) já cumprem esse papel. Escurecer o suficiente pra passar 3:1 pesaria visualmente todo card/input em repouso — o trade-off deliberado foi manter os cards silenciosos e reservar contraste forte pra `border-strong`.
- **`text-subtle` sobre `surface-2`** (claro) fica em 4.16:1 — passa confortavelmente o mínimo de 3:1 pra UI/texto grande, mas fica pouco abaixo de 4.5:1 pra corpo de texto. Aceitável porque esse par só aparece em legendas curtas (contagem, distância, "há 2 dias") — nunca em texto corrido — e escurecer mais o suficiente pra fechar a diferença o deixaria visualmente igual a `text-muted`, perdendo o degrau entre os dois.

## 4. Tipografia

**Família única:** Inter (`next/font/google`, carregada em `layout.tsx`). Nenhuma segunda fonte foi adicionada — a hierarquia de destaque vem de peso + rastreamento, não de trocar de família.

| Papel | Tamanho | Peso | Rastreamento | Onde |
|---|---|---|---|---|
| Display | `text-4xl`/`text-5xl` | `font-extrabold` (800) | `tracking-tight` | hero da home, número "100%", `<h1>` de autenticação |
| Título de página | `text-2xl`/`text-3xl` | `font-bold`/`font-extrabold` | — | cabeçalhos de seção |
| Título de card | `text-sm`/`text-base` | `font-semibold` | — | `ItemCard`, cards de conteúdo |
| Corpo | `text-sm` | `font-normal` | — | texto de interface |
| Rótulo/eyebrow | `text-[10px]`/`text-xs` | `font-semibold` | `tracking-wide`/`uppercase` | tag de categoria, rótulo de campo |

## 5. Espaçamento

Nenhuma escala nova foi introduzida — a escala padrão do Tailwind (múltiplos de 4px: `gap-1`, `p-3`, `px-4`...) já era usada de forma consistente no código original. O problema nunca foi espaçamento; era cor, raio e sombra.

## 6. Layout

- Contêiner de página: `max-w-6xl` (navbar/footer) ou `max-w-4xl`/`max-w-5xl` (conteúdo), `mx-auto px-4`.
- Grade responsiva por `grid-cols-*` com breakpoints padrão do Tailwind (`sm`/`md`/`lg`).
- Sem alteração nos breakpoints padrão do Tailwind.

## 7. Raio (border-radius)

Três valores, cada um com um motivo — reduzidos de cinco valores concorrentes (`rounded-md/lg/xl/2xl` misturados sem critério):

| Token | Valor | Uso |
|---|---|---|
| `rounded-md` (padrão Tailwind, 6px) | 6px | tags pequenas, chips de categoria |
| `rounded-control` | 10px | botões, inputs, selects |
| `rounded-panel` | 16px | cards, modais, painéis |
| `rounded-full` | — | avatar, badge, pill — sempre circular |

## 8. Bordas

Cor única (`border`/`border-strong`, §3), espessura padrão `border` (1px) do Tailwind. Sem mudança de espessura.

## 9. Sombras

Dois níveis, definidos como variáveis CSS (`--shadow-elevated`, `--shadow-overlay` em `globals.css`) para variar entre claro/escuro sem duplicar a classe:

| Token | Uso |
|---|---|
| *(nenhuma)* | repouso — cards usam **borda**, não sombra |
| `shadow-elevated` | hover de card interativo, chip flutuante sobre imagem |
| `shadow-overlay` | modal, dropdown — o que está por cima de todo o resto |

## 10. Ícones

- Biblioteca única: `lucide-react`. Nenhuma outra biblioteca de ícones no projeto.
- Tamanhos usuais: `w-3`/`w-3.5` (badges), `w-4`/`w-5` (interface), `w-6`/`w-8` (destaque).
- Traço padrão da biblioteca (2px), sem customização.
- **Badges de reputação** (`ReputationBadges.tsx`): antes, 5 tons diferentes (índigo/verde/azul/âmbar/ciano) para dizer, na prática, a mesma coisa — "este vizinho é bom nisso". Agora, as 4 conquistas (confiável/pontual/bem avaliado/responde rápido) compartilham o tom `clay` e se diferenciam só por ícone e texto; "novo" passa a ser neutro (`surface-2`/`ink-muted`), porque não é uma conquista. O placar de confiabilidade (`ReliabilityBadge.tsx`) **mantém** verde/âmbar/vermelho — ali a cor é funcional (faixa de risco), não decorativa.

## 11. Botões (`components/ui/Button.tsx`)

| Variante | Uso |
|---|---|
| `primary` | ação principal da tela |
| `secondary` | ação principal secundária (fundo `primary-subtle`) |
| `outline` | ação alternativa |
| `ghost` | ação de baixa ênfase |
| `danger` | ação destrutiva |

Tamanhos `sm`/`md`/`lg`. Estado `loading` mostra `Spinner` e desabilita o botão. Foco: anel `focus:ring-2` na cor correspondente à variante.

## 12. Componentes de formulário

- **`Input`** — label, erro (borda + texto `danger`), texto de ajuda.
- **`PasswordInput`** (novo) — como `Input`, mas com botão de mostrar/ocultar senha (`Eye`/`EyeOff`), aplicado em login, registro, redefinir senha e trocar senha.
- **`CepField`** (novo, em `components/ui/CepField.tsx`) — campo de CEP com busca automática (ViaCEP), extraído de dentro de `AddressFields`/`LocationFields`, que eram **quase duplicados** (mesma lógica de busca, mesmo array de estados, mesma máscara, copiados entre os dois arquivos). Agora ambos usam o hook compartilhado `useCepLookup` (`lib/useCepLookup.ts`) e o mesmo `CepField` — a diferença real entre eles (endereço completo vs. só bairro, porque a localização de um item é pública e não coleta rua/número) continua existindo, só que sem duplicar código.
- **`Select`** e **`Textarea`** (novos, mesma API do `Input`: `label`/`error`/`helper`/`required`, `forwardRef`) — substituíram `<select>`/`<textarea>` estilizados à mão em 13 pontos: `admin/settings` (anúncio da plataforma), `groups/new` (descrição), `profile/page.tsx` (bio), `notifications/page.tsx` (filtro por tipo), `AddressFields`/`LocationFields` (estado), `ItemForm` (descrição, categoria, subcategoria, regras de uso, modo de endereço), `RequestModal` (observações), `ReportModal` (motivo + detalhes), `ReviewModal` (comentário). Não sobrou nenhum `<select>`/`<textarea>` cru fora desses dois componentes.

## 13. Navegação

- **Navbar** — sticky, com até 4 barras condicionais empilháveis (ver-como-admin, anúncio da plataforma, e-mail não verificado, identidade pendente) antes do conteúdo. Por isso existe o skip link (§21).
- **UserMenu** / **NotificationBell** — dropdown customizado, fecha ao clicar fora **e agora também com `Esc`** (`lib/useEscapeKey.ts`).
- **LanguageSwitcher** — não é um dropdown (alterna PT/EN direto no clique), por isso não precisa de gestão de teclado adicional.

## 14. Cards e superfícies

Card = `bg-surface` + `border border-border` + `rounded-panel`, sem sombra em repouso. Sombra (`shadow-elevated`) só aparece no hover de cards clicáveis (ex.: `ItemCard`, categorias da home). Não generalizamos cards para todo bloco de conteúdo — texto simples continua sem contêiner.

## 15. Tabelas e listagem

Sem alteração nesta rodada — já estavam corretas: tabelas do admin (`admin/users`, `admin/items`) já envolvem a tabela em `overflow-x-auto`, o padrão de paginação ("carregar mais") já era consistente entre as listas, e `EmptyState` já era usado de forma disseminada.

## 16. Feedback (toasts, confirmação, carregamento)

**Toast (`contexts/ToastContext.tsx`, `useToast()`)** — novo. `toast.success(title, description?)` / `toast.error(title, description?)`. Renderizado uma vez, no canto inferior (`fixed`, `aria-live="polite"`), com auto-dismiss em 5s e botão de fechar.

Aplicado nos 9 pontos que a auditoria encontrou falhando em silêncio (`try { await ação() } finally {}`, sem `catch`, ou sem `try` nenhum):

| Local | Ação |
|---|---|
| `ItemCard.tsx` | favoritar |
| `SessionsSection.tsx` | encerrar sessão |
| `NotificationPreferencesSection.tsx` | notificação por e-mail |
| `InAppNotificationPreferencesSection.tsx` | notificação in-app |
| `MercadoPagoConnectSection.tsx` | conectar Mercado Pago |
| `admin/categories/page.tsx` | ativar/desativar/renomear categoria e subcategoria |
| `admin/moderation/page.tsx` | aprovar/rejeitar denúncia |
| `admin/export/page.tsx` | exportar dados (sucesso *e* erro — é o único caso em que o sucesso não é visível por si só) |

Regra: toast de sucesso só onde o sucesso não é visível de outro jeito. Nos demais, a própria interface já confirma (o toggle mudou, a linha saiu da lista) — toast ali seria ruído.

Além dos 9: `ItemDetailClient.tsx` e `UserPublicClient.tsx` tinham cada um o próprio "toast" reinventado à mão — um `<div fixed>` com `useState`/`setTimeout(3000)` só para avisar "denúncia enviada". Os dois foram substituídos por `toast.success(...)`, removendo o estado e o efeito que existiam só para isso.

**Confirmação destrutiva (`components/ui/ConfirmDialog.tsx`)** — novo, construído sobre `Modal`. Substituiu o diálogo nativo do navegador (`window.confirm()`/`confirm()`) em **10 lugares** — a primeira varredura só buscou `window.confirm` e achou 3; uma segunda passada por `confirm(` sem prefixo revelou mais 7:

| Local | Ação(ões) |
|---|---|
| `admin/users/page.tsx` | ativar/desativar em massa, promover/remover admin |
| `admin/items/page.tsx` | ativar/desativar em massa |
| `items/[id]/ItemDetailClient.tsx` | remover item |
| `users/[id]/UserPublicClient.tsx` | remover avaliação (admin) |
| `profile/page.tsx` | pausar conta |
| `groups/[id]/page.tsx` | sair do grupo, excluir grupo, excluir grupo (admin), remover membro |

`items/[id]/ItemDetailClient.tsx` e `groups/[id]/page.tsx` também não tinham `catch` nas próprias ações (mesmo padrão de falha silenciosa do §16) — corrigido junto.

**Carregamento (`components/ui/Skeleton.tsx`)** — novo primitivo (`<Skeleton className="..." />`, um bloco pulsante que respeita `prefers-reduced-motion` via `motion-safe:animate-pulse`). Substituiu o `Spinner` de página inteira pelo formato real do conteúdo em 7 listas: `items/ItemsClient.tsx` (grade de cards — já existia como `SkeletonCard` local, mas sem `motion-safe`; refeito sobre o primitivo), `notifications/page.tsx`, `admin/users/page.tsx` e `admin/items/page.tsx` (linhas de tabela), `dashboard/page.tsx` (linha de item, a aba padrão), `groups/page.tsx`, `empresas/page.tsx`. O `Spinner` continua sendo o certo para os *gates* de autenticação (breves, tela cheia, sem conteúdo pra formatar) — não foi trocado nesses casos.

## 17. Diálogos e overlays (`components/ui/Modal.tsx`)

Achado mais importante da auditoria de acessibilidade: **o `Modal` compartilhado — usado por `RequestModal`, `ReviewModal`, `ReportModal`, `ExtensionModal`, `DeleteAccountModal`, `ChangeEmailModal`, `ChangePasswordModal`, `TotpSetupModal`, `TwoFactorModal` e `ConfirmDialog`** — não geria foco nenhum. Corrigido num único lugar, o que resolve todos os consumidores:

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para o título.
- `Esc` fecha o modal.
- `Tab`/`Shift+Tab` ficam presos dentro do modal (focus trap) — a página por trás do overlay não é mais alcançável por teclado.
- Foco vai para dentro do modal ao abrir e volta para o elemento que o abriu ao fechar.

## 18. Estados de interação

- Foco visível: `focus:ring-2` na cor do token relevante (`primary` na maioria, `danger` em ação destrutiva) — substituindo o cinza genérico do navegador.
- Hover: `motion-safe:hover:-translate-y-0.5` + `shadow-elevated` em cards interativos (não em todo lugar — só onde a interação é real).
- Desabilitado: `disabled:opacity-50 disabled:cursor-not-allowed` (`Button`).

## 19. Movimento

- Transições de cor/sombra: `transition-colors`/`transition-all duration-200`, sem alteração de timing.
- Efeitos de hover que envolvem transformação (`scale`, `translate`) agora são condicionados a `motion-safe:` (ex.: zoom da foto e elevação do `ItemCard`) — não disparam para quem definiu `prefers-reduced-motion: reduce`.
- Entrada do toast: `@keyframes toast-in`, também desativada em `prefers-reduced-motion: reduce`.
- Skip link: transição de posição desativada da mesma forma.

## 20. Responsivo

Sem alteração de breakpoints ou padrões de grade nesta rodada — o comportamento responsivo já auditado (navbar mobile, tabelas com `overflow-x-auto`, grades com `sm:`/`md:`) já estava correto.

## 21. Acessibilidade

Implementado nesta rodada:
- **Foco de modal** (§17) — o item de maior impacto.
- **Skip link** (`.skip-link` em `globals.css`, usado em `layout.tsx`) — "Ir para o conteúdo", visível só ao receber foco por teclado. Importante especificamente na Lendly porque o navbar pode empilhar até 4 barras condicionais antes do `<main>`.
- **`Esc` fecha** menus (`UserMenu`, `NotificationBell`) e modais.
- **`aria-label`** em botões-ícone antes cobertos só por `title` (favoritar, localizar no mapa, alternar tema, abrir/fechar menu mobile) — `title` sozinho não é anunciado de forma confiável por leitor de tela.
- **Mostrar/ocultar senha** com `aria-label` dinâmico.

Contraste formal WCAG AA de cada par de token foi auditado e corrigido — ver §3.

**Auditoria completa de `aria-*` em botões-ícone.** Escrito um parser (rastreia profundidade de `{...}` e limites de string para achar corretamente o fechamento de `<Button>`/`<button>` mesmo com `>` embutido em expressões como `count >= MAX`) que varreu toda a árvore em busca de botões cujo único conteúdo visível é um ícone, sem `aria-label`. Duas rodadas — a primeira só cobria `<button>` minúsculo e ficou com pontos cegos em componentes `<Button>` e em ícones renderizados via ternário (`{busy ? <Loader2/> : <Camera/>}`). A rodada final, mais rigorosa, fechou todos os casos restantes:
- `admin/users` (botão "ver como"), `admin/categories` (adicionar subcategoria) — só tinham ícone, nenhum nome acessível.
- `ItemDetailClient` — editar e excluir item (ícones sem `aria-label`; reaproveitadas chaves de tradução já existentes em vez de duplicar string).
- `groups/[id]` — confirmar vínculo ("vouch") e remover membro.
- `TotpSetupModal` — copiar código; `SessionsSection` — revogar sessão; `AvatarUploader` — trocar foto.
- `ItemFilters` — limpar busca (nova chave `clearSearch`) e limpar distância.
- `ItemPhotoUploader`/`ItemPhotoPicker` — remover/adicionar foto (esses dois componentes ainda não usam `next-intl`; `aria-label` foi adicionado em PT direto, no mesmo padrão do texto já hardcoded do arquivo, sem expandir o escopo para uma migração i18n completa deles).

Confirmado com zero ocorrências restantes por uma varredura final cobrindo `<button>`, `<Button>`, `<a>` e `<Link>`.

**Ordem de heading (`h1`→`h2`→`h3`, sem saltos).** Corrigidos:
- `EmptyState` (componente compartilhado usado como sub-heading em 15+ páginas) — `h3`→`h2`, resolvendo um salto sistêmico de uma tacada.
- `ItemsClient` — adicionado `h2` `sr-only` antes da grade de resultados (os `ItemCard` usam `h3` para o título do item e não tinham `h2` ancestral).
- Landing (`page.tsx`) — seções "chat" e "empresas" de `h3`→`h2`, alinhando com as seções irmãs.
- `dashboard` — "pessoas favoritas" de `h3`→`h2`.
- `profile` — "dados da conta" de `h3`→`h2` (estava fora de nível em relação a "informações pessoais"/"segurança"/"zona de risco").
- `ItemDetailClient` — "descrição"/"regras de uso" de `h3`→`h2`; estado "não encontrado" de `h2`→`h1`.
- `UserPublicClient` — estado "não encontrado" de `h2`→`h1`.
- `requests/[id]` — página não tinha nenhum `h1` (só o `h2` interno do `ChatPanel`); adicionado `h1` com o título do item.

Validado com `tsc --noEmit` e `rm -rf .next && npm run build` (53 páginas, sem erros) depois de cada lote.

## 22. Conteúdo

- Botão nomeia a ação, não o sistema ("Remover", não "Deletar registro").
- Mensagem de erro explica o que aconteceu e, quando possível, o que fazer ("Verifique sua conexão e tente de novo"), sem se desculpar nem ser vago.
- Confirmação destrutiva usa o mesmo verbo do botão que a originou (`ConfirmDialog` recebe `confirmLabel` explícito) — nunca um genérico "Confirmar" quando existe um verbo melhor.

## 23. Diretrizes para desenvolvimento

**Onde estão os tokens:** `frontend/src/app/globals.css` (variáveis CSS, claro/escuro) e `frontend/tailwind.config.ts` (exposição como classes Tailwind).

**Como usar:** prefira sempre o token semântico (`bg-surface`, `text-ink-muted`, `border-border`, `rounded-control`) a uma classe de cor/raio literal do Tailwind. Se o token que você precisa não existe, é sinal de que falta um token — não de que deve usar um valor literal.

**Quando criar um componente novo:** só quando o padrão se repete em 2+ lugares com risco real de divergir (foi o caso de `CepField` e `ConfirmDialog`). Não crie abstração para um único uso.

**Migração concluída.** Toda página em `app/[locale]/*` (incluindo as 10 subpáginas de `admin/`, `groups/*`, `empresas`, `notifications`, `requests/[id]`, `users/[id]`, `mercadopago/callback`, `items/new`, `items/[id]/edit`, e o miolo de `forgot-password`/`reset-password`/`verify-email`) e todo componente em `components/*` (modais — `ReportModal`, `RequestModal`, `ReviewModal`, `TwoFactorModal`, `TotpSetupModal`, `ExtensionModal`, `ChangeEmailModal`, `ChangePasswordModal` —, seções de perfil — `SessionsSection`, `MercadoPagoConnectSection`, `NotificationPreferencesSection`, `InAppNotificationPreferencesSection`, `IdentityVerificationSection`, `LoginHistorySection`, `ProfileCompleteness`, `AvatarUploader` —, `ItemPhotoPicker`/`Uploader`, `OnboardingChecklist`, `ReviewCard`, `ChatPanel`, `PixCheckout`, `NotificationBell`, `UserMenu`, `LanguageSwitcher`, `ReliabilityBadge`, e o miolo de `CepField`/`AddressFields`/`LocationFields`) usam os tokens acima. `npm run build` e `tsc --noEmit` limpos depois da migração completa.

Os bugs adicionais achados durante a varredura (segundo toast "na mão", mais 7 `confirm()` nativos) estão documentados em detalhe no §16.

**Deixado de fora de propósito** (não é migração pendente — é uma decisão):
- `ItemsMapView.tsx` — o **popup do marcador** no mapa Leaflet nunca teve suporte a dark mode (é conteúdo à parte da árvore React normal, injetado pelo Leaflet); trocar por tokens que respondem a tema criaria um comportamento novo não testado, não uma migração 1:1. Mantido literal. (O `<div>` que só *envolve* o mapa, esse sim é React normal — foi migrado para `border-border`/`rounded-panel` na rodada de verificação, ver abaixo.)
- `CATEGORY_COLORS` em `ItemCard.tsx` — as 10 cores de categoria (§3, mais os marcadores equivalentes em hex no `ItemsMapView.tsx`) são uma paleta decorativa por design, não tokens de tema.
- O coração de "favoritar" (`ItemCard.tsx`, `UserPublicClient.tsx`) usa `red-500` literal — é a convenção universal de "curtir", uma dimensão semântica diferente de `danger`.
- **Estrela de avaliação** (`fill-yellow-400 text-yellow-400`, ~9 lugares: `ItemCard`, `ItemDetailClient`, `UserPublicClient`, `dashboard`, `profile`, `empresas`, `ReviewModal`, `ReviewCard`) e o selo "destaque" (`bg-yellow-400 text-yellow-900` em `UserPublicClient`) — mesma lógica do coração: amarelo/dourado é a convenção universal de nota/destaque, não um estado do sistema (não é `warning`). Achada nesta rodada uma inconsistência real dentro da própria exceção — duas estrelas usavam `amber-400` em vez de `yellow-400` (`ItemCard.tsx`, `empresas/page.tsx`) — padronizado para `yellow-400` em todo lugar.
- `text-white` sobre uma **foto** ou overlay `bg-black/60` (controles sobre a imagem do item em `ItemCard`, `ItemPhotoUploader`/`Picker`, visualizador de documento em `admin/verification`) — correto ficar literal, porque o fundo não é um token de tema, é a própria foto. Diferente do bug corrigido acima: `text-white` sobre um **token** sólido (`bg-danger`/`bg-warning`) precisa ser `-on`, porque esses tokens invertem de tom no escuro; sobre uma foto isso não se aplica.

Bugs adicionais achados e corrigidos na rodada de verificação do roadmap (a primeira varredura tinha declarado "migração concluída" prematuramente):
- Caixas de alerta com `bg-red-50/bg-blue-50 border-red-200/blue-200 text-red-700/blue-800 rounded-lg`, duplicando à mão um padrão que o resto do app já resolvia com token — em `login`, `register` (erro de formulário), `DeleteAccountModal` (aviso + erro), `RequestCard` (aviso de extensão de prazo).
- `admin/users`, `register` (toggle pessoa/empresa), `ItemDetailClient` (indisponível) — `rounded-lg` esquecido onde a cor já era token.
- Roxo/índigo usado de forma consistente (não pontual) sem token em ~8 lugares — badge "admin" (`Badge.tsx`), ícone de "promovido a admin" (`admin/actions`), faixa "visualizando como" e faixa de verificação pendente (`Navbar`), card de verificações pendentes (`admin/dashboard`), `BusinessBadge`, cards de `/empresas`, contador "avaliações" no `dashboard`. Como era consistente e não um erro isolado, virou token de verdade — `accent` (admin/moderação) e `business` (conta empresa), ver §3 — em vez de só trocar pra uma cor já existente.
- `text-white` sobre `bg-danger`/`bg-warning` sólido em modo escuro (`Button` variante `danger`, contador do `NotificationBell`, badge de pendências do `dashboard`) — falhava contraste porque essas cores clareiam no escuro; corrigido com os novos tokens `danger-on`/`warning-on` (ver tabela de contraste em §3).
- `dashboard/page.tsx` — botão "tentar de novo" dentro da caixa de erro usava `text-red-600` solto ao lado de `text-danger` na mesma caixa; `ItemsClient.tsx` — ícone de erro de "carregar mais" usava `text-amber-500` em vez de `text-warning`.

Mapa de substituição mecânica usado (referência para qualquer código novo):

```
bg-white dark:bg-gray-800        → bg-surface
bg-white dark:bg-gray-900        → bg-surface
bg-gray-50 dark:bg-gray-800       → bg-surface-2
text-gray-900 dark:text-gray-100 → text-ink
text-gray-600/500 dark:text-gray-400 → text-ink-muted
text-gray-400 dark:text-gray-500  → text-ink-subtle
border-gray-200/300 dark:border-gray-600/700 → border-border
text-green-600 dark:text-green-400 → text-primary
bg-green-600                      → bg-primary + text-primary-on
hover:bg-green-700                → hover:bg-primary-hover
bg-green-100 dark:bg-green-900/40 → bg-primary-subtle
text-red-600 dark:text-red-400    → text-danger
bg-red-50 border-red-200 text-red-700 (caixa de alerta) → bg-danger-subtle border-danger/30 text-danger
bg-blue-50 border-blue-200 text-blue-800 (caixa de aviso) → bg-info-subtle border-info/30 text-info
text-white sobre bg-danger/bg-warning sólido → text-danger-on / text-warning-on
purple-*/indigo-* (admin, empresa)  → text-accent / bg-accent-subtle / text-business / bg-business-subtle
rounded-lg (botão/input)          → rounded-control
rounded-xl / rounded-2xl (card)   → rounded-panel
shadow-sm (repouso) + hover:shadow-md → sem sombra em repouso + hover:shadow-elevated
```

## 24. Fazer / Não fazer

**Faça**
- Use `bg-surface`/`text-ink`/`border-border` em vez de `bg-white dark:bg-gray-800` — menos código, mesmo resultado, já correto nos dois temas.
- Reserve sombra para hover e overlay; card em repouso leva borda.
- Dê `aria-label` a todo botão que só tem ícone.
- Toast de erro em toda ação assíncrona disparada fora de um formulário; erro de formulário continua inline.

**Não faça**
- Não invente uma quarta cor de raio — são três (`rounded-md`, `rounded-control`, `rounded-panel`) mais `rounded-full` para pills.
- Não use `window.confirm()` — use `ConfirmDialog`.
- Não use a cor `primary` (verde) para uma tag de categoria ou qualquer elemento que não seja ação/marca.
- Não adicione uma segunda família tipográfica para "destacar" um título — use peso e rastreamento do Inter.

---

**ESLint.** O projeto tinha `eslint`/`eslint-config-next` como dependência mas nenhum arquivo de config — `next lint` pedia para criar um do zero interativamente. Criado `.eslintrc.json` com `extends: "next/core-web-vitals"` (padrão do Next 14, sem regras extras). Rodar `npm run lint` revelou 2 erros reais (`react/no-unescaped-entities` — aspas retas dentro de texto JSX em `admin/moderation` e `RequestCard`, corrigidas para `&ldquo;`/`&rdquo;`) e 3 warnings de `react-hooks/exhaustive-deps` em `dashboard`, `ItemsClient` e `ItemDetailClient` — todos três eram exclusões intencionais de dependência (evitar refetch em toda renderização por causa de `t` não-memoizado, ou refetch em campos de `user`/`item` não relacionados à consulta), documentadas agora com `eslint-disable-next-line` + comentário explicando o motivo em vez de ficarem como warning silencioso. Também corrigido um `eslint-disable-next-line @next/next/no-img-element` em `ItemPhotoPicker` que estava posicionado uma linha acima do `<img>` real (não tinha efeito). `npm run lint` limpo (zero warnings/erros); `tsc --noEmit` e `npm run build` (53 páginas) também limpos.

**Verificação do roadmap (segunda passada).** Depois de declarar a migração "concluída", uma rodada dedicada a *verificar* essa afirmação (grep amplo por `-gray-`/`-red-`/`-blue-`/`-yellow-`/`-purple-`/`-indigo-`/`-amber-` literais, `rounded-lg`/`rounded-xl`/`shadow-sm` fora do padrão, e `text-white` sobre fundo sólido) achou os itens listados em §23 — a maioria caixas de alerta duplicando à mão um padrão já tokenizado em outro lugar, e um bug de contraste real (`text-white` sobre `danger`/`warning` no escuro) que a auditoria WCAG original não pegou porque só calculou pares de token, não literais soltos no JSX. Todos corrigidos; `tsc --noEmit`, `npm run build` e `npm run lint` limpos depois. Conclusão prática: "build limpo" não implica "nenhum literal escapou" — vale repetir esse tipo de grep amplo antes de declarar uma migração de cor encerrada.

Nenhum próximo passo pendente desta rodada de auditoria.
