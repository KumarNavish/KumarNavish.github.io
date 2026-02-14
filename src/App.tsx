import { useState } from "react";
import "./App.css";
import { runRouterIncrementalDemo } from "./cl/router";
import { EvaluatePanel } from "./components/evaluate_panel";
import { PipelinePanel } from "./components/pipeline_panel";
import { WebLlmPanel } from "./components/webllm_panel";
import { embed } from "./retrieval/embed_client";

function App() {
  const [embeddingState, setEmbeddingState] = useState("Idle");
  const [embeddingSummary, setEmbeddingSummary] = useState("");
  const [routerSummary, setRouterSummary] = useState("");
  const [routerState, setRouterState] = useState("Idle");

  const handleEmbeddingSmokeTest = async () => {
    const sampleTexts = [
      "Please provision finance dashboard access for quarter-end review.",
      "Onboard a new supplier for payments processing.",
      "Escalate incident INC-2201 due to checkout outage.",
    ];
    setEmbeddingState("Loading model and generating embeddings...");
    setEmbeddingSummary("");

    try {
      const embeddings = await embed(sampleTexts);
      const summary = embeddings
        .map((vector, index) => `Text ${index + 1}: ${vector.length} dims`)
        .join(" | ");

      setEmbeddingState("Embedding smoke test succeeded.");
      setEmbeddingSummary(summary);
      console.log("Embedding smoke test vectors", embeddings);
    } catch (error) {
      setEmbeddingState("Embedding smoke test failed.");
      setEmbeddingSummary(error instanceof Error ? error.message : "Unknown embedding error");
    }
  };

  const handleRouterDemo = () => {
    setRouterState("Running incremental router demo...");
    setRouterSummary("");
    try {
      const result = runRouterIncrementalDemo();
      setRouterState("Router demo complete.");
      setRouterSummary(JSON.stringify(result, null, 2));
      console.log("Router CL demo summary", result);
    } catch (error) {
      setRouterState("Router demo failed.");
      setRouterSummary(error instanceof Error ? error.message : "Unknown router demo error");
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="label">Demo Scaffold</p>
        <h1>Continual Process Automation Copilot</h1>
        <p>
          Retrieval foundations are now wired with a Transformers.js embedding worker and vector
          store primitives.
        </p>
        <div className="smoke-box">
          <button type="button" onClick={handleEmbeddingSmokeTest}>
            Run embedding smoke test
          </button>
          <p className="status">{embeddingState}</p>
          {embeddingSummary ? <p className="summary">{embeddingSummary}</p> : null}
        </div>
        <div className="smoke-box">
          <button type="button" onClick={handleRouterDemo}>
            Run router CL demo
          </button>
          <p className="status">{routerState}</p>
          {routerSummary ? (
            <pre className="summary summary-block">{routerSummary}</pre>
          ) : null}
        </div>
        <EvaluatePanel />
        <PipelinePanel />
        <WebLlmPanel />
      </section>
    </main>
  );
}

export default App;
