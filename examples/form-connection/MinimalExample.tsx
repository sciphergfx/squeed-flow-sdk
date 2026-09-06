import { useEffect, useState } from "react";
import {
  FlowDiagram,
  readFormSchema,
  type FormSchema,
  type SqueedJson,
} from "@squeed/flow-sdk";
import initialState from "./state.json";
import initialView from "./minimal-view.json";
import bindings from "./bindings.json";
import interfaceSource from "./interface.ts?raw";

export default function MinimalExample() {
  const [state, setState] = useState<SqueedJson>(initialState);
  const [view, setView] = useState<SqueedJson>(initialView);
  const [schema, setSchema] = useState<FormSchema>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const file = new File([interfaceSource], "interface.ts", {
      type: "text/plain",
    });
    const types = [
      ...new Set(Object.values(bindings).map((binding) => binding.type)),
    ];
    readFormSchema(file, types).then(
      (value) => {
        if (active) setSchema(value);
      },
      (cause) => {
        if (active) setError(String(cause));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!schema) return <p role="status">Loading form...</p>;

  return (
    <div style={{ width: "100%", height: "min(640px, 85vh)" }}>
      <FlowDiagram
        json={view}
        forms={{ state, bindings, onStateChange: setState }}
        config={{
          formSchema: schema,
          direction: "LR",
          edgeMode: "auto",
          editable: true,
        }}
        callbacks={{ onJsonChange: setView }}
      />
    </div>
  );
}
