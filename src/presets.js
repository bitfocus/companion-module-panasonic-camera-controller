import { combineRgb } from '@companion-module/base'
import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL, PRESET_LABEL, TRACING_LABEL } from './common.js'

const colorWhite = combineRgb(255, 255, 255)
const colorRed = combineRgb(255, 0, 0)
const colorGreen = combineRgb(0, 204, 0)
const colorOrange = combineRgb(255, 102, 0)
const colorBlue = combineRgb(0, 51, 204)
const colorGrey = combineRgb(51, 51, 51)
const colorPurple = combineRgb(255, 0, 255)
const colorBlack = combineRgb(0, 0, 0)

// Generate one "select/recall" button preset per value in 1..count. All five variants
// (camera/group/port/pmem/tmem) share this shape and differ only in the fields passed here.
function pushSelectPresets(
	presets,
	{
		count,
		labelPrefix,
		category,
		name,
		textPrefix,
		bgcolor,
		actionId,
		actionOptions,
		feedbackId,
		feedbackOptions,
		feedbackBg,
	},
) {
	for (let n = 1; n <= count; n++) {
		const label = `${labelPrefix} ${n}`
		presets.push({
			type: 'button',
			category,
			name: typeof name === 'function' ? name(label) : name,
			style: {
				text: textPrefix + label,
				size: '14',
				color: colorWhite,
				bgcolor,
			},
			steps: [{ down: [{ actionId, options: actionOptions(n) }], up: [] }],
			feedbacks: [
				{
					feedbackId,
					options: feedbackOptions(n),
					style: { color: colorWhite, bgcolor: feedbackBg },
				},
			],
		})
	}
}

export function setPresets(self) {
	const presets = []

	pushSelectPresets(presets, {
		count: self.product.numberOfCameras,
		labelPrefix: CAMERA_LABEL,
		category: 'Select Camera',
		name: 'Select camera by camera number',
		textPrefix: 'Select\\n',
		bgcolor: colorBlack,
		actionId: 'selectCamera',
		actionOptions: (n) => ({ camera: n }),
		feedbackId: 'cameraSelected',
		feedbackOptions: (n) => ({ camera: n }),
		feedbackBg: colorOrange,
	})

	pushSelectPresets(presets, {
		count: self.product.numberOfGroups,
		labelPrefix: GROUP_LABEL,
		category: 'Select Group',
		name: 'Select camera group',
		textPrefix: 'Select\\n',
		bgcolor: colorBlue,
		actionId: 'selectGroup',
		actionOptions: (n) => ({ group: n }),
		feedbackId: 'groupSelected',
		feedbackOptions: (n) => ({ group: n }),
		feedbackBg: colorGreen,
	})

	pushSelectPresets(presets, {
		count: self.product.numberOfPorts,
		labelPrefix: PORT_LABEL,
		category: 'Select Port',
		name: 'Select camera port (in a group)',
		textPrefix: 'Select\\n',
		bgcolor: colorBlack,
		actionId: 'selectPort',
		actionOptions: (n) => ({ port: n }),
		feedbackId: 'portSelected',
		feedbackOptions: (n) => ({ port: n }),
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
			count: self.product.numberOfPresets,
			labelPrefix: PRESET_LABEL,
			category: 'Preset Memory (PMEM)',
			name: 'Recall preset memory',
			textPrefix: 'Recall\\n',
			bgcolor: colorBlack,
			actionId: 'presetMemory',
			actionOptions: (n) => ({ preset: n }),
			feedbackId: 'presetSelected',
			feedbackOptions: (n) => ({ pmem: n }),
			feedbackBg: colorGrey,
		})
	}

	if (self.product.tracingMemory) {
		pushSelectPresets(presets, {
			count: self.product.numberOfTracing,
			labelPrefix: TRACING_LABEL,
			category: 'Tracing Memory (TMEM)',
			name: (label) => `${label} Standby`,
			textPrefix: 'Standby\\n',
			bgcolor: colorBlack,
			actionId: 'tracingMemory',
			actionOptions: (n) => ({ opt: '02', trace: n }),
			feedbackId: 'traceSelected',
			feedbackOptions: (n) => ({ tmem: n }),
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
