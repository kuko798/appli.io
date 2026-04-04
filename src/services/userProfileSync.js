/**
 * Load canonical user profile from the Appli webapp (same account, any browser).
 * Uses VITE_JOBS_API_BASE — must match the host that serves GET /api/profile/bearer with CORS.
 */

const base = () => (import.meta.env.VITE_JOBS_API_BASE || '').trim().replace(/\/$/, '');

export function userProfileApiConfigured() {
  return Boolean(base());
}

/**
 * Fetches profile from server (verifies Bearer token, upserts server record) and mirrors to localStorage.
 * @returns {Promise<{ email?: string, name?: string, picture?: string } | null>}
 */
export async function syncUserProfileFromServer() {
  const BASE = base();
  if (!BASE) return null;
  const token = localStorage.getItem('appli_token');
  if (!token) return null;
  try {
    const r = await fetch(`${BASE}/api/profile/bearer`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (typeof data !== 'object' || !data) return null;
    if (data.email) localStorage.setItem('appli_user_email', data.email);
    if (data.name) localStorage.setItem('appli_user_name', data.name);
    else localStorage.removeItem('appli_user_name');
    if (data.picture) localStorage.setItem('appli_user_picture', data.picture);
    else localStorage.removeItem('appli_user_picture');
    return {
      email: data.email,
      name: data.name || '',
      picture: data.picture || '',
    };
  } catch (e) {
    console.warn('[userProfileSync]', e);
    return null;
  }
}
