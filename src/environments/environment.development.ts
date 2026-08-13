export const environment = {
    production: false,
    // Same-origin relative paths so the ng serve dev proxy (proxy.conf.json) forwards
    // them to https://data.nist.gov, avoiding the browser CORS block (the API sends no
    // Access-Control-Allow-Origin header). In production the app is served from
    // data.nist.gov, so these relative paths also resolve correctly there.
    apiURLRepo: '/rmm/usagemetrics/repo',
    apiURLUsageRecord: '/rmm/usagemetrics/records',
    apiURLRecords: '/rmm/records'
};
