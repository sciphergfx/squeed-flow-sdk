export type WorkflowRunStatus =
  | "subscribing"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface WorkflowExecutionUpdate {
  executionId: string;
  status?: WorkflowRunStatus;
  output?: unknown;
  error?: string;
  step?: {
    id: string;
    status: WorkflowStepStatus;
    output?: unknown;
    error?: string;
  };
}

export interface WorkflowExecutionState {
  executionId: string;
  status: WorkflowRunStatus;
  output?: unknown;
  error?: string;
  steps: Record<string, NonNullable<WorkflowExecutionUpdate["step"]>>;
}

export interface WorkflowExecutionRequest<Input> {
  executionId: string;
  input: Input;
  signal: AbortSignal;
}

export interface WorkflowExecutionAdapter<Input> {
  execute: (
    request: WorkflowExecutionRequest<Input>,
  ) => Promise<WorkflowExecutionUpdate | void>;
  subscribe: (
    request: WorkflowExecutionRequest<Input>,
    receive: (update: WorkflowExecutionUpdate) => void,
  ) => (() => void) | Promise<() => void>;
  cancel?: (request: WorkflowExecutionRequest<Input>) => Promise<void>;
}

export function createWorkflowExecution<Input>(
  adapter: WorkflowExecutionAdapter<Input>,
  onChange: (state: WorkflowExecutionState) => void,
) {
  let state: WorkflowExecutionState | undefined;
  let active:
    | (WorkflowExecutionRequest<Input> & { state: WorkflowExecutionState })
    | undefined;
  let controller: AbortController | undefined;
  let unsubscribe: (() => void) | undefined;
  const terminal = (current = state) =>
    !!current && ["completed", "failed", "cancelled"].includes(current.status);
  const release = () => {
    const cleanup = unsubscribe;
    unsubscribe = undefined;
    cleanup?.();
  };
  const receive = (update: WorkflowExecutionUpdate) => {
    if (
      !active ||
      active.signal.aborted ||
      !state ||
      update.executionId !== state.executionId ||
      terminal()
    )
      return;
    const { step, ...result } = update;
    state = {
      ...state,
      ...result,
      steps: step
        ? { ...state.steps, [step.id]: { ...state.steps[step.id], ...step } }
        : state.steps,
    };
    active.state = state;
    if (terminal()) release();
    onChange(state);
  };
  return {
    getState: () => state,
    async run(
      input: Input,
      executionId: string = crypto.randomUUID(),
    ): Promise<WorkflowExecutionState> {
      if (active && !active.signal.aborted && !terminal())
        throw new Error("An execution is already active.");
      controller?.abort();
      release();
      controller = new AbortController();
      const request = {
        executionId,
        input,
        signal: controller.signal,
        state: {
          executionId,
          status: "subscribing",
          steps: {},
        } as WorkflowExecutionState,
      };
      active = request;
      state = request.state;
      onChange(state);
      try {
        const cleanup = await adapter.subscribe(request, (update) => {
          if (active === request) receive(update);
        });
        if (active !== request || request.signal.aborted || terminal()) {
          cleanup();
          return request.state;
        }
        unsubscribe = cleanup;
        receive({ executionId, status: "running" });
        if (
          active !== request ||
          request.signal.aborted ||
          terminal(request.state)
        )
          return request.state;
        const result = await adapter.execute(request);
        if (active === request && result) receive(result);
      } catch (cause) {
        if (terminal(request.state)) return request.state;
        if (active === request && !request.signal.aborted)
          receive({
            executionId,
            status: "failed",
            error: cause instanceof Error ? cause.message : String(cause),
          });
        throw cause;
      }
      return request.state;
    },
    async cancel() {
      const request = active;
      if (!request || request.signal.aborted || terminal()) return;
      if (!adapter.cancel)
        throw new Error("This adapter does not support cancellation.");
      await adapter.cancel(request);
      if (active === request)
        receive({ executionId: request.executionId, status: "cancelled" });
    },
    dispose() {
      controller?.abort();
      active = undefined;
      release();
    },
  };
}
