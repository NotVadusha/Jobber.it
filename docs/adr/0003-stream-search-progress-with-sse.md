# Stream search progress with server-sent events

Search progress flows from the server to one browser request. Release 1 will use a fetch-readable server-sent event response instead of WebSockets. The browser will cancel through AbortSignal, and the server will emit only real stage changes.
