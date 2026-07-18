export let API_BASE_URL = 'https://preston-brave-alerts-colon.trycloudflare.com/api';

export function initApiConfig(cfg: { apiUrl: string }): void {
    API_BASE_URL = cfg.apiUrl;
}
