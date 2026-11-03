# Fibery custom app

These files turn a Fibery custom app into the Happy Palace, reading and writing your workspace as the signed-in user.

## Files

- `src/App.tsx`: mounts the HUD markup and starts the engine once.
- `src/engine.ts`: the world (generated from `demo/index.html`, do not edit by hand; run `python3 tools/build_fibery_app.py`).
- `src/markup.ts`: HUD markup (generated).
- `src/palace.css`: HUD styles (generated).
- `src/palaceApi.ts`: data adapter. **Edit this one** to match your databases and fields.

## Install

1. Create a custom app in Fibery (kind **view**). With the Fibery MCP: `create_custom_app`, then `create_custom_app_dev_token`.
2. Download the app's sources:
   ```bash
   curl -s "https://YOUR.fibery.io/api/custom-apps/$APP_ID/get-source-files?custom-app-dev-token=$TOKEN" -o sources.tar.gz
   mkdir app && tar -xzf sources.tar.gz -C app
   ```
3. Copy the five files above into `app/files/src/` and add `"three": "0.128.0"` to `app/files/package.json` dependencies.
4. Optional local check: `pnpm install && pnpm exec tsc --noEmit && pnpm exec vite build` inside `app/files`.
5. Upload:
   ```bash
   tar --exclude='files/node_modules' --exclude='files/dist' -czf upload.tar.gz -C app files
   curl -s -X POST "https://YOUR.fibery.io/api/custom-apps/$APP_ID/update-source-files?custom-app-dev-token=$TOKEN" \
     --url-query "description=Happy Palace" -H "Content-Type: application/gzip" --data-binary @upload.tar.gz
   ```

The dev token lasts about an hour. The app only runs inside Fibery, so test visual changes in `demo/index.html` first.

## Data it reads and writes

- Reads: Projects (by state), Goals (priority slot), Tasks (open, ranked by a score field; done in the last 7 days for XP), Ideas, Scorecards with Metrics, Agents.
- Writes: Task workflow state (Done, In Progress, resolved by name with `getWorkflowStates`) and the Task's delegate relation.
