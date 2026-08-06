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

// Add one "simple" button preset per value in 1..count to the keyed `presets` object.
// Returns the generated preset ids so the caller can list them in a preset section.
function addSelectPresets(
	presets,
	{
		idPrefix,
		count,
		labelPrefix,
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
	const ids = []
	for (let n = 1; n <= count; n++) {
		const id = `${idPrefix}_${n}`
		const label = `${labelPrefix} ${n}`
		presets[id] = {
			type: 'simple',
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
		}
		ids.push(id)
	}
	return ids
}

// Returns the preset definitions (keyed by id) and the section structure that references
// them, as expected by setPresetDefinitions(structure, presets) in @companion-module/base 2.x.
export function setPresets(self) {
	const presets = {}
	const structure = []

	structure.push({
		id: 'camera',
		name: 'Select Camera',
		definitions: addSelectPresets(presets, {
			idPrefix: 'camera',
			count: self.product.numberOfCameras,
			labelPrefix: CAMERA_LABEL,
			name: 'Select camera by camera number',
			textPrefix: 'Select\\n',
			bgcolor: colorBlack,
			actionId: 'selectCamera',
			actionOptions: (n) => ({ camera: n }),
			feedbackId: 'cameraSelected',
			feedbackOptions: (n) => ({ camera: n }),
			feedbackBg: colorOrange,
		}),
	})

	structure.push({
		id: 'group',
		name: 'Select Group',
		definitions: addSelectPresets(presets, {
			idPrefix: 'group',
			count: self.product.numberOfGroups,
			labelPrefix: GROUP_LABEL,
			name: 'Select camera group',
			textPrefix: 'Select\\n',
			bgcolor: colorBlue,
			actionId: 'selectGroup',
			actionOptions: (n) => ({ group: n }),
			feedbackId: 'groupSelected',
			feedbackOptions: (n) => ({ group: n }),
			feedbackBg: colorGreen,
		}),
	})

	structure.push({
		id: 'port',
		name: 'Select Port',
		definitions: addSelectPresets(presets, {
			idPrefix: 'port',
			count: self.product.numberOfPorts,
			labelPrefix: PORT_LABEL,
			name: 'Select camera port (in a group)',
			textPrefix: 'Select\\n',
			bgcolor: colorBlack,
			actionId: 'selectPort',
			actionOptions: (n) => ({ port: n }),
			feedbackId: 'portSelected',
			feedbackOptions: (n) => ({ port: n }),
			feedbackBg: colorOrange,
		}),
	})

	presets['group_port'] = {
		type: 'simple',
		name: 'Select camera by group and port',
		style: {
			text: 'Select\\nGroup +\\nPort',
			size: '14',
			color: colorWhite,
			bgcolor: colorPurple,
		},
		steps: [{ down: [{ actionId: 'selectGroupPort', options: { group: 1, port: 1 } }], up: [] }],
		feedbacks: [],
	}
	structure.push({ id: 'group_port', name: 'Select Camera by Group and Port', definitions: ['group_port'] })

	if (self.product.presetMemory) {
		structure.push({
			id: 'pmem',
			name: 'Preset Memory (PMEM)',
			definitions: addSelectPresets(presets, {
				idPrefix: 'pmem',
				count: self.product.numberOfPresets,
				labelPrefix: PRESET_LABEL,
				name: 'Recall preset memory',
				textPrefix: 'Recall\\n',
				bgcolor: colorBlack,
				actionId: 'presetMemory',
				actionOptions: (n) => ({ preset: n }),
				feedbackId: 'presetSelected',
				feedbackOptions: (n) => ({ pmem: n }),
				feedbackBg: colorGrey,
			}),
		})
	}

	if (self.product.tracingMemory) {
		const tmemIds = addSelectPresets(presets, {
			idPrefix: 'tmem',
			count: self.product.numberOfTracing,
			labelPrefix: TRACING_LABEL,
			name: (label) => `${label} Standby`,
			textPrefix: 'Standby\\n',
			bgcolor: colorBlack,
			actionId: 'tracingMemory',
			actionOptions: (n) => ({ opt: '02', trace: n }),
			feedbackId: 'traceSelected',
			feedbackOptions: (n) => ({ tmem: n }),
			feedbackBg: colorGrey,
		})

		presets['tmem_play'] = {
			type: 'simple',
			name: 'TMEM Play',
			style: {
				text: 'TMEM ⏵',
				size: '18',
				color: colorWhite,
				bgcolor: colorGreen,
			},
			steps: [{ down: [{ actionId: 'tracingMemory', options: { opt: '01' } }], up: [] }],
			feedbacks: [],
		}
		presets['tmem_stop'] = {
			type: 'simple',
			name: 'TMEM Stop',
			style: {
				text: ' TMEM ⏹',
				size: '18',
				color: colorWhite,
				bgcolor: colorRed,
			},
			steps: [{ down: [{ actionId: 'tracingMemory', options: { opt: '00' } }], up: [] }],
			feedbacks: [],
		}

		structure.push({
			id: 'tmem',
			name: 'Tracing Memory (TMEM)',
			definitions: [...tmemIds, 'tmem_play', 'tmem_stop'],
		})
	}

	return { presets, structure }
}
