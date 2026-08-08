// Owner notification: POST the payload to a Google Apps Script web app
// that appends a sheet row and emails the owner (same pattern as our
// other builds — PROJECT_BRIEF.md section 10). Never lets a notification
// failure break a form submit.

export async function notifyOwner(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, submitted_at: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("notifyOwner failed:", err);
  }
}
