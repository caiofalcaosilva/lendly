# Design System — Lendly

Este documento descreve o sistema de design **efetivamente implementado** no código do frontend (`frontend/src/`). Cada token, componente e valor aqui existe hoje em `tailwind.config.ts`, `globals.css` e nos componentes de `components/ui/`.

## 1. Visão geral

**O que é:** Lendly é uma plataforma comunitária de empréstimo e aluguel de objetos entre vizinhos, no Brasil.

**Personalidade da marca:** comunidade, confiança, praticidade, sustentabilidade (compartilhar em vez de comprar). Não é uma fintech nem um marketplace genérico — é vizinhança.

**Princípios de design:**
- Cor com função: verde é exclusivamente a cor de ação/marca; nunca decorativa em outro contexto (ver §3 e §10).
- Elevação (sombra) é reservada para o que está "por cima" de algo — overlay e hover — não para todo card em repouso.
- Nenhuma segunda tipografia: a personalidade de destaque vem de peso e rastreamento do próprio Inter, não de uma fonte nova.
- Todo estado assíncrono que pode falhar em silêncio dá feedback visível (toast) — ver §16.

## 2. Marca

**Conceito:** duas folhas espelhadas em rotação (`LogoMark`, em `components/ui/Logo.tsx`) em vez de uma folha estática — representa a circulação do item (sai, é usado, volta), não só "natureza/verde" genérico.

**Variantes:**
- `LogoMark` — só o símbolo, circular, dois tons de verde. Usado no favicon (`app/[locale]/icon.svg`) e nos cabeçalhos de tela de autenticação (login/registro/etc.).
- `Logo` — `LogoMark` + wordmark "Lendly" (Inter 800, `tracking-tight`, cor `text-primary`). Usado no navbar e no footer.

**Tamanho mínimo:** 16px (testado como favicon — silhueta sólida, sem traços finos, permanece legível).

**Espaço de proteção:** o símbolo é um círculo cheio; não recortar nem sobrepor texto sobre ele.

**Uso inadequado:** não recolorir o símbolo fora da dupla de tons de verde do tema; não usar `lucide-react`'s `Leaf` como substituto da marca em nenhum lugar.

**Cor de marca:** ver token `primary` em §3.

## 3. Sistema de cores

Definidos como variáveis CSS em `globals.css` (formato `"R G B"`, para suportar modificadores de opacidade do Tailwind) e expostos como cores do Tailwind em `tailwind.config.ts` (`bg-primary`, `text-ink`, `border-border/40`, etc.). Cada token resolve corretamente em claro e escuro — componentes não precisam escrever `dark:` em paralelo.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `bg` | `#FBFAF6` | `#14170F` | fundo da página (`body`) |
| `surface` | `#FFFFFF` | `#1C2016` | cards, modais, navbar, inputs |
| `surface-2` | `#F1EFE6` | `#242A1E` | fundo sutil (hover, chip neutro, seção alternada) |
| `border` | `#E5E2D6` | `#2F3527` | borda padrão (decorativa — ver nota de contraste abaixo) |
| `border-strong` | `#929084` | `#6A7656` | borda de foco/hover — precisa ser identificável por si só |
| `ink` | `#14170F` | `#F3F1E9` | texto principal |
| `ink-muted` | `#5B6152` | `#9BA290` | texto secundário |
| `ink-subtle` | `#707466` | `#8A937E` | texto terciário, ícones inertes |
| `primary` / `primary-hover` / `primary-active` | `#1F7A46` / `#1A6B3D` / `#155C35` | `#4FD182` / `#3DBF70` / `#2DA860` | ação primária, links, marca |
| `primary-subtle` | `#E3F0E7` | `#182D20` | fundo de chip/avatar sobre a cor da marca |
| `primary-on` | branco | `#0B140D` | texto sobre fundo `primary` sólido (inverte no escuro porque o verde escuro fica claro) |
| `danger` / `danger-subtle` / `danger-on` | `#B4232B` / `#F7E3E1` / branco | `#F0605F` / `#2A1818` / `#0B140D` | erro, ação destrutiva. `-on` é o texto sobre `bg-danger` sólido (botão, badge de contador) |
| `warning` / `warning-subtle` / `warning-on` | `#904D05` / `#FDF0D2` / branco | `#D99B5C` / `#2A2114` / `#0B140D` | aviso. `-on` é o texto sobre `bg-warning` sólido |
| `info` / `info-subtle` | `#1E4FBC` / `#E0EBFD` | `#60A5FA` / `#141E32` | informativo |
| `clay` / `clay-subtle` | `#8C5320` / `#F1E4D2` | `#D79B5C` / `#282016` | acento secundário — badges de "conquista" (§10) |
| `accent` / `accent-subtle` / `accent-on` | `#7E22CE` / `#F3E8FF` / branco | `#C084FC` / `#2A1C35` / `#0B140D` | acento administrativo — badge de admin, "visualizando como", verificação pendente na navbar, card de verificações pendentes no admin |
| `business` / `business-subtle` | `#4338CA` / `#EEF2FF` | `#818CF8` / `#1E1C3A` | marca de conta empresa (`BusinessBadge`, listagem em `/empresas`) |

