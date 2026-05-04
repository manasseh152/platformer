/**
 * Project-local pi extension for validating the platformer tilemap visually.
 *
 * Registers a custom tool the agent can call to render the full map PNG via
 * tools/render-map.js. Auto-discovered from .pi/extensions/map-render/index.ts.
 */

import { Type } from "@mariozechner/pi-ai";
import { defineTool, withFileMutationQueue, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isAbsolute, relative, resolve } from "node:path";

function normalizeProjectPath(path: string) {
	return path.replace(/^@/, "");
}

async function renderFullMap(
	pi: ExtensionAPI,
	cwd: string,
	outputPath = ".temp/full-map.png",
	signal?: AbortSignal,
	onUpdate?: (update: { content: Array<{ type: "text"; text: string }>; details?: Record<string, unknown> }) => void,
) {
	const relativeOutputPath = normalizeProjectPath(outputPath);
	const absoluteOutputPath = resolve(cwd, relativeOutputPath);
	const relativeFromProject = relative(cwd, absoluteOutputPath);
	if (relativeFromProject.startsWith("..") || isAbsolute(relativeFromProject)) {
		throw new Error(`outputPath must stay inside the project: ${relativeOutputPath}`);
	}

	return withFileMutationQueue(absoluteOutputPath, async () => {
		onUpdate?.({
			content: [{ type: "text", text: `Rendering full map PNG to ${relativeOutputPath}...` }],
			details: { outputPath: relativeOutputPath },
		});

		const result = await pi.exec("node", ["tools/render-map.js", relativeOutputPath], {
			cwd,
			signal,
			timeout: 60_000,
		});

		const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
		if (result.code !== 0) {
			throw new Error(`Map render failed with exit code ${result.code}${output ? `\n${output}` : ""}`);
		}

		return {
			content: [{ type: "text" as const, text: output || `Rendered full map PNG to ${relativeOutputPath}` }],
			details: {
				outputPath: relativeOutputPath,
				absoluteOutputPath,
				stdout: result.stdout,
				stderr: result.stderr,
			},
		};
	});
}

export default function (pi: ExtensionAPI) {
	const renderFullMapTool = defineTool({
		name: "render_full_map_png",
		label: "Render Full Map PNG",
		description: "Render this project's tilemap at full world size to a PNG for CI, visual validation, and map review.",
		promptSnippet: "Render the platformer map to a full-size PNG for CI/validation.",
		promptGuidelines: [
			"Use render_full_map_png when validating tilemap, level, sprite, or rendering changes that should be reviewed as a full-map PNG.",
		],
		parameters: Type.Object({
			outputPath: Type.Optional(Type.String({ description: "Project-relative output PNG path. Defaults to .temp/full-map.png." })),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			return renderFullMap(pi, ctx.cwd, params.outputPath, signal, onUpdate);
		},
	});

	pi.registerTool(renderFullMapTool);

	pi.registerCommand("render-map", {
		description: "Render the full platformer map PNG. Usage: /render-map [.temp/full-map.png]",
		handler: async (args, ctx) => {
			const outputPath = String(args ?? "").trim() || ".temp/full-map.png";
			const result = await renderFullMap(pi, ctx.cwd, outputPath);
			ctx.ui.notify(result.content[0].text, "success");
		},
	});
}
