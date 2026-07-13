export let API_BASE_URL = 'http://2.25.187.20:5071/api';

export function initApiConfig(cfg: { apiUrl: string }): void {
    API_BASE_URL = cfg.apiUrl;
}
