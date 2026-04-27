import { Sidebar } from "./components/Sidebar/Sidebar";
import { RequestPanel } from "./components/RequestPanel/RequestPanel";
import { ResponsePane } from "./components/ResponsePane/ResponsePane";
import "./App.css";

export default function App() {
  return (
    <div className="h-screen w-screen flex bg-bg text-text">
      <Sidebar />
      <RequestPanel />
      <ResponsePane />
    </div>
  );
}
