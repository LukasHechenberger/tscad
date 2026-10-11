/**
 * `tscad dev` client. Talks to the preview server over a WebSocket at `/ws`: each
 * `{ type: "model" }` message means `/model.glb` changed, `{ type: "error" }` carries a modeling
 * error to show on top of the last good model, and `{ type: "parameters" }` drives the parameter
 * form, whose edits go back as `{ type: "params" }`.
 */
import { escape } from '../links';
import { editorUrl, type ClientMessage, type ServerMessage } from '../protocol';
import { createViewer } from '../viewer';

let socket: WebSocket | undefined;
const send = (message: ClientMessage) =>
  socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));

const viewer = createViewer(document.querySelector<HTMLElement>('#viewer')!, {
  onParams: (values) => send({ type: 'params', values }),
});

function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data) as ServerMessage;
    if (message.type === 'parameters') return viewer.showParameters(message.schema, message.values);
    if (message.type === 'analysis') return viewer.showAnalysis(message.reports);
    if (message.type === 'error') return viewer.showError(message.message, message.editor);
    // Clear before the async load, so an error arriving meanwhile isn't overwritten.
    viewer.clearError();
    try {
      const response = await fetch(`/model.glb?v=${message.version}`);
      await viewer.showModel(await response.arrayBuffer());
      document.title = `${message.name} — tscad`;
      const name = message.editor
        ? `<a href="${escape(editorUrl(message.editor, message.file))}" title="Open in ${escape(message.editor.name)}"><b>${escape(message.name)}</b></a>`
        : `<b title="${escape(message.file)}">${escape(message.name)}</b>`;
      viewer.setStatus(`${name} · ${message.backend} kernel · rendered in ${message.renderMs} ms`);
    } catch (error) {
      viewer.showError(`Could not load model: ${error}`);
    }
  });
  socket.addEventListener('close', () => {
    viewer.setStatus('Disconnected — is `tscad dev` still running? Retrying…');
    setTimeout(connect, 1000);
  });
}
connect();
