import { Resend } from "resend";

export type DeadlineItem = {
  club_name: string;
  club_slug: string;
  deadline_title: string;
  deadline_at: string;
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  const deadline = new Date(dateStr);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildEmailHtml(name: string, deadlines: DeadlineItem[]): string {
  const rows = deadlines
    .map((d) => {
      const days = daysUntil(d.deadline_at);
      const urgency = days <= 3 ? "#f87171" : days <= 7 ? "#fbbf24" : "#a8a29e";
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #292524;">
            <strong style="color:#f5f5f4;font-size:14px;">${d.club_name}</strong>
            <br/>
            <span style="color:#a8a29e;font-size:13px;">${d.deadline_title}</span>
          </td>
          <td style="padding:12px 0 12px 16px;border-bottom:1px solid #292524;text-align:right;white-space:nowrap;">
            <span style="color:${urgency};font-size:13px;font-weight:600;">
              ${days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
            </span>
            <br/>
            <span style="color:#78716c;font-size:12px;">${formatDate(d.deadline_at)}</span>
          </td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1917;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 24px 28px;">
              <span style="color:#fcd34d;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">Rush</span>
            </td>
          </tr>
          <tr>
            <td style="background:#1c1917;border:1px solid #292524;border-radius:16px;padding:28px 24px;">
              <h1 style="margin:0 0 8px;color:#f5f5f4;font-size:22px;font-weight:600;line-height:1.3;">
                Upcoming deadlines${name ? `, ${name.split(" ")[0]}` : ""}
              </h1>
              <p style="margin:0 0 24px;color:#a8a29e;font-size:14px;line-height:1.6;">
                You have ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} coming up in the next 14 days.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
              <div style="margin-top:28px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://rush.app"}/dashboard"
                   style="display:inline-block;background:#fcd34d;color:#1c1917;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px;text-decoration:none;">
                  Open dashboard
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0;color:#57534e;font-size:12px;">
              You're receiving this because you follow clubs on Rush.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDeadlineReminder(
  to: string,
  name: string,
  deadlines: DeadlineItem[]
): Promise<{ error: Error | null }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { error: new Error("Missing RESEND_API_KEY") };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Rush <reminders@rush.app>",
    to,
    subject: `${deadlines.length} upcoming deadline${deadlines.length === 1 ? "" : "s"} on Rush`,
    html: buildEmailHtml(name, deadlines),
  });

  return { error: error as Error | null };
}

function buildConfirmationEmailHtml(clubName: string, submittedAt: string): string {
  const formattedDate = new Date(submittedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c1917;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 24px 28px;">
              <span style="color:#fcd34d;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;">Rush</span>
            </td>
          </tr>
          <tr>
            <td style="background:#1c1917;border:1px solid #292524;border-radius:16px;padding:28px 24px;">
              <h1 style="margin:0 0 8px;color:#f5f5f4;font-size:22px;font-weight:600;line-height:1.3;">
                Application received
              </h1>
              <p style="margin:0 0 24px;color:#a8a29e;font-size:14px;line-height:1.6;">
                Your application to <strong style="color:#f5f5f4;">${clubName}</strong> has been submitted successfully.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #292524;">
                    <span style="color:#a8a29e;font-size:13px;">Club</span>
                    <br/>
                    <strong style="color:#f5f5f4;font-size:14px;">${clubName}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <span style="color:#a8a29e;font-size:13px;">Submitted</span>
                    <br/>
                    <strong style="color:#f5f5f4;font-size:14px;">${formattedDate}</strong>
                  </td>
                </tr>
              </table>
              <div style="margin-top:28px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://rush.app"}/dashboard"
                   style="display:inline-block;background:#fcd34d;color:#1c1917;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px;text-decoration:none;">
                  View your applications
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0;color:#57534e;font-size:12px;">
              You received this because you submitted an application on Rush.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendApplicationConfirmation(
  to: string,
  clubName: string,
  submittedAt: string,
): Promise<{ error: Error | null }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { error: new Error("Missing RESEND_API_KEY") };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Rush <noreply@rush.app>",
    to,
    subject: `Your application to ${clubName} has been received`,
    html: buildConfirmationEmailHtml(clubName, submittedAt),
  });

  return { error: error as Error | null };
}
