export const environment = {
    production: true,
    // Relative paths: in production the app is served from data.nist.gov, so these
    // resolve to https://data.nist.gov/rmm/... (same-origin, no CORS).
    apiURLRepo: '/rmm/usagemetrics/repo',
    apiURLUsageRecord: '/rmm/usagemetrics/records',
    apiURLRecords: '/rmm/records'
};
