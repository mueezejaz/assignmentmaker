import { useState, useEffect, useRef, useCallback } from 'react';
import { pollJob } from '../lib/api.js';

export function useJobPoller(jobId, onUpdate) {
    const [job, setJob] = useState(null);
    const sinceRef = useRef(0);
    const activeRef = useRef(true);
    const timeoutRef = useRef(null);

    const poll = useCallback(async () => {
        if (!jobId || !activeRef.current) return;
        try {
            const data = await pollJob(jobId, sinceRef.current);
            if (!activeRef.current) return;
            if (data) {
                sinceRef.current = data.updatedAt || Date.now();
                setJob(data);
                onUpdate?.(data);
                if (data.status === 'done' || data.status === 'failed') {
                    activeRef.current = false;
                    return;
                }
            }
            if (activeRef.current) timeoutRef.current = setTimeout(poll, 200);
        } catch (err) {
            if (!activeRef.current) return;
            if (activeRef.current) timeoutRef.current = setTimeout(poll, 3000);
        }
    }, [jobId, onUpdate]);

    useEffect(() => {
        if (!jobId) return;
        activeRef.current = true;
        sinceRef.current = 0;
        poll();
        return () => {
            activeRef.current = false;
            clearTimeout(timeoutRef.current);
        };
    }, [jobId, poll]);

    return job;
}