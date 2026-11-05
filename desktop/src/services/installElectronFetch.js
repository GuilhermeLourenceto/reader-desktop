// Browser-compatible fetch using the established Electron IPC session.
// Keep the request, cancellation and response behavior from renderer.jsx.
export function installElectronFetch(isClosing) {
  window.fetch = async (input, init) => {
    if (isClosing())
      throw new DOMException('O aplicativo está sendo fechado.', 'AbortError');
    const request = new Request(input, init);
    request.signal.throwIfAborted();
    const requestId = crypto.randomUUID();
    const cancel = () => {
      void window.desktop.cancelRequest(requestId).catch(() => {});
    };
    const body = ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : new Uint8Array(await request.arrayBuffer());
    request.signal.throwIfAborted();
    const pending = window.desktop.request(request.url, {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body,
      requestId,
    });
    request.signal.addEventListener('abort', cancel, { once: true });
    let result;
    try {
      result = await pending;
      request.signal.throwIfAborted();
    } catch (error) {
      request.signal.throwIfAborted();
      throw error;
    } finally {
      request.signal.removeEventListener('abort', cancel);
    }
    const bytes = Uint8Array.from(atob(result.body), (char) =>
      char.charCodeAt(0),
    );
    const response = new Response(
      request.method === 'HEAD' || [204, 205, 304].includes(result.status)
        ? null
        : bytes,
      result,
    );
    Object.defineProperty(response, 'url', { value: result.url });
    Object.defineProperty(response, 'redirected', {
      value: result.url !== request.url,
    });
    return response;
  };
}
