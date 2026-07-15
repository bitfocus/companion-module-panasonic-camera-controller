import { combineRgb } from '@companion-module/base'

const colorWhite = combineRgb(255, 255, 255)
const colorRed = combineRgb(255, 0, 0)
const colorGreen = combineRgb(0, 204, 0)
const colorOrange = combineRgb(255, 102, 0)
const colorBlue = combineRgb(0, 51, 204)
const colorGrey = combineRgb(51, 51, 51)
const colorPurple = combineRgb(255, 0, 255)
const colorBlack = combineRgb(0, 0, 0)

// Generate one "select/recall" button preset per choice. All five variants
// (camera/group/port/pmem/tmem) share this shape and differ only in the fields
// passed in here.
function pushSelectPresets(
	presets,
	{ choices, category, name, textPrefix, bgcolor, actionId, actionOptions, feedbackId, feedbackOptions, feedbackBg },
) {
	for (const choice of choices) {
		presets.push({
			type: 'button',
			category,
			name: typeof name === 'function' ? name(choice) : name,
			style: {
				text: textPrefix + choice.label,
				size: '14',
				color: colorWhite,
				bgcolor,
			},
			steps: [{ down: [{ actionId, options: actionOptions(choice) }], up: [] }],
			feedbacks: [
				{
					feedbackId,
					options: feedbackOptions(choice),
					style: { color: colorWhite, bgcolor: feedbackBg },
				},
			],
		})
	}
}

export function setPresets(self) {
	const presets = []

	pushSelectPresets(presets, {
		choices: self.product.cameraChoices,
		category: 'Select Camera',
		name: 'Select camera by camera number',
		textPrefix: 'Select\\n',
		bgcolor: colorBlack,
		actionId: 'selectCamera',
		actionOptions: (c) => ({ camera: c.id }),
		feedbackId: 'cameraSelected',
		feedbackOptions: (c) => ({ camera: c.id }),
		feedbackBg: colorOrange,
	})

	pushSelectPresets(presets, {
		choices: self.product.groupChoices,
		category: 'Select Group',
		name: 'Select camera group',
		textPrefix: 'Select\\n',
		bgcolor: colorBlue,
		actionId: 'selectGroup',
		actionOptions: (c) => ({ group: c.id }),
		feedbackId: 'groupSelected',
		feedbackOptions: (c) => ({ group: c.id }),
		feedbackBg: colorGreen,
	})

	pushSelectPresets(presets, {
		choices: self.product.portChoices,
		category: 'Select Port',
		name: 'Select camera port (in a group)',
		textPrefix: 'Select\\n',
		bgcolor: colorBlack,
		actionId: 'selectPort',
		actionOptions: (c) => ({ port: c.id }),
		feedbackId: 'portSelected',
		feedbackOptions: (c) => ({ port: c.id }),
		feedbackBg: colorOrange,
	})

	// Select by group and port preset
	presets.push({
		type: 'button',
		category: 'Select Camera by Group and Port',
		name: 'Select camera by group and port',
		style: {
			text: 'Select\\nGroup +\\nPort',
			size: '14',
			color: colorWhite,
			bgcolor: colorPurple,
		},
		steps: [{ down: [{ actionId: 'selectGroupPort', options: { group: 1, port: 1 } }], up: [] }],
		feedbacks: [],
	})

	if (self.product.presetMemory) {
		pushSelectPresets(presets, {
			choices: self.product.presetChoices,
			category: 'Preset Memory (PMEM)',
			name: 'Recall preset memory',
			textPrefix: 'Recall\\n',
			bgcolor: colorBlack,
			actionId: 'presetMemory',
			actionOptions: (c) => ({ preset: c.id }),
			feedbackId: 'presetSelected',
			feedbackOptions: (c) => ({ pmem: c.id }),
			feedbackBg: colorGrey,
		})
	}

	if (self.product.tracingMemory) {
		pushSelectPresets(presets, {
			choices: self.product.tracingChoices,
			category: 'Tracing Memory (TMEM)',
			name: (c) => c.label + ' Standby',
			textPrefix: 'Standby\\n',
			bgcolor: colorBlack,
			actionId: 'tracingMemory',
			actionOptions: (c) => ({ opt: '02', trace: c.id }),
			feedbackId: 'traceSelected',
			feedbackOptions: (c) => ({ tmem: c.id }),
			feedbackBg: colorGrey,
		})

		presets.push({
			type: 'button',
			category: 'Tracing Memory (TMEM)',
			name: 'TMEM Play',
			style: {
				text: 'TMEM ⏵',
				size: '18',
				color: colorWhite,
				bgcolor: colorGreen,
			},
			steps: [{ down: [{ actionId: 'tracingMemory', options: { opt: '01' } }], up: [] }],
			feedbacks: [],
		})

		presets.push({
			type: 'button',
			category: 'Tracing Memory (TMEM)',
			name: 'TMEM Stop',
			style: {
				text: ' TMEM ⏹',
				size: '18',
				color: colorWhite,
				bgcolor: colorRed,
			},
			steps: [{ down: [{ actionId: 'tracingMemory', options: { opt: '00' } }], up: [] }],
			feedbacks: [],
		})
	}

	return presets
}
