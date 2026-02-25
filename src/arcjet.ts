import arcjet, {detectBot, shield, slidingWindow} from "@arcjet/node";
import type { Request, Response, NextFunction } from "express";

const arcjetKey: string | undefined = process.env.ARCJET_KEY;
const arcjetMode: 'DRY_RUN' | 'LIVE' = process.env.ARCJECT_MODE === 'DRY_RUN' ? 'DRY_RUN' : 'LIVE';

if(!arcjetKey) throw new Error('ARCJET_KEY environment variable is missing.');

type ArcjetInstance = ReturnType<typeof arcjet> | null;

export const httpArcjet: ArcjetInstance = arcjetKey ?
    arcjet({
        key: arcjetKey,
        rules: [
            shield({ mode: arcjetMode }),
            detectBot({ mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', "CATEGORY:PREVIEW" ]}),
            slidingWindow({ mode: arcjetMode, interval: '10s', max: 50 })
        ],
    }) : null;

export const wsArcjet: ArcjetInstance = arcjetKey ?
    arcjet({
        key: arcjetKey,
        rules: [
            shield({ mode: arcjetMode }),
            detectBot({ mode: arcjetMode, allow: ['CATEGORY:SEARCH_ENGINE', "CATEGORY:PREVIEW" ]}),
            slidingWindow({ mode: arcjetMode, interval: '2s', max: 5 })
        ],
    }) : null;

interface SecurityMiddlewareFunction {
    (req: Request, res: Response, next: NextFunction): Promise<void>;
}

export function securityMiddleware(): SecurityMiddlewareFunction {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if(!httpArcjet) return next();

        try {
            const decision = await httpArcjet.protect(req);

            if(decision.isDenied()) {
                if(decision.reason.isRateLimit()) {
                    res.status(429).json({ error: 'Too many requests.' });
                    return;
                }

                res.status(403).json({ error: 'Forbidden.' });
                return;
            }
        } catch (e) {
            console.error('Arcjet middleware error', e);
            res.status(503).json({ error: 'Service Unavailable' });
            return;
        }

        next();
    }
}