**Paleta de categoria (item):** 10 tons fixos do Tailwind (`CATEGORY_COLORS` em `ItemCard.tsx`), todos na escala `-600`/`-50`. Regra: **nenhuma categoria usa o mesmo tom do token `primary`**.

**Exceções intencionais** (não usam token — decisão documentada, não lacuna):
- `ItemsMapView.tsx` — o **popup do marcador** no mapa Leaflet é conteúdo injetado fora da árvore React normal e nunca teve suporte a dark mode; mantido em cinza literal. (O `<div>` que envolve o mapa é React normal e usa `border-border`/`rounded-panel`.)
- `CATEGORY_COLORS` (acima) e os marcadores equivalentes em `ItemsMapView.tsx` — paleta decorativa por design, não tokens de tema.
- Coração de "favoritar" (`ItemCard.tsx`, `UserPublicClient.tsx`) — `red-500` literal, convenção universal de "curtir", dimensão semântica diferente de `danger`.
- Estrela de avaliação (`fill-yellow-400 text-yellow-400`) e o selo "destaque" — amarelo/dourado é convenção universal de nota/destaque, não um estado do sistema (não é `warning`).
- `text-white` sobre uma **foto** ou overlay `bg-black/60` (controles sobre imagem em `ItemCard`, `ItemPhotoUploader`/`Picker`, visualizador de documento em `admin/verification`) — correto ficar literal porque o fundo é a própria foto, não um token que muda de tom por tema. Diferente de `text-white` sobre um **token** sólido (`bg-danger`/`bg-warning`), que deve usar `-on` porque esses tokens invertem de tom no escuro.

**Contraste WCAG AA** — todo par token de texto/ícone sobre token de fundo realmente usado no código atende ao mínimo (4.5:1 texto, 3:1 UI/não-textual), calculado pela fórmula de luminância relativa do WCAG 2.1. `border-strong` (borda de foco/hover) atende ao mínimo de 3:1 exigido pelo critério 1.4.11 para indicadores de estado não-textuais.

Ficou fora de propósito (decisão deliberada, não falha):
- **`border`** (não-`strong`) fica em ~1.3:1 nos dois temas — mesma prática de praticamente todo produto construído sobre Tailwind. Nunca é o único jeito de identificar um campo: label, placeholder e o anel de foco (`focus:ring-primary`) cumprem esse papel. O trade-off deliberado é manter cards/inputs silenciosos em repouso e reservar contraste forte para `border-strong`.
- **`text-subtle` sobre `surface-2`** (claro) fica em 4.16:1 — passa confortavelmente o mínimo de 3:1 para UI/texto grande, mas fica pouco abaixo de 4.5:1 para corpo de texto. Aceitável porque esse par só aparece em legendas curtas (contagem, distância, "há 2 dias"), nunca em texto corrido.

## 4. Tipografia

**Família única:** Inter (`next/font/google`, carregada em `layout.tsx`). Nenhuma segunda fonte — a hierarquia de destaque vem de peso + rastreamento, não de trocar de família.

| Papel | Tamanho | Peso | Rastreamento | Onde |
|---|---|---|---|---|
| Display | `text-4xl`/`text-5xl` | `font-extrabold` (800) | `tracking-tight` | hero da home, número "100%", `<h1>` de autenticação |
| Título de página | `text-2xl`/`text-3xl` | `font-bold`/`font-extrabold` | — | cabeçalhos de seção |
| Título de card | `text-sm`/`text-base` | `font-semibold` | — | `ItemCard`, cards de conteúdo |
| Corpo | `text-sm` | `font-normal` | — | texto de interface |
| Rótulo/eyebrow | `text-[10px]`/`text-xs` | `font-semibold` | `tracking-wide`/`uppercase` | tag de categoria, rótulo de campo |

## 5. Espaçamento

Escala padrão do Tailwind (múltiplos de 4px: `gap-1`, `p-3`, `px-4`...), usada de forma consistente em todo o app. Sem escala customizada.

