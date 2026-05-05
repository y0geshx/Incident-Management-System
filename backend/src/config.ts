import dotenv from 'dotenv';

dotenv.config();

export function getDashboardCacheTTLSeconds(): number {
  const envVal = process.env.DASHBOARD_CACHE_TTL_SECONDS || process.env.DASHBOARD_CACHE_TTL;
  const parsed = envVal ? parseInt(envVal, 10) : NaN;
  return !isNaN(parsed) && parsed > 0 ? parsed : 3;
}

export default {
  getDashboardCacheTTLSeconds,
};
