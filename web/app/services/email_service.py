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
