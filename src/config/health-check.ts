/**
 * Startup gate timing. Inference runs in the browser, so there is no health endpoint to
 * poll — the gate waits on the model download instead.
 */

/** Time the "model ready" confirmation stays on screen before the dashboard fades in. */
export const GATE_READY_GRACE_MS = 600;
