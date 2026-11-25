// "The phone could not reach the internet or the server" in plain words, instead of a technical message (pure, tested in
// scripts/test-neterror.ts).
const NETWORK = /unknownhost|unable to resolve host|no address associated|network request failed|failed to fetch|fetch failed|networkerror|enotfound|econnrefused|econnreset|etimedout|timed? ?out|socketexception|connection (refused|reset|closed)|load failed/i;

export const isNetworkError = (message: string): boolean => NETWORK.test(message);

/** The message to show: the friendly `offline` text for connection problems, otherwise the message itself. */
export const explain = (message: string, offline: string): string => (isNetworkError(message) ? offline : message);
