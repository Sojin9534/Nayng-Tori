declare namespace Cloudflare {
  interface Env {
    R2_ACCOUNT_ID?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    AUTH_PROVIDER?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    ADMIN_EMAIL?: string;
    ADMIN_OWNER_ID?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
