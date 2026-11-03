/*
 * Data adapter for the Fibery custom app.
 * The field and database names below match one personal-OS workspace
 * ("Personal OS" + "AI Agents Org" spaces). Rename them to match yours:
 * Life Area -> wing, Project -> pedestal, Goal (with a priority slot) -> throne pillars,
 * Task (ranked by a score) -> missions, Scorecard + Metrics -> monuments, Idea -> fountain.
 */
import {queryEntities, updateEntity, getWorkflowStates} from "@/lib/fibery";

type Q = {type: string; fields: unknown; where?: unknown; params?: Record<string, unknown>; orderBy?: {field: string[]; direction: "asc" | "desc"}; limit: number; urlPath?: string};

const TASK = "Personal OS/Task";

export const Queries = {
  projects: (): Q => ({
    type: "Personal OS/Project",
    urlPath: "Personal_OS/Project",
    fields: {
      PublicId: ["fibery/public-id"],
      Name: ["Personal OS/Name"],
      State: ["workflow/state", "enum/name"],
      Area: ["Personal OS/Life Area", "Personal OS/Name"],
      Goal: ["Personal OS/Goal", "Personal OS/Name"],
      ShipGate: ["Personal OS/Ship Gate", "enum/name"],
      Open: ["Personal OS/Open Tasks (own)"],
      Next: ["Personal OS/Next action"],
      Agents: {"q/from": "Personal OS/Agents", "q/select": {Name: ["AI Agents Org/Name"]}, "q/limit": 5},
    },
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["Active", "Next Up", "Maintenance"]},
    limit: 200,
  }),
  goals: (): Q => ({
    type: "Personal OS/Goal",
    urlPath: "Personal_OS/Goal",
    fields: {
      PublicId: ["fibery/public-id"],
      Name: ["Personal OS/Name"],
      MAX: ["Personal OS/MAX THREE", "enum/name"],
      Metric: ["Personal OS/Success metric"],
      Target: ["Personal OS/Target date"],
    },
    limit: 60,
  }),
  missions: (): Q => ({
    type: TASK,
    urlPath: "Personal_OS/Task",
    fields: {
      Id: ["fibery/id"],
      PublicId: ["fibery/public-id"],
      Name: ["Personal OS/Name"],
      State: ["workflow/state", "enum/name"],
      Project: ["Personal OS/Project", "Personal OS/Name"],
      Priority: ["Personal OS/Priority", "enum/name"],
      Due: ["Personal OS/Due"],
      Delegate: ["Personal OS/Delegate", "AI Agents Org/Name"],
      GoalP: ["Personal OS/Goal Priority"],
      Blocked: ["Personal OS/Blocked?"],
    },
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["Todo", "In Progress"]},
    orderBy: {field: ["Personal OS/Execution Score"], direction: "desc"},
    limit: 60,
  }),
  agents: (): Q => ({
    type: "AI Agents Org/Agent",
    fields: {
      Id: ["fibery/id"],
      Name: ["AI Agents Org/Name"],
      Class: ["AI Agents Org/Class", "enum/name"],
      Status: ["AI Agents Org/Status", "enum/name"],
    },
    orderBy: {field: ["AI Agents Org/Name"], direction: "asc"},
    limit: 300,
  }),
  ideas: (): Q => ({
    type: "Personal OS/Idea",
    fields: {Name: ["Personal OS/Name"], Verdict: ["Personal OS/FATE verdict"]},
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["Inbox", "Evaluating"]},
    orderBy: {field: ["fibery/creation-date"], direction: "desc"},
    limit: 40,
  }),
  scorecards: (): Q => ({
    type: "Personal OS/Scorecard",
    urlPath: "Personal_OS/Scorecard",
    fields: {
      PublicId: ["fibery/public-id"],
      Name: ["Personal OS/Name"],
      Score: ["Personal OS/Score"],
      Off: ["Personal OS/Metrics Off"],
      Area: ["Personal OS/Life Area", "Personal OS/Name"],
      Goal: ["Personal OS/Goal", "Personal OS/Name"],
      Metrics: {
        "q/from": "Personal OS/Metrics",
        "q/select": {
          Name: ["Personal OS/Name"],
          Status: ["Personal OS/Status"],
          Att: ["Personal OS/Attainment"],
          Trend: ["Personal OS/Trend"],
          Val: ["Personal OS/Latest Value"],
          Target: ["Personal OS/Target"],
          Unit: ["Personal OS/Unit"],
        },
        "q/limit": 12,
      },
    },
    limit: 50,
  }),
  doneWeek: (): Q => ({
    type: TASK,
    fields: {Id: ["fibery/id"]},
    where: [">=", ["Personal OS/Completed on"], "$since"],
    params: {$since: new Date(Date.now() - 7 * 864e5).toISOString()},
    limit: 1000,
  }),
};

async function query(q: Q): Promise<Record<string, unknown>[]> {
  const rows = await queryEntities<Record<string, unknown>>({
    type: q.type,
    // Aliased select map: Fibery accepts it as-is; the helper's type only models the list form.
    fields: q.fields as never,
    where: q.where,
    params: q.params,
    orderBy: q.orderBy,
    limit: q.limit,
  });
  const origin = window.location.ancestorOrigins?.[0] || "";
  return rows.map((r) => (q.urlPath && r.PublicId ? {...r, url: `${origin}/${q.urlPath}/${r.PublicId}`} : r));
}

let stateCache: {id: string; name: string}[] | null = null;

async function write(tool: string, input: any): Promise<void> {
  if (tool === "set_state") {
    stateCache = stateCache || (await getWorkflowStates({type: TASK}));
    const s = stateCache.find((x) => x.name === input.state);
    if (!s) throw new Error(`No workflow state called ${input.state}`);
    await updateEntity({type: TASK, id: input.entityId, values: {"workflow/state": {"fibery/id": s.id}}});
    return;
  }
  if (tool === "update_entities") {
    for (const e of input.entities) {
      await updateEntity({type: TASK, id: e.id, values: {"Personal OS/Delegate": {"fibery/id": e["Personal OS/Delegate"]}}});
    }
    return;
  }
  throw new Error(`Unknown action ${tool}`);
}

export const PalaceApi = {Q: Queries, query, write};
