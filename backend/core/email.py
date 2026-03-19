import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings

async def send_reset_email(to_email: str, reset_token: str, reset_link: str):
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        print(f"[EMAIL SKIPPED] Reset token for {to_email}: {reset_token}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset your InterviewAI password"
        msg["From"] = f"InterviewAI <{settings.SMTP_EMAIL}>"
        msg["To"] = to_email

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0a0f;color:#fff;border-radius:16px;padding:32px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700">AI</div>
            <h1 style="margin:12px 0 4px;font-size:20px">Reset your password</h1>
            <p style="color:#64748b;font-size:14px;margin:0">InterviewAI Account Recovery</p>
          </div>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6">
            You requested a password reset for your InterviewAI account. Click the button below to set a new password.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="{reset_link}" style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;display:inline-block">
              Reset Password
            </a>
          </div>
          <div style="background:#1e1e2e;border-radius:8px;padding:12px 16px;margin-bottom:20px">
            <p style="color:#64748b;font-size:12px;margin:0 0 6px">Or copy this token manually:</p>
            <code style="color:#a5b4fc;font-size:12px;word-break:break-all">{reset_token}</code>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center">
            This link expires in 15 minutes. If you didn't request this, ignore this email.
          </p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.SMTP_EMAIL,
            password=settings.SMTP_PASSWORD,
        )
        print(f"[EMAIL SENT] Reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False
