"""
Email service: sends transactional emails using aiosmtplib.

In development (email_backend="console") messages are logged to stdout
instead of being sent over SMTP. This keeps local dev dependency-free
while giving a realistic preview of each email's content.

Usage:
    from app.services.email_service import send_verification_email, send_password_reset_email

    await send_verification_email(to_email="user@example.com", otp="123456")
    await send_password_reset_email(to_email="user@example.com", reset_url="https://...")
"""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from jinja2 import Environment, BaseLoader

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ── Jinja2 environment (inline templates, no filesystem needed) ──

_jinja_env = Environment(loader=BaseLoader(), autoescape=True)


# ── Email templates ──────────────────────────────────────────

_VERIFY_EMAIL_HTML = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 0; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .logo { font-size: 24px; font-weight: 700; color: #6366f1; margin-bottom: 24px; }
    h1 { font-size: 22px; color: #111827; margin: 0 0 8px; }
    p { color: #6b7280; line-height: 1.6; margin: 0 0 24px; }
    .otp { display: inline-block; font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #111827;
           background: #f3f4f6; border-radius: 8px; padding: 16px 32px; margin: 8px 0 24px; }
    .footer { font-size: 13px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">SkillGap</div>
    <h1>Verify your email</h1>
    <p>Enter this code on the verification page. It expires in <strong>15 minutes</strong>.</p>
    <div class="otp">{{ otp }}</div>
    <p>If you didn't create a SkillGap account, you can safely ignore this email.</p>
    <div class="footer">© {{ year }} SkillGap. This is an automated message — please do not reply.</div>
  </div>
</body>
</html>
"""

_VERIFY_EMAIL_TEXT = """\
SkillGap — Verify your email

Your verification code is: {{ otp }}

This code expires in 15 minutes.

If you didn't create a SkillGap account, you can safely ignore this email.
"""

_RESET_PASSWORD_HTML = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 0; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .logo { font-size: 24px; font-weight: 700; color: #6366f1; margin-bottom: 24px; }
    h1 { font-size: 22px; color: #111827; margin: 0 0 8px; }
    p { color: #6b7280; line-height: 1.6; margin: 0 0 24px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none;
           padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .link { font-size: 13px; color: #9ca3af; word-break: break-all; }
    .footer { font-size: 13px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">SkillGap</div>
    <h1>Reset your password</h1>
    <p>We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
    <a href="{{ reset_url }}" class="btn">Reset password</a>
    <p style="margin-top:24px;">Or copy this link into your browser:</p>
    <p class="link">{{ reset_url }}</p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password won't change.</p>
    <div class="footer">© {{ year }} SkillGap. This is an automated message — please do not reply.</div>
  </div>
</body>
</html>
"""

_RESET_PASSWORD_TEXT = """\
SkillGap — Reset your password

We received a request to reset your password.
Click the link below (expires in 1 hour):

{{ reset_url }}

If you didn't request a password reset, you can safely ignore this email.
"""


# ── Core send helper ─────────────────────────────────────────


async def _send(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """
    Low-level email dispatcher.

    Routes to SMTP or console based on settings.email_backend.
    Never raises — logs errors instead so a failed email never crashes a request.
    """
    settings = get_settings()

    if settings.email_backend == "console":
        # Dev mode: pretty-print to logs so devs can see OTPs / links
        separator = "─" * 60
        logger.info(
            "\n%s\n  EMAIL (console mode)\n  To:      %s\n  Subject: %s\n%s\n%s\n%s",
            separator,
            to_email,
            subject,
            separator,
            text_body,
            separator,
        )
        return

    try:
        import aiosmtplib

        from_addr = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = from_addr
        message["To"] = to_email

        message.attach(MIMEText(text_body, "plain", "utf-8"))
        message.attach(MIMEText(html_body, "html", "utf-8"))

        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username or None,
            password=settings.smtp_password or None,
            use_tls=False,
            start_tls=settings.smtp_use_tls,
        )
        logger.info("Email sent: subject=%r to=%s", subject, to_email)

    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, str(exc)[:300])


# ── Public helpers ───────────────────────────────────────────


async def send_verification_email(to_email: str, otp: str) -> None:
    """Send the 6-digit OTP verification email."""
    from datetime import date

    ctx = {"otp": otp, "year": date.today().year}
    html = _jinja_env.from_string(_VERIFY_EMAIL_HTML).render(**ctx)
    text = _jinja_env.from_string(_VERIFY_EMAIL_TEXT).render(**ctx)

    await _send(
        to_email=to_email,
        subject="Your SkillGap verification code",
        html_body=html,
        text_body=text,
    )


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Send the password-reset link email."""
    from datetime import date

    ctx = {"reset_url": reset_url, "year": date.today().year}
    html = _jinja_env.from_string(_RESET_PASSWORD_HTML).render(**ctx)
    text = _jinja_env.from_string(_RESET_PASSWORD_TEXT).render(**ctx)

    await _send(
        to_email=to_email,
        subject="Reset your SkillGap password",
        html_body=html,
        text_body=text,
    )
