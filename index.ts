import { DomUtils, ElementType, parseDocument } from "htmlparser2";

import channels from "./channels.json" assert { type: "json" };

// https://stackoverflow.com/a/75645469
function extractInitialPlayerResponse(html: string) {
    const dom = parseDocument(html);

    const scripts = DomUtils.filter((elem) => elem.type === ElementType.Script, dom, true)

    const results = DomUtils.findOne((elem) => {    
        const script = DomUtils.textContent(elem);
        return script.startsWith("var ytInitialPlayerResponse =");
    }, scripts);

    return results;
}

interface LiveStatus {
    status: "LIVE" | "UPCOMING" | "OFFLINE" | "UNKNOWN";
    // unix time
    startTime?: number;
}

async function getLiveStatus(id: string): Promise<LiveStatus> {
    try {
        const response = await fetch(`https://www.youtube.com/channel/${id}/live`);
        const html = await response.text();

        const data = extractInitialPlayerResponse(html);
        // assume its offline if we cant find ytInitialPlayerResponse we go to the channel page instead of video page
        if (!data) return { status: "OFFLINE" };

        // get rid of var decl and trailing semi
        const text = DomUtils.textContent(data).replace("var ytInitialPlayerResponse =", "").slice(0, -1);
        const json = JSON.parse(text);

        const playability = json.playabilityStatus;

        if (playability.status === "LIVE_STREAM_OFFLINE") {
            const startTime = playability.liveStreamability.liveStreamabilityRenderer.offlineSlate.liveStreamOfflineSlateRenderer.scheduledStartTime;
            return { status: "UPCOMING", startTime };
        }

        if (playability.status === "OK" && playability.liveStreamability.liveStreamabilityRenderer !== undefined) {
            return { status: "LIVE" };
        }

        return { status: "OFFLINE" };
    } catch (e) {
        console.error(`Error fetching live status for channel ${id}:`, e);
        return { status: "UNKNOWN" };
    }
}

async function main() {
    const status = await getLiveStatus("UCSJ4gkVC6NrvII8umztf0Ow");
    console.log(status)
}

main();
