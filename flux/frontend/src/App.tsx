import { Sidebar } from "./components/Sidebar/Sidebar";
import { RequestPanel } from "./components/RequestPanel/RequestPanel";
import { ResponsePane } from "./components/ResponsePane/ResponsePane";
import { useSendRequest } from "./hooks/useSendRequest";
import "./App.css";

export default function App() {
  const send = useSendRequest();

  return (
    <div className="h-screen w-screen flex bg-bg text-text">
      <Sidebar />
      <RequestPanel onSend={send} />
      <ResponsePane />
    </div>
  );
}
