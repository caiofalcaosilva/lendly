import asyncio
import json
import logging
import smtplib
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.utils.urls import frontend_origin

logger = logging.getLogger(__name__)

# No timeout on smtplib.SMTP() means a network that silently drops outbound
# packets to SMTP_HOST/SMTP_PORT (rather than actively refusing the
# connection — common on cloud hosts that block outbound SMTP) hangs this
# call forever instead of raising. A background task stuck like that never
# logs anything and never shows up at the provider either, indistinguishable
# from "never ran" — this bounds it so a blocked port fails fast and loud.
_TIMEOUT_SECONDS = 15


def _send_via_resend_api(to: str, subject: str, html: str) -> None:
    """HTTPS (443) instead of SMTP — used whenever RESEND_API_KEY is set.
    Render (and other hosts) block outbound SMTP ports outright, which is
    exactly what _send_via_smtp below hits in production; plain HTTPS to
    Resend's API sidesteps that entirely. See settings.RESEND_API_KEY."""
    body = json.dumps(
        {"from": settings.SMTP_FROM, "to": [to], "subject": subject, "html": html}
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
            # Cloudflare (fronting Resend's API) blocks urllib's default
            # "Python-urllib/x.y" User-Agent as a bot signature (403, "error
            # code: 1010") — any normal-looking value clears it.
            "User-Agent": "Lendly/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS):
        pass


def _send_via_smtp(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(
        settings.SMTP_HOST, settings.SMTP_PORT, timeout=_TIMEOUT_SECONDS
    ) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(settings.SMTP_FROM, to, msg.as_string())


def _send_sync(to: str, subject: str, html: str) -> None:
    logger.info("sending email", extra={"to": to, "subject": subject})
    try:
        if settings.RESEND_API_KEY:
            _send_via_resend_api(to, subject, html)
        else:
            _send_via_smtp(to, subject, html)
        logger.info("email sent", extra={"to": to, "subject": subject})
    except Exception:
        # Always called from a fire-and-forget BackgroundTask (see call
        # sites in auth_service etc.) — the request that triggered this has
        # already returned a success response, so an exception here has no
        # one left to reach. Logging is the only way this failure is ever
        # visible; a wrong SMTP_HOST/SMTP_TLS silently drops every email
        # otherwise.
        logger.error(
            "email send failed", extra={"to": to, "subject": subject}, exc_info=True
        )


async def send_email(to: str, subject: str, html: str) -> None:
    await asyncio.to_thread(_send_sync, to, subject, html)


async def send_verification_email(to: str, name: str, token: str) -> None:
    url = f"{frontend_origin()}/verify-email?token={token}"
    html = f"""
    <div style="background:#f3f4f6;padding:40px 16px;font-family:-apple-system,
                BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;
                  border:1px solid #e5e7eb;overflow:hidden">
        <div style="background:#16a34a;padding:28px 32px;text-align:center">
          <div style="display:inline-block;width:40px;height:40px;border-radius:50%;
                      background:#ffffff;line-height:40px;text-align:center;
                      font-size:20px;font-weight:800;color:#16a34a;margin-bottom:8px">L</div>
          <div style="color:#ffffff;font-size:18px;font-weight:800;
                      letter-spacing:-0.3px">
            Lendly
          </div>
        </div>
        <div style="padding:36px 32px 32px">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#111827">
            Bem-vindo(a), {name}!
          </h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563">
            Falta só um passo para você começar a emprestar e pegar emprestado
            com seus vizinhos: confirmar seu e-mail.
          </p>
          <div style="text-align:center;margin:0 0 24px">
            <a href="{url}"
               style="display:inline-block;background:#16a34a;color:#ffffff;
                      padding:14px 32px;border-radius:10px;text-decoration:none;
                      font-weight:700;font-size:15px">
              Verificar e-mail
            </a>
          </div>
          <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#9ca3af">
            Se o botão não funcionar, copie e cole este link no navegador:<br>
            <a href="{url}" style="color:#16a34a;word-break:break-all">{url}</a>
          </p>
          <div style="border-top:1px solid #e5e7eb;padding-top:16px">
            <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af">
              Este link é válido por {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} horas.
              Se você não criou esta conta, é só ignorar este e-mail.
            </p>
          </div>
        </div>
      </div>
    </div>
    """
    await send_email(to, "Verifique seu e-mail — Lendly", html)


async def send_password_reset_email(to: str, name: str, token: str) -> None:
    url = f"{frontend_origin()}/reset-password?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Redefinir senha</h2>
      <p>Olá, {name}! Recebemos um pedido para redefinir sua senha. Clique no
      botão abaixo para escolher uma nova:</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Redefinir senha
      </a>
      <p style="color:#6b7280;font-size:13px">
        Link válido por 1 hora.<br>
        Se você não pediu essa redefinição, ignore este e-mail — sua senha
        continua a mesma.
      </p>
    </div>
    """
    await send_email(to, "Redefinir senha — Lendly", html)


async def send_new_login_email(
    to: str, name: str, ip_address: str | None, user_agent: str | None
) -> None:
    where = ip_address or "endereço desconhecido"
    device = f" ({user_agent})" if user_agent else ""
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Novo login detectado</h2>
      <p>Olá, {name}! Sua conta acabou de ser acessada de um dispositivo que
      não reconhecíamos.</p>
      <p style="color:#374151;font-size:14px">
        <strong>IP:</strong> {where}{device}
      </p>
      <p style="color:#6b7280;font-size:13px">
        Se foi você, pode ignorar este e-mail. Se não reconhece esse acesso,
        troque sua senha imediatamente em /profile — isso encerra todas as
        outras sessões.
      </p>
    </div>
    """
    await send_email(to, "Novo login detectado — Lendly", html)


async def send_review_reminder_email(
    to: str, name: str, item_title: str, request_id: str
) -> None:
    url = f"{frontend_origin()}/requests/{request_id}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Que tal avaliar esse empréstimo?</h2>
      <p>Olá, {name}! O empréstimo de <strong>{item_title}</strong> foi
      finalizado há alguns dias e você ainda não deixou uma avaliação.
      Leva menos de um minuto e ajuda outros vizinhos a saber com quem
      estão lidando.</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Avaliar agora
      </a>
    </div>
    """
    await send_email(to, "Que tal avaliar esse empréstimo? — Lendly", html)


_STATUS_COPY = {
    "accepted": (
        "Seu pedido foi aceito!",
        "sua solicitação para <strong>{item}</strong> foi aceita pelo dono do item. "
        "Combine os detalhes da retirada pelo app.",
    ),
    "refused": (
        "Seu pedido foi recusado",
        "sua solicitação para <strong>{item}</strong> foi recusada pelo dono do item.",
    ),
    "finished": (
        "Empréstimo finalizado",
        "o empréstimo de <strong>{item}</strong> foi marcado como finalizado. "
        "Que tal deixar uma avaliação?",
    ),
}


async def send_new_request_email(
    to: str, name: str, requester_name: str, item_title: str, request_id: str
) -> None:
    url = f"{frontend_origin()}/requests/{request_id}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Nova solicitação recebida</h2>
      <p>Olá, {name}! {requester_name} quer pegar emprestado o seu
      <strong>{item_title}</strong>.</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Ver solicitação
      </a>
    </div>
    """
    await send_email(to, "Nova solicitação recebida — Lendly", html)


async def send_request_status_email(
    to: str, name: str, item_title: str, request_status: str, request_id: str
) -> None:
    copy = _STATUS_COPY.get(request_status)
    if not copy:
        return
    title, body_template = copy
    url = f"{frontend_origin()}/requests/{request_id}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">{title}</h2>
      <p>Olá, {name}! {body_template.format(item=item_title)}</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Ver solicitação
      </a>
    </div>
    """
    await send_email(to, f"{title} — Lendly", html)


async def send_new_message_email(
    to: str, name: str, sender_name: str, item_title: str, request_id: str
) -> None:
    url = f"{frontend_origin()}/requests/{request_id}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Nova mensagem de {sender_name}</h2>
      <p>Olá, {name}! Você recebeu uma nova mensagem de {sender_name} sobre
      <strong>{item_title}</strong>.</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Ver conversa
      </a>
    </div>
    """
    await send_email(to, f"Nova mensagem de {sender_name} — Lendly", html)


async def send_verification_approved_email(to: str, name: str) -> None:
    url = f"{frontend_origin()}/profile#identity-verification"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Sua identidade foi verificada!</h2>
      <p>Olá, {name}! Sua verificação de identidade foi aprovada. Agora você
      pode solicitar itens que exigem verificação.</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Ver status
      </a>
    </div>
    """
    await send_email(to, "Identidade verificada — Lendly", html)


async def send_verification_rejected_email(
    to: str, name: str, reason: str = ""
) -> None:
    url = f"{frontend_origin()}/profile#identity-verification"
    reason_html = f"<p><strong>Motivo:</strong> {reason}</p>" if reason else ""
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Não foi possível verificar sua identidade</h2>
      <p>Olá, {name}! Sua verificação de identidade não foi aprovada.</p>
      {reason_html}
      <p>Você pode enviar uma nova solicitação com documentos atualizados.</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Enviar novamente
      </a>
    </div>
    """
    await send_email(to, "Verificação de identidade não aprovada — Lendly", html)


async def send_item_available_email(
    to: str, name: str, item_title: str, item_id: str
) -> None:
    url = f"{frontend_origin()}/items/{item_id}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">{item_title} está disponível de novo!</h2>
      <p>Olá, {name}! O item que você queria ficou disponível de novo no Lendly.</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Ver item
      </a>
    </div>
    """
    await send_email(to, f"{item_title} está disponível — Lendly", html)
