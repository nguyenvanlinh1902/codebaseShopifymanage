/**
 * Verify a Discord bot token by calling GET /users/@me with it. Used on Save
 * to reject stale / malformed tokens before they land in Firestore.
 *
 * @param {string} token - Raw bot token (no "Bot " prefix).
 * @returns {Promise<{ok: boolean, username?: string, id?: string, error?: string}>}
 */
export async function probeBotToken(token) {
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {Authorization: `Bot ${token}`}
    });
    if (res.ok) {
      const me = await res.json();
      return {ok: true, username: me.username, id: me.id};
    }
    const body = await res.text();
    return {ok: false, error: `${res.status} ${body.slice(0, 120)}`};
  } catch (err) {
    return {ok: false, error: err.message};
  }
}
