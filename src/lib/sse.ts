export interface SSEEvent {
  event?: string;
  data: string;
}

export interface SSEParser {
  push(chunk: string): void;
  flush(): void;
}

/**
 * Incremental parser for the text/event-stream format.
 * Feed it decoded text chunks in any split; it emits complete events.
 */
export function createSSEParser(onEvent: (event: SSEEvent) => void): SSEParser {
  let buffer = '';
  let eventName: string | undefined;
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length > 0) {
      onEvent({ event: eventName, data: dataLines.join('\n') });
    }
    eventName = undefined;
    dataLines = [];
  };

  const handleLine = (raw: string) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) return; // comment / keep-alive

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') eventName = value;
    else if (field === 'data') dataLines.push(value);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    },
    flush() {
      if (buffer.length > 0) {
        handleLine(buffer);
        buffer = '';
      }
      dispatch();
    },
  };
}
