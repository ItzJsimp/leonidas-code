import { JevClientProtocol, MockJevClient } from "./typesafeClient.js";
import { NoteChunk, NotesSelectionResult, pickNotes } from "./notesSelector.js";
import { RouteResult, WorkerTier, routeStep } from "./workerRouter.js";
import { RecoveryPlan, recoverFailure } from "./recoveryEngine.js";
import { CheckPipelineResult, runStagedChecks } from "./focusedChecks.js";

export interface ToolFailure {
  tool: string;
  command: string;
  error: string;
  attempt: number;
}

export interface StepTrace {
  stepNumber: number;
  stepDescription: string;
  notesResult: NotesSelectionResult;
  routeResult: RouteResult;
  workerUsed: string;
  recoveryPlans: RecoveryPlan[];
  checksResult?: CheckPipelineResult;
  estimatedCostDollars: number;
}

export class AgentHarness {
  private jev: JevClientProtocol;
  private notes: NoteChunk[];
  private alwaysNotes: NoteChunk[];
  private testFiles: string[];
  private currentDiff = "";
  private traces: StepTrace[] = [];

  constructor(options: {
    notes: NoteChunk[];
    alwaysNotes?: NoteChunk[];
    testFiles?: string[];
    jevClient?: JevClientProtocol;
  }) {
    this.notes = options.notes;
    this.alwaysNotes = options.alwaysNotes || [];
    this.testFiles = options.testFiles || [];
    this.jev = options.jevClient || new MockJevClient();
  }

  async runStep(
    stepDescription: string,
    simulatedFailures: ToolFailure[] = [],
  ): Promise<StepTrace> {
    const stepNumber = this.traces.length + 1;

    // 1. Notes selection
    const notesResult = await pickNotes(
      stepDescription,
      this.notes,
      this.jev,
      this.alwaysNotes,
      6,
      0.55,
    );

    // 2. Routing
    const routeResult = await routeStep(stepDescription, this.currentDiff, this.jev, 0.8);

    const workerUsed = routeResult.tier === "fast" ? "Haiku-4.5" : "Opus-5.5";
    const estimatedCostDollars = routeResult.tier === "fast" ? 0.0169 : 0.0742;

    // Update diff simulation
    this.currentDiff = `--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,5 @@\n+// Implemented ${stepDescription}\n`;

    // 3. Recovery
    const recoveryPlans: RecoveryPlan[] = [];
    for (const fail of simulatedFailures) {
      const plan = await recoverFailure(
        fail.tool,
        fail.command,
        fail.error,
        fail.attempt,
        this.jev,
        3,
        0.8,
      );
      recoveryPlans.push(plan);
    }

    // 4. Checks
    let checksResult: CheckPipelineResult | undefined;
    if (this.testFiles.length) {
      checksResult = await runStagedChecks(
        this.currentDiff,
        this.testFiles,
        this.jev,
        async (tests) => ({ ok: true, message: `Passed ${tests.length} tests` }),
        async () => ({ ok: true, message: "Typecheck ok" }),
      );
    }

    const trace: StepTrace = {
      stepNumber,
      stepDescription,
      notesResult,
      routeResult,
      workerUsed,
      recoveryPlans,
      checksResult,
      estimatedCostDollars,
    };

    this.traces.push(trace);
    return trace;
  }

  getTraces(): StepTrace[] {
    return this.traces;
  }
}
