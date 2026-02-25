import { start } from "node:repl";
import {z} from "zod";

export const MATCH_STATUS = {
    SCHEDULED: "scheduled",
    LIVE: "live",
    FINISHED: "finished",
};

export const listMatchesQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
});


export const matchIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const isoDateString = z.date().refine((value) => {
    return !isNaN(value.getTime());
}, {
    message: "Invalid ISO date string",
});

export const createMatchSchema = z.object({
    sport: z.string().min(1).max(255),
    homeTeam: z.string().min(1).max(255),
    awayTeam: z.string().min(1).max(255),
    startTime: isoDateString,
    endTime: isoDateString,
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
})
.superRefine((data, ctx) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (startTime >= endTime) {
        ctx.addIssue({
            code: "custom",
            message: "Start time must be before end time",
            path: ["startTime"],
        });
    }
});

export const updateScoreSchema = z.object({
    homeScore: z.coerce.number().int().nonnegative(),
    awayScore: z.coerce.number().int().nonnegative(),
});