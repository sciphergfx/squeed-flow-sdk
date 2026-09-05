import type { FormChange, FormEdit, FormOptionsRequest } from "../../src/core/forms";

export function resolveExampleOptions(request: FormOptionsRequest) {
  if (request.address.endsWith(".model")) return [{ label: "Example Model", value: "example-model" }];
  if (request.address.endsWith(".memory")) return [
    { label: "Knowledge Entries", value: "knowledge_entry" },
    { label: "Support Answers", value: "support_qa" },
  ];
  if (request.address.endsWith(".tools")) return [
    { label: "Directory Lookup", value: "directory_lookup" },
    { label: "Issue Lookup", value: "issue_lookup" },
  ];
  return [];
}

export function onExampleFormChange(change: FormChange): FormEdit[] {
  if (change.address !== "root.trigger.type") return [];
  return ["event", "cron"]
    .filter(key => key !== (change.value === "event" ? "event" : change.value === "schedule" ? "cron" : ""))
    .map(key => ({ op: "remove", address: `root.trigger.${key}` }));
}