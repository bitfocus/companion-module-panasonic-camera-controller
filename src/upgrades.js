import { CreateConvertToBooleanFeedbackUpgradeScript } from '@companion-module/base'

// The pmem/tmem selectors used to be dropdowns whose ids were zero-padded strings ('003').
// They are now `number` fields, so convert previously stored padded strings to plain
// integers. In 2.x upgrade scripts each option is an { isExpression, value } wrapper; only
// touch non-expression numeric strings so user-entered expressions are left untouched.
function normalizeNumericOptions(_context, props) {
	const ids = ['camera', 'group', 'port', 'preset', 'trace', 'pmem', 'tmem']

	const fix = (items) => {
		const changed = []
		for (const item of items) {
			let dirty = false
			for (const id of ids) {
				const o = item.options[id]
				if (o && o.isExpression === false && typeof o.value === 'string' && /^\d+$/.test(o.value.trim())) {
					item.options[id] = { isExpression: false, value: parseInt(o.value, 10) }
					dirty = true
				}
			}
			if (dirty) changed.push(item)
		}
		return changed
	}

	return {
		updatedConfig: null,
		updatedActions: fix(props.actions),
		updatedFeedbacks: fix(props.feedbacks),
	}
}

// The tracing memory action's `trace` number field is required even when hidden (Play/Stop),
// but older TMEM Play/Stop buttons were created without it, so option validation now rejects
// them. Backfill a dummy value for tracingMemory actions that are missing `trace`.
function backfillTracingTrace(_context, props) {
	const changed = []
	for (const action of props.actions) {
		if (action.actionId === 'tracingMemory' && action.options.trace === undefined) {
			action.options.trace = { isExpression: false, value: 1 }
			changed.push(action)
		}
	}
	return { updatedConfig: null, updatedActions: changed, updatedFeedbacks: [] }
}

export default [
	CreateConvertToBooleanFeedbackUpgradeScript({
		cameraSelected: true,
		groupSelected: true,
		portSelected: true,
	}),
	normalizeNumericOptions,
	backfillTracingTrace,
]
