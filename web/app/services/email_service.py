import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def _send_sync(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(settings.SMTP_FROM, to, msg.as_string())


async def send_email(to: str, subject: str, html: str) -> None:
    await asyncio.to_thread(_send_sync, to, subject, html)


async def send_verification_email(to: str, name: str, token: str) -> None:
    url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#16a34a">Bem-vindo(a) ao Lendly, {name}!</h2>
      <p>Para ativar sua conta, clique no botão abaixo:</p>
      <a href="{url}"
         style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
        Verificar e-mail
      </a>
      <p style="color:#6b7280;font-size:13px">
        Link válido por {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} horas.<br>
        Se você não criou esta conta, ignore este e-mail.
      </p>
    </div>
    """
    await send_email(to, "Verifique seu e-mail — Lendly", html)


async def send_password_reset_email(to: str, name: str, token: str) -> None:
    url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
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


async def send_request_status_email(
    to: str, name: str, item_title: str, request_status: str, request_id: str
) -> None:
    copy = _STATUS_COPY.get(request_status)
    if not copy:
        return
    title, body_template = copy
    url = f"{settings.FRONTEND_URL}/requests/{request_id}"
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
    url = f"{settings.FRONTEND_URL}/requests/{request_id}"
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
    url = f"{settings.FRONTEND_URL}/profile#identity-verification"
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
    url = f"{settings.FRONTEND_URL}/profile#identity-verification"
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
    url = f"{settings.FRONTEND_URL}/items/{item_id}"
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
