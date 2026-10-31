export const environment = {
  production: false,
  // Same origin as the dev server: proxy.conf.json forwards /api to http://localhost:8080,
  // so the local backend works without CORS.
  apiUrl: '/api',
};
