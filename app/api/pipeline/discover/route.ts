// Phase 1: YouTube Discovery
// Searches YouTube with derm queries, gets channel details + recent videos

import { NextResponse } from "next/server";
import { searchDermVideos, getChannelDetails, getRecentVideos } from "../../../../lib/youtube";
import { DERM_QUERIES } from "../../../../lib/derm-queries";
import { DiscoveredDoctor } from "../../../../lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxQueries = Math.min(body.maxQueries || 3, DERM_QUERIES.length);
    const queries = DERM_QUERIES.slice(0, maxQueries);

    const allChannelIds = new Set<string>();
    const channelToQuery = new Map<string, string>();
    let totalQuota = 0;

    // Step 1: Search for videos across all queries
    for (const query of queries) {
      const { channelIds, quotaUsed } = await searchDermVideos(query, 50);
      totalQuota += quotaUsed;

      for (const id of channelIds) {
        if (!allChannelIds.has(id)) {
          allChannelIds.add(id);
          channelToQuery.set(id, query);
        }
      }
    }

    if (allChannelIds.size === 0) {
      return NextResponse.json({
        doctors: [],
        stats: { queries: queries.length, channelsFound: 0, quotaUsed: totalQuota },
      });
    }

    // Step 2: Get channel details
    const channelIdArray = Array.from(allChannelIds);
    const { channels, quotaUsed: channelQuota } = await getChannelDetails(
      channelIdArray,
      "multi-query"
    );
    totalQuota += channelQuota;

    // Step 3: Get recent videos for each channel
    const doctors: DiscoveredDoctor[] = [];
    for (const channel of channels) {
      const { videos, quotaUsed: videoQuota } = await getRecentVideos(
        channel.channelId,
        channel.uploadsPlaylistId,
        5
      );
      totalQuota += videoQuota;

      const lastUploadDate = videos.length > 0
        ? videos.reduce((latest, v) =>
            v.publishedAt > latest ? v.publishedAt : latest, videos[0].publishedAt)
        : null;

      // Update discovery query to the actual query that found it
      channel.discoveryQuery = channelToQuery.get(channel.channelId) || "unknown";

      doctors.push({
        channel,
        recentVideos: videos,
        lastUploadDate,
      });
    }

    return NextResponse.json({
      doctors,
      stats: {
        queries: queries.length,
        channelsFound: channels.length,
        quotaUsed: totalQuota,
      },
    });
  } catch (error) {
    console.error("Discovery failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
