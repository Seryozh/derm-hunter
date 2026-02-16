import { RawChannel, RecentVideo } from "./types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set");
  return key;
}

// --- Search for videos by query, extract unique channel IDs ---

interface SearchResult {
  channelIds: string[];
  quotaUsed: number;
}

export async function searchDermVideos(query: string, maxResults = 50): Promise<SearchResult> {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(Math.min(maxResults, 50)));
  url.searchParams.set("regionCode", "US");
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("key", getApiKey());

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`YouTube search failed: ${response.status} ${response.statusText} — ${errorBody}`);
  }

  const data = await response.json();
  const items = data?.items;
  if (!Array.isArray(items)) {
    console.warn("YouTube search returned no items for query:", query);
    return { channelIds: [], quotaUsed: 100 };
  }

  // Extract unique channel IDs from video results
  const channelIds = new Set<string>();
  for (const item of items) {
    const channelId = item?.snippet?.channelId;
    if (typeof channelId === "string" && channelId.length > 0) {
      channelIds.add(channelId);
    }
  }

  return {
    channelIds: Array.from(channelIds),
    quotaUsed: 100, // search.list always costs 100 units
  };
}

// --- Get channel details in batch (up to 50 at a time) ---

export async function getChannelDetails(
  channelIds: string[],
  discoveryQuery: string
): Promise<{ channels: RawChannel[]; quotaUsed: number }> {
  if (channelIds.length === 0) return { channels: [], quotaUsed: 0 };

  // Batch in groups of 50
  const batches: string[][] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    batches.push(channelIds.slice(i, i + 50));
  }

  const allChannels: RawChannel[] = [];
  let totalQuota = 0;

  for (const batch of batches) {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`);
    url.searchParams.set("part", "snippet,statistics,contentDetails,brandingSettings");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", getApiKey());

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`YouTube channels.list failed: ${response.status} — ${errorBody}`);
      totalQuota += 1;
      continue; // Don't crash — skip this batch
    }

    const data = await response.json();
    totalQuota += 1; // channels.list costs 1 unit per call

    const items = data?.items;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      try {
        const snippet = item?.snippet;
        const stats = item?.statistics;
        const content = item?.contentDetails;

        if (!snippet || !stats) continue;

        // subscriberCount is a STRING from the API
        const subCountRaw = stats.subscriberCount;
        const subscriberCount = typeof subCountRaw === "string"
          ? parseInt(subCountRaw, 10)
          : typeof subCountRaw === "number"
            ? subCountRaw
            : 0;

        // Some channels hide subscriber count
        const hiddenSubs = stats.hiddenSubscriberCount === true;

        const channel: RawChannel = {
          channelId: item.id,
          title: snippet.title || "Unknown",
          description: snippet.description || "",
          thumbnailUrl: snippet.thumbnails?.high?.url
            || snippet.thumbnails?.medium?.url
            || snippet.thumbnails?.default?.url
            || "",
          subscriberCount: hiddenSubs ? -1 : subscriberCount, // -1 = hidden
          videoCount: parseInt(stats.videoCount || "0", 10),
          viewCount: parseInt(stats.viewCount || "0", 10),
          country: snippet.country || null,
          customUrl: snippet.customUrl || null,
          uploadsPlaylistId: content?.relatedPlaylists?.uploads || null,
          discoveryQuery,
        };

        allChannels.push(channel);
      } catch (err) {
        console.error("Error parsing channel:", item?.id, err);
        // Don't crash — skip malformed channels
      }
    }
  }

  return { channels: allChannels, quotaUsed: totalQuota };
}

// --- Get recent videos for a channel ---

export async function getRecentVideos(
  channelId: string,
  uploadsPlaylistId: string | null,
  maxResults = 5
): Promise<{ videos: RecentVideo[]; quotaUsed: number }> {
  // If we don't have the uploads playlist ID, derive it
  // Channel ID format: UCxxxxxx → uploads playlist: UUxxxxxx
  const playlistId = uploadsPlaylistId
    || (channelId.startsWith("UC") ? "UU" + channelId.slice(2) : null);

  if (!playlistId) {
    return { videos: [], quotaUsed: 0 };
  }

  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", playlistId);
  url.searchParams.set("maxResults", String(Math.min(maxResults, 50)));
  url.searchParams.set("key", getApiKey());

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      // Common: playlist might be private or channel has no uploads
      console.warn(`playlistItems failed for ${channelId}: ${response.status}`);
      return { videos: [], quotaUsed: 1 };
    }

    const data = await response.json();
    const items = data?.items;
    if (!Array.isArray(items)) return { videos: [], quotaUsed: 1 };

    const videos: RecentVideo[] = [];
    for (const item of items) {
      const snippet = item?.snippet;
      if (!snippet) continue;

      videos.push({
        videoId: snippet.resourceId?.videoId || "",
        title: snippet.title || "Untitled",
        publishedAt: snippet.publishedAt || "",
      });
    }

    return { videos, quotaUsed: 1 };
  } catch (err) {
    console.error(`getRecentVideos failed for ${channelId}:`, err);
    return { videos: [], quotaUsed: 1 };
  }
}
