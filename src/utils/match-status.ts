import { MATCH_STATUS } from "../validation/matches.js";

export const getMatchStatus = (startTime: Date, endTime: Date, now = new Date()): typeof MATCH_STATUS[keyof typeof MATCH_STATUS] => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Invalid date");
    }

    if (now < start) {
        return MATCH_STATUS.SCHEDULED;
    }

    if (now > end) {
        return MATCH_STATUS.FINISHED;
    }

    return MATCH_STATUS.LIVE;
}


export async function syncMatchStatus(match: any, updateStatus: Function): Promise<string> {
    const nextStatus = getMatchStatus(match.startTime, match.endTime);

    if (!nextStatus) {
        return match.status;
    }

    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    
    return match.status;

}
