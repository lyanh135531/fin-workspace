export function debug(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_FIN !== "true") return;
  console.info("[fin-debug]", JSON.stringify({ event, at: new Date().toISOString(), ...details }));
}
