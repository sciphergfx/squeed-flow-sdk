/** @port output output */
interface Workflow {
  name: string;
  trigger: string;
}

/**
 * @port input input
 * @port output output
 */
interface ConditionalConfig {
  condition: string;
  onTrue: string;
  onFalse: string;
}

/**
 * @port input input
 * @port output output
 */
interface WorkflowCallConfig {
  workflowId: string;
  input: any;
}

/** @port input input */
interface ConditionalOutputConfig {
  mapping: any;
}
