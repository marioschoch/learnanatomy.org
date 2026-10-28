/**
 * Imperative commands the UI can ask the 3D viewer to perform.
 *
 * They are routed through the store (never via React refs):
 *   const result = await useAtlasStore.getState().requestViewer({ type: 'focus', ids: ['femur-l'] });
 * The viewer subscribes to `viewerQueue`, executes each command and calls `completeViewerCommand(id, result)`.
 * If no viewer is mounted, commands stay queued until one is (or `cancelViewerCommands` is called).
 *
 * OWNER: lead.
 */
import type { Vec3 } from './anatomy';

export type StandardView = 'anterior' | 'posterior' | 'left' | 'right' | 'superior' | 'inferior';

/** `left`/`right` are the patient's left/right lateral views (camera on the patient's left looks at the left side). */
export const STANDARD_VIEWS: readonly StandardView[] = [
  'anterior',
  'posterior',
  'left',
  'right',
  'superior',
  'inferior',
] as const;

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view in degrees (perspective camera). */
  fov?: number;
}

export type ViewerCommand =
  /** Fit the camera to the union bbox of the given structures/groups/landmarks. */
  | { type: 'focus'; ids: string[]; animate?: boolean }
  | { type: 'setView'; view: StandardView; animate?: boolean }
  | { type: 'setCameraPose'; pose: CameraPose; animate?: boolean }
  | { type: 'resetCamera'; animate?: boolean }
  /** Zoom by a factor (> 1 zooms in). */
  | { type: 'zoom'; factor: number }
  /** PNG of the canvas. `scale` multiplies the current pixel ratio (default 1). */
  | { type: 'screenshot'; scale?: number; transparentBackground?: boolean };

export type ViewerCommandResult =
  | { ok: true; type: 'screenshot'; dataUrl: string; width: number; height: number }
  | { ok: true; type: Exclude<ViewerCommand['type'], 'screenshot'> }
  | { ok: false; type: ViewerCommand['type']; error: string };

export interface QueuedViewerCommand {
  id: number;
  command: ViewerCommand;
}

/** Live numbers the viewer may publish for the dev overlay and the QA agent (via window.__atlas). */
export interface ViewerStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}
