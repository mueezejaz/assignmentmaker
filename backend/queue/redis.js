// ============================================================
// Shared Redis connection config for BullMQ
// ============================================================

import { URL } from 'url';
import { seg } from '../seg/seg.js';
let _connectionConfig = null;
export function getRedisConnection() {
    if (_connectionConfig) return _connectionConfig;

    const redisUrl = seg["REDIS_URL"] || 'redis://localhost:6379';

    try {
        const parsed = new URL(redisUrl);

        _connectionConfig = {
            host: parsed.hostname,
            port: parseInt(parsed.port || '6379', 10),
            // Support Upstash and other password-protected Redis (rediss:// or redis://:pass@host)
            ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
            // TLS required for rediss:// (Upstash, Railway, etc.)
            ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
            // BullMQ requires maxRetriesPerRequest: null
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };
    } catch {
        // Fallback to localhost if URL is malformed
        _connectionConfig = {
            host: '127.0.0.1',
            port: 6379,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };
    }

    return _connectionConfig;
}