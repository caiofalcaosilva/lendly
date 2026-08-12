# Histórico de Atividades (`Activity`)

Registro persistente, visível ao usuário, do que aconteceu com pedidos, itens, pagamentos, avaliações,
verificação de identidade, grupos e ações administrativas. Referenciado a partir de
`app/models/activity.py` e `app/services/activity_service.py` como "docs/historico-de-atividades" —
leia isto antes de adicionar um evento novo ou mexer em `activity_service.py`.

Não confundir com `Notification` (`app/models/notification.py`): notificação é opt-out, tem estado de
lido/não-lido e é apagável pelo usuário — serve para chamar atenção. `Activity` é append-only, sempre
gravada (não tem preferência que desliga) e nunca editada — serve como histórico.

## Onde cada evento é gravado

| Evento | Disparado por | Destinatário(s) |
|---|---|---|
| `item.created` | `item_service/crud.py::create_item` | Owner |
| `item.updated` | `crud.py::update_item` (só se preço ou `availability_type` mudou) | Owner + favoritadores |
| `item.paused` / `item.resumed` | `crud.py::set_availability` | Owner + favoritadores/lista de espera |
| `item.removed` | `crud.py::delete_item` | Owner + favoritadores |
| `rental.requested` | `loan_request_service/lifecycle.py::create_request` | Owner + Requester |
| `rental.accepted` / `rental.refused` | `lifecycle.py::accept_request` / `refuse_request` | Owner + Requester |
| `rental.pickup_confirmed` | `lifecycle.py::confirm_pickup` (cada confirmação, um dos lados) | Owner + Requester |
| `rental.started` | `lifecycle.py::_complete_pickup` (quando os dois confirmaram, ou via `force_pickup`) | Owner + Requester |
| `rental.pickup_forced` | `lifecycle.py::force_pickup` | Owner + Requester |
| `rental.return_confirmed` | `lifecycle.py::confirm_return` | Owner + Requester |
| `rental.finished` | `lifecycle.py::_complete_return` | Owner + Requester |
| `rental.return_forced` | `lifecycle.py::force_return` | Owner + Requester |
| `rental.cancelled` | `lifecycle.py::cancel_request` | Owner + Requester |
| `rental.extension_requested` | `loan_request_service/extensions.py::request_extension` | Owner + Requester |
| `rental.extension_approved` / `rejected` | `extensions.py::approve_extension` / `reject_extension` | Owner + Requester |
| `payment.held` / `payment.failed` | `payment_service.py::handle_webhook` | Payer + Payee |
| `payment.released` | `payment_service.py::release_payment` | Payer + Payee |
| `payment.refunded` | `payment_service.py::refund_payment` | Payer + Payee |
| `review.submitted` | `review_service.py::create_review` | Reviewed + Reviewer |
| `verification.submitted` | `verification_service.py::submit_verification` | O próprio usuário |
| `verification.approved` / `rejected` | `verification_service.py::approve_submission` / `reject_submission` | Usuário verificado |
| `group.created` | `group_service.py::create_group` | Criador |
| `group.joined` | `group_service.py::join_group` | Novo membro |
| `group.left` | `group_service.py::leave_group` | O próprio membro |
| `group.deleted` | `group_service.py::delete_group` (autoexclusão pelo criador) | Todos os membros |
| `group.vouch_received` | `group_service.py::vouch_for_member` | Membro vouched |
| `group.vouch_withdrawn` | `group_service.py::unvouch_for_member` | Membro que perdeu o vouch |
| `group.moderator_added` / `moderator_removed` | `group_service.py::add_moderator` / `remove_moderator` (criador only) | O membro promovido/rebaixado |
| `group.member_removed` | `group_service.py::remove_member` (criador ou moderador) | Membro removido |
| `report.filed` | `report_service.py::create_report` | O próprio reporter |
| `account.new_login` | `auth_service/session.py::login_user` / `complete_2fa` (só dispositivo não confiável) | O próprio usuário |
| `account.password_changed` | `auth_service/account.py::change_password` | O próprio usuário |
| `account.email_changed` | `account.py::change_email` | O próprio usuário |
| `account.paused` / `resumed` | `account.py::pause_account` / `resume_account` | O próprio usuário |
| `account.2fa_enabled` / `2fa_disabled` | `auth_service/totp.py::enable_totp` / `disable_totp` | O próprio usuário |
| `account.password_reset` | `auth_service/password_reset.py::reset_password` (fluxo "esqueci minha senha", ator=`None`) | O próprio usuário |
| `account.session_revoked` | `auth_service/session.py::revoke_session` ("desconectar este dispositivo" em `/me/sessions`) | O próprio usuário |
| `account.mercadopago_connected` | `mp_connect_service.py::handle_callback` | O próprio usuário |
| `account.data_exported` | `export_service.py::export_user_data` | O próprio usuário |
| `admin.user_activated` / `deactivated` / `promoted` / `demoted` | `admin_user_service.py` | Usuário alvo |
| `admin.item_activated` / `deactivated` | `admin_item_service.py` | Owner do item |
| `admin.report_dismissed` / `actioned` | `report_service.py` | Reporter |
| `admin.group_deleted` | `group_service.py::admin_delete_group` | Todos os membros do grupo |
| `admin.group_member_removed` | `group_service.py::admin_remove_member` | Membro removido |
| `admin.review_deleted` | `admin_review_service.py::admin_delete_review` | Reviewer + Reviewed |
| `admin.user_viewed` | `admin_view_as_service.py::create_view_as_token` | Usuário visualizado |

