/*
 * Data adapter for the Fibery custom app.
 * The field and database names below match one personal-OS workspace
 * ("Personal OS" + "AI Agents Org" spaces). Rename them to match yours:
 * Life Area -> wing, Project -> pedestal, Goal (with a priority slot) -> throne pillars,
 * Task (ranked by a score) -> missions, Scorecard + Metrics -> monuments, Idea -> fountain.
 */
import {queryEntities, updateEntity, getWorkflowStates, getDocument} from "@/lib/fibery";

type Q = {type: string; fields: unknown; where?: unknown; params?: Record<string, unknown>; orderBy?: {field: string[]; direction: "asc" | "desc"}; limit: number; urlPath?: string};

const TASK = "Personal OS/Task";

export const Queries = {
  projects: (): Q => ({
    type: "Personal OS/Project",
    urlPath: "Personal_OS/Project",
    fields: {
      Id: ["fibery/id"],
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
      Platform: ["AI Agents Org/Platform", "AI Agents Org/Name"],
      Quota: ["AI Agents Org/Platform", "AI Agents Org/Quota left pct"],
      Resets: ["AI Agents Org/Platform", "AI Agents Org/Quota resets at"],
      Checked: ["AI Agents Org/Platform", "AI Agents Org/Quota checked at"],
      Projects: {"q/from": "AI Agents Org/Projects", "q/select": {Name: ["Personal OS/Name"]}, "q/limit": 2},
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
  doneAll: (): Q => ({
    type: TASK,
    fields: {Proj: ["Personal OS/Project", "Personal OS/Name"], Area: ["Personal OS/Project", "Personal OS/Life Area", "Personal OS/Name"]},
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["Done"]},
    limit: 3000,
  }),
  msDone: (): Q => ({
    type: "Personal OS/Milestone",
    fields: {Proj: ["Personal OS/Project", "Personal OS/Name"], Area: ["Personal OS/Project", "Personal OS/Life Area", "Personal OS/Name"]},
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["Done"]},
    limit: 1000,
  }),
  runs: (): Q => ({
    type: "AI Agents Org/Run",
    fields: {
      By: ["AI Agents Org/Run By", "AI Agents Org/Name"],
      Name: ["AI Agents Org/Name"],
      Task: ["AI Agents Org/Task", "Personal OS/Name"],
      Proj: ["AI Agents Org/Task", "Personal OS/Project", "Personal OS/Name"],
      Note: ["AI Agents Org/Note"],
      Started: ["AI Agents Org/Started"],
    },
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["Working"]},
    orderBy: {field: ["fibery/creation-date"], direction: "desc"},
    limit: 40,
  }),
  agentTasks: (): Q => ({
    type: TASK,
    fields: {Id: ["fibery/id"], Name: ["Personal OS/Name"], Delegate: ["Personal OS/Delegate", "AI Agents Org/Name"], Proj: ["Personal OS/Project", "Personal OS/Name"]},
    where: ["q/in", ["workflow/state", "enum/name"], "$states"],
    params: {$states: ["In Progress"]},
    limit: 200,
  }),
  area: (name: string): Q => ({
    type: "Personal OS/Project",
    urlPath: "Personal_OS/Project",
    fields: {
      Id: ["fibery/id"],
      PublicId: ["fibery/public-id"],
      Name: ["Personal OS/Name"],
      State: ["workflow/state", "enum/name"],
      Open: ["Personal OS/Open Tasks (own)"],
      Score: ["Personal OS/Project Score"],
      Since: ["Personal OS/Days Since Last Done Task"],
      Next: ["Personal OS/Next action"],
      Milestones: {"q/from": "Personal OS/Milestones", "q/select": {State: ["workflow/state", "enum/name"]}, "q/limit": 30},
      Decisions: {"q/from": "Decisions/Decisions", "q/select": {State: ["workflow/state", "enum/name"]}, "q/limit": 30},
      Subs: {"q/from": "Personal OS/Subprojects", "q/select": {Name: ["Personal OS/Name"]}, "q/limit": 20},
    },
    where: ["q/and", ["q/equals-ignoring-case?", ["Personal OS/Life Area", "Personal OS/Name"], "$area"], ["q/in", ["workflow/state", "enum/name"], "$states"]],
    params: {$area: name, $states: ["Active", "Next Up", "Maintenance"]},
    orderBy: {field: ["Personal OS/Project Score"], direction: "desc"},
    limit: 40,
  }),
  project: (id: string): Q => ({
    type: "Personal OS/Project",
    urlPath: "Personal_OS/Project",
    fields: {
      PublicId: ["fibery/public-id"],
      Name: ["Personal OS/Name"],
      Snip: ["Personal OS/Description", "Collaboration~Documents/Snippet"],
      Milestones: {"q/from": "Personal OS/Milestones", "q/select": {Name: ["Personal OS/Name"], State: ["workflow/state", "enum/name"], Target: ["Personal OS/Target date"]}, "q/limit": 20},
      Tasks: {"q/from": "Personal OS/Tasks", "q/select": {Name: ["Personal OS/Name"], State: ["workflow/state", "enum/name"], Delegate: ["Personal OS/Delegate", "AI Agents Org/Name"]}, "q/order-by": [[["fibery/modification-date"], "q/desc"]], "q/limit": 60},
      Decisions: {"q/from": "Decisions/Decisions", "q/select": {Name: ["Decisions/Name"], State: ["workflow/state", "enum/name"]}, "q/limit": 12},
      Subs: {"q/from": "Personal OS/Subprojects", "q/select": {Id: ["fibery/id"], Name: ["Personal OS/Name"], Open: ["Personal OS/Open Tasks (own)"]}, "q/limit": 12},
      Agents: {"q/from": "Personal OS/Agents", "q/select": {Name: ["AI Agents Org/Name"]}, "q/limit": 8},
    },
    where: ["=", ["fibery/id"], "$id"],
    params: {$id: id},
    limit: 1,
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

function textOf(node: any): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  const kids = Array.isArray(node.content) ? node.content : [];
  return kids.map(textOf).join(node.type === "paragraph" ? "" : " ");
}

/* The latest comment on a task, as plain text: shown as the working agent's thought. */
async function lastComment(taskId: string): Promise<string | null> {
  const rows = await queryEntities<any>({
    type: TASK,
    fields: {C: {"q/from": "comments/comments", "q/select": {S: ["comment/document-secret"], D: ["fibery/creation-date"]}, "q/order-by": [[["fibery/creation-date"], "q/desc"]], "q/limit": 1}} as never,
    where: ["=", ["fibery/id"], "$id"],
    params: {$id: taskId},
    limit: 1,
  });
  const secret = rows[0]?.C?.[0]?.S;
  if (!secret) return null;
  const doc: any = await getDocument({secret});
  const t = textOf(doc?.doc).replace(/\s+/g, " ").trim();
  return t || null;
}

export const PalaceApi = {Q: Queries, query, write, lastComment};
