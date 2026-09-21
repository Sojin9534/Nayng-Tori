declare namespace Cloudflare {
  interface Env {
    AUTH_PROVIDER?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    ADMIN_EMAIL?: string;
    ADMIN_OWNER_ID?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