## Regras de design

- **Um documento por destinatário**, nunca um evento global com lista de "quem vê". Quando um evento
  afeta duas pessoas (ex.: aceitar um pedido), `record()` é chamado uma vez por destinatário — inclusive
  para o próprio ator, que também vê a própria ação no seu timeline (diferente de `Notification`, que só
  alerta quem não agiu).
- **Gravação síncrona e best-effort.** `activity_service.record()` nunca propaga exceção — qualquer
  falha é logada (`logger.exception`) e engolida, para que um bug na gravação do histórico nunca derrube
  a operação de negócio que o originou. Não há fila, retry nem transação — é um único insert na mesma
  base MongoDB já usada pelo resto do domínio.
- **`resource_type`/`resource_id` são strings**, não `GenericReferenceField` — o recurso de origem pode
  ser `Item`, `LoanRequest`, `Payment`, `Review`, `VerificationSubmission`, `Report`, `Group` ou `User`,
  e alguns desses podem ser removidos de verdade (grupo, review via moderação), diferente de
  `User`/`Item` que só são soft-deletados.
- **`actor_name`/`resource_title` são snapshots**, congelados no momento do evento — o texto renderizado
  no timeline não muda se o ator trocar de nome depois, e não depende de um dereference por linha.
- **Nunca colocar em `metadata`**: senha, token (JWT, `mp_access_token`, `mp_refresh_token`,
  `totp_secret`), caminho de arquivo de verificação (`selfie_path`/`document_path`), CPF/CNPJ completo,
  ou payload cru de webhook. Os únicos campos hoje gravados em `metadata` são: `rating` (review),
  `gross_amount`/`platform_fee_amount` (payment — já são snapshots não sensíveis existentes em
  `Payment`), `reason` (motivo de rejeição de verificação — mesmo texto já mostrado ao usuário),
  `ip_address`/`user_agent` (novo login — mesmos campos já expostos em `/users/me/login-history`) e
  `new_email` (troca de e-mail — o próprio usuário vendo o próprio novo e-mail, não é dado de terceiro).

## Índices

```python
{"fields": ["recipient", "-created_at"]}          # GET /activities/ — timeline do usuário
{"fields": ["recipient", "event", "-created_at"]}  # filtro por tipo de evento
{"fields": ["resource_type", "resource_id"]}       # lookup reverso: toda activity sobre um recurso
```

## API

`GET /activities/` — paginação por cursor (`before_id` + `order_by("-id")`, mesmo padrão de
`GET /notifications/`), filtros opcionais `event` e `resource_type`. Sempre restrito a
`recipient=current_user` — nunca aceita `user_id` de outro usuário.

## Adicionando um evento novo

1. Adicionar a string em `ACTIVITY_EVENTS` (`app/models/activity.py`).
2. Chamar `activity_service.record(...)` no ponto exato da transição de estado no service — mesmo
   arquivo/função que já dispara a notificação equivalente, se houver uma.
3. Definir destinatário(s): pelo menos a pessoa afetada; incluir o ator também se fizer sentido ele ver
   a própria ação no timeline (padrão adotado para pedidos e avaliações).
4. Revisar `metadata` contra a lista de "nunca gravar" acima antes de subir.