## 6. Layout

- Contêiner de página: `max-w-6xl` (navbar/footer) ou `max-w-4xl`/`max-w-5xl` (conteúdo), `mx-auto px-4`.
- Grade responsiva por `grid-cols-*` com breakpoints padrão do Tailwind (`sm`/`md`/`lg`).
- Sem alteração nos breakpoints padrão do Tailwind.

## 7. Raio (border-radius)

Três valores, cada um com um propósito definido:

| Token | Valor | Uso |
|---|---|---|
| `rounded-md` (padrão Tailwind) | 6px | tags pequenas, chips de categoria |
| `rounded-control` | 10px | botões, inputs, selects |
| `rounded-panel` | 16px | cards, modais, painéis |
| `rounded-full` | — | avatar, badge, chip de linha única, pill — sempre circular |

Não usar `rounded-lg`/`rounded-xl`/`rounded-2xl` — sempre um dos tokens acima.

## 8. Bordas

Cor única (`border`/`border-strong`, §3), espessura padrão `border` (1px) do Tailwind.

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
- **Badges de reputação** (`ReputationBadges.tsx`): as 4 conquistas (confiável/pontual/bem avaliado/responde rápido) compartilham o tom `clay`, diferenciadas só por ícone e texto; "novo" é neutro (`surface-2`/`ink-muted`) porque não é uma conquista. O placar de confiabilidade (`ReliabilityBadge.tsx`) usa verde/âmbar/vermelho de forma funcional (faixa de risco), não decorativa — essa é a exceção deliberada à regra de "verde só como marca".

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
- **`PasswordInput`** — como `Input`, com botão de mostrar/ocultar senha (`Eye`/`EyeOff`). Usado em login, registro, redefinir senha e trocar senha.
- **`CepField`** (`components/ui/CepField.tsx`) — campo de CEP com busca automática (ViaCEP), sobre o hook compartilhado `useCepLookup` (`lib/useCepLookup.ts`). Usado por `AddressFields` (endereço completo) e `LocationFields` (só bairro, para localização pública de item).
- **`Select`** e **`Textarea`** — mesma API do `Input` (`label`/`error`/`helper`/`required`, `forwardRef`). Todo `<select>`/`<textarea>` do app usa um desses dois componentes; não há elementos nativos estilizados à mão.

## 13. Navegação

- **Navbar** — sticky, com até 4 barras condicionais empilháveis (ver-como-admin, anúncio da plataforma, e-mail não verificado, identidade pendente) antes do conteúdo. Por isso existe o skip link (§21).
- **UserMenu** / **NotificationBell** — dropdown customizado, fecha ao clicar fora ou com `Esc` (`lib/useEscapeKey.ts`).
- **LanguageSwitcher** — não é um dropdown (alterna PT/EN direto no clique).

## 14. Cards e superfícies

Card = `bg-surface` + `border border-border` + `rounded-panel`, sem sombra em repouso. Sombra (`shadow-elevated`) só aparece no hover de cards clicáveis (ex.: `ItemCard`, categorias da home). Texto simples continua sem contêiner — nem todo bloco de conteúdo vira card.

## 15. Tabelas e listagem

Tabelas do admin (`admin/users`, `admin/items`) envolvem a tabela em `overflow-x-auto` para rolagem horizontal em telas pequenas. Padrão de paginação consistente entre listas ("carregar mais"). `EmptyState` usado de forma disseminada para listas vazias.

## 16. Feedback (toasts, confirmação, carregamento)

**Toast (`contexts/ToastContext.tsx`, `useToast()`)** — `toast.success(title, description?)` / `toast.error(title, description?)`. Renderizado uma vez, no canto inferior (`fixed`, `aria-live="polite"`), com auto-dismiss em 5s e botão de fechar.

Regra: toast de sucesso só onde o sucesso não é visível de outro jeito (ex.: exportar dados). Quando a própria interface já confirma a ação (o toggle mudou, a linha saiu da lista), toast ali seria ruído — usar toast só de erro nesse caso.

**Confirmação destrutiva (`components/ui/ConfirmDialog.tsx`)** — construído sobre `Modal`. É o único mecanismo de confirmação destrutiva do app; nunca usar o diálogo nativo do navegador (`window.confirm()`).

**Carregamento (`components/ui/Skeleton.tsx`)** — `<Skeleton className="..." />`, bloco pulsante que respeita `prefers-reduced-motion` via `motion-safe:animate-pulse`. Usado no formato real do conteúdo em listas (grades de card, linhas de tabela). `Spinner` é reservado para os *gates* de autenticação (breves, tela cheia, sem conteúdo pra formatar).

