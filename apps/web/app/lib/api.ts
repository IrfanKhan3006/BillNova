const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request(path: string, options: FetchOptions = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let url = `${BASE_URL}${path}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, val);
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      // Redirect to login page, avoiding loop if already on login page
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login?expired=true';
      }
    }

    let errMsg = 'Something went wrong';
    try {
      const errData = await response.json();
      errMsg = errData.message || errMsg;
    } catch {
      // Ignored
    }
    throw new Error(errMsg);
  }

  // Handle empty responses
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const api = {
  get: (path: string, params?: Record<string, any>, options?: RequestInit) =>
    request(path, { method: 'GET', params, ...options }),

  post: (path: string, body?: any, options?: RequestInit) =>
    request(path, { method: 'POST', body: JSON.stringify(body), ...options }),

  patch: (path: string, body?: any, options?: RequestInit) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  delete: (path: string, options?: RequestInit) =>
    request(path, { method: 'DELETE', ...options }),
};
