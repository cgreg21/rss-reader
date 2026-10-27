const RETRY_MS = 5000;

/** WebSocket that reconnects on its own; `onChanged` fires when the server reports a change from another device. */
export class LiveChannel {
  private socket: WebSocket | undefined;
  private url = '';
  private retry: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly onChanged: () => void) {}

  /** Opens (or keeps) a connection to `url`; an empty url closes it. */
  open(url: string): void {
    if (url === this.url && (!url || this.socket)) return;
    this.close();
    this.url = url;
    if (url) this.connect();
  }

  close(): void {
    this.url = '';
    clearTimeout(this.retry);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }

  private connect(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onmessage = (event) => {
      if (event.data === 'changed') this.onChanged();
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.retry = setTimeout(() => this.url && this.connect(), RETRY_MS);
    };
  }
}
