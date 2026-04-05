// Stub for react-devtools-core on web — the real package contains
// pre-bundled webpack chunks that use `import.meta`, which breaks the
// Metro web bundle. DevTools still work via the browser extension.
module.exports = {
  initialize: () => {},
  connectToDevTools: () => {},
  connectWithCustomMessagingProtocol: () => {},
};