## 17. Diálogos e overlays (`components/ui/Modal.tsx`)

`Modal` é a base compartilhada por todos os diálogos do app (`RequestModal`, `ReviewModal`, `ReportModal`, `ExtensionModal`, `DeleteAccountModal`, `ChangeEmailModal`, `ChangePasswordModal`, `TotpSetupModal`, `TwoFactorModal`, `ConfirmDialog`). Comportamento de acessibilidade, implementado num único lugar:

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para o título.
- `Esc` fecha o modal.
- `Tab`/`Shift+Tab` ficam presos dentro do modal (focus trap) — a página por trás do overlay não é alcançável por teclado.
- Foco vai para dentro do modal ao abrir e volta para o elemento que o abriu ao fechar.

## 18. Estados de interação

- Foco visível: `focus:ring-2` na cor do token relevante (`primary` na maioria, `danger` em ação destrutiva) — nunca o anel genérico do navegador.
- Hover: `motion-safe:hover:-translate-y-0.5` + `shadow-elevated` em cards interativos, só onde a interação é real.
- Desabilitado: `disabled:opacity-50 disabled:cursor-not-allowed` (`Button`).

## 19. Movimento

- Transições de cor/sombra: `transition-colors`/`transition-all duration-200`.
- Efeitos de hover que envolvem transformação (`scale`, `translate`, ex.: zoom da foto e elevação do `ItemCard`) são condicionados a `motion-safe:` — não disparam para quem definiu `prefers-reduced-motion: reduce`.
- Entrada do toast (`@keyframes toast-in`) e transição de posição do skip link seguem a mesma regra.

## 20. Responsivo

Sem breakpoints customizados — os padrão do Tailwind (`sm`/`md`/`lg`). Navbar colapsa para menu mobile; tabelas do admin usam `overflow-x-auto`; grades usam `sm:`/`md:` para número de colunas.

## 21. Acessibilidade

- **Foco de modal** — focus trap + restauração de foco, ver §17.
- **Skip link** (`.skip-link` em `globals.css`, usado em `layout.tsx`) — "Ir para o conteúdo", visível só ao receber foco por teclado. Importante porque o navbar pode empilhar até 4 barras condicionais antes do `<main>`.
- **`Esc` fecha** menus (`UserMenu`, `NotificationBell`) e modais.
- **`aria-label`** em todo botão cujo único conteúdo visível é um ícone — `title` sozinho não é anunciado de forma confiável por leitor de tela.
- **Mostrar/ocultar senha** com `aria-label` dinâmico.
- **Contraste WCAG AA** de cada par token de texto/ícone sobre fundo — ver §3.
- **Ordem de heading** sem saltos (`h1`→`h2`→`h3`) em toda página.

## 22. Conteúdo

- Botão nomeia a ação, não o sistema ("Remover", não "Deletar registro").
- Mensagem de erro explica o que aconteceu e, quando possível, o que fazer ("Verifique sua conexão e tente de novo"), sem se desculpar nem ser vago.
- Confirmação destrutiva usa o mesmo verbo do botão que a originou (`ConfirmDialog` recebe `confirmLabel` explícito) — nunca um genérico "Confirmar" quando existe um verbo melhor.

## 23. Diretrizes para desenvolvimento

**Onde estão os tokens:** `frontend/src/app/globals.css` (variáveis CSS, claro/escuro) e `frontend/tailwind.config.ts` (exposição como classes Tailwind).

**Como usar:** prefira sempre o token semântico (`bg-surface`, `text-ink-muted`, `border-border`, `rounded-control`) a uma classe de cor/raio literal do Tailwind. Se o token que você precisa não existe, é sinal de que falta um token — não de que deve usar um valor literal. Ver §3 para as exceções intencionais em que cor literal é a escolha certa.

**Quando criar um componente novo:** só quando o padrão se repete em 2+ lugares com risco real de divergir (foi o caso de `CepField` e `ConfirmDialog`). Não crie abstração para um único uso.

**Lint:** `.eslintrc.json` com `extends: "next/core-web-vitals"`. `npm run lint` deve ficar limpo (zero warnings/erros); exceções a `react-hooks/exhaustive-deps` exigem `eslint-disable-next-line` com comentário explicando o motivo, não supressão silenciosa.

**Validação antes de considerar uma mudança pronta:** `tsc --noEmit`, `npm run lint`, `npm run build`.

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
