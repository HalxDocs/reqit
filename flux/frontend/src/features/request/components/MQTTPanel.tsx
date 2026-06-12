import { useCallback, useEffect, useRef, useState } from "react";
import { Plug, Power, Send, X, Activity } from "lucide-react";
import { useRequestStore } from "@/features/request/stores/useRequestStore";
import { cn } from "@/shared/lib/cn";
import {
  MQTTConnect,
  MQTTDisconnect,
  MQTTPublish,
  MQTTStatus,
  MQTTGetMessages,
  MQTTClearMessages,
} from "../../../../wailsjs/go/main/App";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface MQTTMessage {
  topic: string;
  payload: string;
  qos: number;
  receivedAt: number;
}

const inputClass =
  "h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text placeholder:text-subtext outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors";

export default function MQTTPanel() {
  const mqttTopic = useRequestStore((s) => s.mqttTopic);
  const mqttPayload = useRequestStore((s) => s.mqttPayload);
  const mqttQoS = useRequestStore((s) => s.mqttQoS);
  const setMqttTopic = useRequestStore((s) => s.setMqttTopic);
  const setMqttPayload = useRequestStore((s) => s.setMqttPayload);
  const setMqttQoS = useRequestStore((s) => s.setMqttQoS);

  const [brokerUrl, setBrokerUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subscribeTopics, setSubscribeTopics] = useState("");

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const logEnd = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const canConnect = brokerUrl.trim() && clientId.trim() && status === "disconnected";
  const canDisconnect = status === "connected";
  const canPublish = status === "connected" && (mqttTopic ?? "").trim() && (mqttPayload ?? "").trim();

  const handleConnect = useCallback(async () => {
    if (!canConnect) return;
    setStatus("connecting");
    try {
      await MQTTConnect(brokerUrl, clientId, username, password, subscribeTopics);
      setStatus("connected");
    } catch (e) {
      setStatus("disconnected");
      return;
    }
  }, [brokerUrl, clientId, username, password, subscribeTopics, canConnect]);

  const handleDisconnect = useCallback(async () => {
    if (!canDisconnect) return;
    await MQTTDisconnect();
    setStatus("disconnected");
  }, [canDisconnect]);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    try {
      await MQTTPublish(mqttTopic ?? "", mqttPayload ?? "", mqttQoS ?? 0);
    } catch { /* ignore */ }
  }, [mqttTopic, mqttPayload, mqttQoS, canPublish]);

  const handleClearMessages = useCallback(async () => {
    await MQTTClearMessages();
    setMessages([]);
  }, []);

  // Poll MQTT status and messages while connected
  useEffect(() => {
    if (status !== "connected") return;
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await MQTTStatus();
        if (s !== "connected") {
          setStatus("disconnected");
          return;
        }
        const msgs = await MQTTGetMessages();
        setMessages(msgs);
      } catch { /* ignore */ }
    }, 500);
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status]);

  // Auto-scroll to bottom
  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection form */}
      <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Broker URL</label>
          <input
            type="text"
            value={brokerUrl}
            onChange={(e) => setBrokerUrl(e.target.value)}
            placeholder="tcp://localhost:1883"
            disabled={status !== "disconnected"}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="flux-client"
            disabled={status !== "disconnected"}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="optional"
            disabled={status !== "disconnected"}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="optional"
            disabled={status !== "disconnected"}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Subscribe Topics</label>
          <input
            type="text"
            value={subscribeTopics}
            onChange={(e) => setSubscribeTopics(e.target.value)}
            placeholder="sensor/temp, sensor/humidity"
            disabled={status !== "disconnected"}
            className={inputClass}
          />
        </div>
      </div>

      {/* Connect/Disconnect row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {status === "disconnected" ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={!canConnect}
            className="h-[36px] px-5 bg-cyan hover:bg-cyan-hover active:scale-[0.97] text-white text-13 font-bold rounded-md flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Plug size={14} />
            Connect
          </button>
        ) : status === "connecting" ? (
          <button
            type="button"
            disabled
            className="h-[36px] px-5 bg-cyan text-white text-13 font-bold rounded-md flex items-center gap-2 opacity-60 cursor-not-allowed"
          >
            <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Connecting…
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisconnect}
            className="h-[36px] px-5 bg-danger hover:bg-danger/80 active:scale-[0.97] text-white text-13 font-bold rounded-md flex items-center gap-2 transition-all"
          >
            <Power size={14} />
            Disconnect
          </button>
        )}

        {/* Status badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1 ml-auto text-11 font-mono font-semibold",
            status === "connected" && "text-green",
            status === "connecting" && "text-warn",
            status === "disconnected" && "text-subtext",
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              status === "connected" && "bg-green",
              status === "connecting" && "bg-warn animate-pulse",
              status === "disconnected" && "bg-subtext",
            )}
          />
          {status === "connected" && "Connected"}
          {status === "connecting" && "Connecting"}
          {status === "disconnected" && "Disconnected"}
        </span>
      </div>

      {/* Publish section */}
      {status === "connected" && (
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Topic</label>
              <input
                type="text"
                value={mqttTopic}
                onChange={(e) => setMqttTopic(e.target.value)}
                placeholder="sensor/temp"
                className={inputClass}
              />
            </div>
            <div className="w-[100px] flex flex-col gap-1.5">
              <label className="text-11 text-subtext font-semibold uppercase tracking-wider">QoS</label>
              <select
                value={mqttQoS}
                onChange={(e) => setMqttQoS(Number(e.target.value))}
                className="h-[36px] px-3 bg-surface border border-border rounded-md font-mono text-12 text-text outline-none focus:border-cyan focus:ring-2 focus:ring-cyan transition-colors"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-11 text-subtext font-semibold uppercase tracking-wider">Payload</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mqttPayload}
                onChange={(e) => setMqttPayload(e.target.value)}
                placeholder='{"temp": 22.5}'
                className={cn(inputClass, "flex-1")}
              />
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish}
                className="h-[36px] px-5 bg-cyan hover:bg-cyan-hover active:scale-[0.97] text-white text-13 font-bold rounded-md flex items-center gap-2 transition-all disabled:opacity-50 shrink-0"
              >
                <Send size={14} />
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message log header */}
      <div className="flex items-center justify-between px-3 py-[6px] text-[10px] font-semibold text-subtext uppercase tracking-wider bg-card/50 border-b border-border">
        <span className="flex items-center gap-1">
          <Activity size={10} />
          Message Log ({messages.length})
        </span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearMessages}
            className="text-[10px] text-subtext hover:text-text flex items-center gap-1 transition-colors"
          >
            <X size={10} />
            Clear
          </button>
        )}
      </div>

      {/* Message log */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-surface">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-subtext gap-2 px-6">
            <Activity size={24} className="opacity-30" />
            <div className="text-12">
              {status === "connected" ? "No messages yet." : "Connect to view messages."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {messages.map((msg, i) => (
              <div key={i} className="px-3 py-2 hover:bg-card/30 transition-colors">
                <div className="flex items-center gap-2 text-11 mb-1">
                  <span className="text-cyan font-mono font-semibold">{msg.topic}</span>
                  <span className="text-subtext">QoS {msg.qos}</span>
                  <span className="text-subtext ml-auto">
                    {new Date(msg.receivedAt).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-12 text-text font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {msg.payload}
                </pre>
              </div>
            ))}
            <div ref={logEnd} />
          </div>
        )}
      </div>
    </div>
  );
}
