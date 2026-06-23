import React, { useState } from 'react';
import { DetectSchemaDrift } from '../../../../wailsjs/go/main/App';
import type { schema } from '../../../../wailsjs/go/models';

interface DriftPanelProps {
	specPath: string;
}

export function DriftPanel({ specPath }: DriftPanelProps) {
	const [drift, setDrift] = useState<schema.Drift | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [checked, setChecked] = useState(false);

	const checkDrift = async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await DetectSchemaDrift(specPath);
			setDrift(result ?? null);
			setChecked(true);
		} catch (err: any) {
			setError(err?.message || 'Failed to detect drift');
		} finally {
			setLoading(false);
		}
	};

	if (!checked && !loading) {
		return (
			<button
				onClick={checkDrift}
				className="text-xs px-2 py-1 rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition"
			>
				Detect Drift
			</button>
		);
	}

	if (loading) {
		return (
			<span className="text-xs text-zinc-400 animate-pulse">Checking drift...</span>
		);
	}

	if (error) {
		return (
			<div className="text-xs text-red-400">
				{error}
				<button onClick={checkDrift} className="ml-2 underline hover:text-red-300">
					Retry
				</button>
			</div>
		);
	}

	if (!drift || (drift.added.length === 0 && drift.removed.length === 0 && drift.changed.length === 0)) {
		return (
			<div className="flex items-center gap-2 text-xs text-green-400">
				<span className="w-2 h-2 rounded-full bg-green-400" />
				No drift detected
				<button onClick={checkDrift} className="ml-2 text-zinc-500 hover:text-zinc-300 underline">
					Re-check
				</button>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm font-medium text-amber-300">
					<span className="w-2 h-2 rounded-full bg-amber-400" />
					{drift.summary}
				</div>
				<button onClick={checkDrift} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
					Refresh
				</button>
			</div>

			{/* Added endpoints */}
			{drift.added.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs font-medium text-green-400">Added</div>
					{drift.added.map((ep, i) => (
						<div key={i} className="flex items-center gap-2 text-xs pl-3">
							<MethodBadge method={ep.method} />
							<span className="text-zinc-300">{ep.path}</span>
							<span className="text-zinc-500">{ep.detail}</span>
						</div>
					))}
				</div>
			)}

			{/* Removed endpoints */}
			{drift.removed.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs font-medium text-red-400">Removed</div>
					{drift.removed.map((ep, i) => (
						<div key={i} className="flex items-center gap-2 text-xs pl-3">
							<MethodBadge method={ep.method} />
							<span className="text-zinc-300 line-through">{ep.path}</span>
							<span className="text-zinc-500">{ep.detail}</span>
						</div>
					))}
				</div>
			)}

			{/* Changed endpoints */}
			{drift.changed.length > 0 && (
				<div className="space-y-1">
					<div className="text-xs font-medium text-amber-400">Modified</div>
					{drift.changed.map((ep, i) => (
						<div key={i} className="pl-3 space-y-0.5">
							<div className="flex items-center gap-2 text-xs">
								<MethodBadge method={ep.method} />
								<span className="text-zinc-300">{ep.path}</span>
							</div>
							{ep.changes?.map((ch: schema.FieldChange, j: number) => (
								<div key={j} className="text-xs pl-6 text-zinc-400">
									<span className="text-zinc-500">{ch.field}</span>{' '}
									{ch.kind === 'added' && (
										<span className="text-green-400">+ {ch.newValue}</span>
									)}
									{ch.kind === 'removed' && (
										<span className="text-red-400">- {ch.oldValue}</span>
									)}
									{ch.kind === 'changed' && (
										<span>
											<span className="text-red-400 line-through">{ch.oldValue}</span>
											{' → '}
											<span className="text-green-400">{ch.newValue}</span>
										</span>
									)}
								</div>
							))}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function MethodBadge({ method }: { method: string }) {
	const colors: Record<string, string> = {
		GET: 'bg-green-600/30 text-green-300',
		POST: 'bg-blue-600/30 text-blue-300',
		PUT: 'bg-amber-600/30 text-amber-300',
		PATCH: 'bg-purple-600/30 text-purple-300',
		DELETE: 'bg-red-600/30 text-red-300',
	};
	return (
		<span className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold ${colors[method] || 'bg-zinc-600/30 text-zinc-300'}`}>
			{method}
		</span>
	);
}
