export let API_BASE_URL = 'https://api.tramiya.com.py/api';

export function initApiConfig(cfg: { apiUrl: string }): void {
    API_BASE_URL = cfg.apiUrl;
}
