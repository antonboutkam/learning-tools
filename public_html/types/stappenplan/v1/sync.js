(function (root) {
  "use strict";

  function connect(Channel, group, count, onStep, onMismatch) {
    const channel = new Channel(`stappenplan:v1:${group}`);
    const source = root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let revision = { sequence: 0, source: "" };
    let index = 0;
    const send = (type) => channel.postMessage({ type, source, count, index, revision });
    channel.onmessage = ({ data }) => {
      if (!data || data.source === source || data.count !== count) {
        if (data && data.count !== count) onMismatch();
        return;
      }
      if (data.type === "request") {
        send("state");
        return;
      }
      if (data.type !== "state" || !Number.isInteger(data.index) || data.index < 0 || data.index >= count ||
          !data.revision || !Number.isSafeInteger(data.revision.sequence) || data.revision.sequence < 0 ||
          typeof data.revision.source !== "string") return;
      const newer = data.revision.sequence > revision.sequence ||
        (data.revision.sequence === revision.sequence && data.revision.source > revision.source);
      if (!newer) return;
      revision = data.revision;
      index = data.index;
      onStep(index);
    };
    send("request");
    return {
      publish(nextIndex) {
        if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= count || nextIndex === index) return;
        index = nextIndex;
        revision = { sequence: revision.sequence + 1, source };
        send("state");
      },
      close() { channel.close(); }
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { connect };
  else root.StappenplanSync = { connect };
})(typeof window === "undefined" ? globalThis : window);
