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

// An action/feedback option that resolves to the button's local variable value.
const localRef = (varName) => ({ isExpression: true, value: `$(local:${varName})` })

// Define a single "template" preset: one button definition whose selection value comes from a
// per-button local variable. A matching template group (see below) then generates the individual
// buttons for 1..count by injecting each value — far cheaper than emitting a preset per value.
function addTemplatePreset(
	presets,
	id,
	{ name, labelPrefix, textPrefix, bgcolor, varName, actionId, actionOptions, feedbackId, feedbackOptions, feedbackBg },
) {
	presets[id] = {
		type: 'simple',
		name,
		style: {
			text: `${textPrefix}${labelPrefix} $(local:${varName})`,
			size: '14',
			color: colorWhite,
			bgcolor,
		},
		localVariables: [{ variableType: 'simple', variableName: varName, startupValue: 1 }],
		steps: [{ down: [{ actionId, options: actionOptions(localRef(varName)) }], up: [] }],
		feedbacks: [
			{
				feedbackId,
				options: feedbackOptions(localRef(varName)),
				style: { color: colorWhite, bgcolor: feedbackBg },
			},
		],
	}
}

// A template group that expands the template preset into one button per value in 1..count.
function templateGroup(id, name, presetId, varName, count, labelPrefix) {
	return {
		id,
		type: 'template',
		name,
		presetId,
		templateVariableName: varName,
		templateValues: Array.from({ length: count }, (_, i) => ({ name: `${labelPrefix} ${i + 1}`, value: i + 1 })),
	}
}

// Returns the preset definitions (keyed by id) and the section structure that references them,
// as expected by setPresetDefinitions(structure, presets) in @companion-module/base 2.x.
export function setPresets(self) {
	const presets = {}
	const structure = []

	addTemplatePreset(presets, 'select_camera', {
		name: 'Select camera by camera number',
		labelPrefix: CAMERA_LABEL,
		textPrefix: 'Select\\n',
		bgcolor: colorBlack,
		varName: 'cam',
		actionId: 'selectCamera',
		actionOptions: (v) => ({ camera: v }),
		feedbackId: 'cameraSelected',
		feedbackOptions: (v) => ({ camera: v }),
		feedbackBg: colorOrange,
	})
	structure.push({
		id: 'camera',
		name: 'Select Camera',
		definitions: [
			templateGroup(
				'camera_group',
				'Select Camera',
				'select_camera',
				'cam',
				self.product.numberOfCameras,
				CAMERA_LABEL,
			),
		],
	})

	addTemplatePreset(presets, 'select_group', {
		name: 'Select camera group',
		labelPrefix: GROUP_LABEL,
		textPrefix: 'Select\\n',
		bgcolor: colorBlue,
		varName: 'grp',
		actionId: 'selectGroup',
		actionOptions: (v) => ({ group: v }),
		feedbackId: 'groupSelected',
		feedbackOptions: (v) => ({ group: v }),
		feedbackBg: colorGreen,
	})
	structure.push({
		id: 'group',
		name: 'Select Group',
		definitions: [
			templateGroup('group_group', 'Select Group', 'select_group', 'grp', self.product.numberOfGroups, GROUP_LABEL),
		],
	})

	addTemplatePreset(presets, 'select_port', {
		name: 'Select camera port (in a group)',
		labelPrefix: PORT_LABEL,
		textPrefix: 'Select\\n',
		bgcolor: colorBlack,
		varName: 'prt',
		actionId: 'selectPort',
		actionOptions: (v) => ({ port: v }),
		feedbackId: 'portSelected',
		feedbackOptions: (v) => ({ port: v }),
		feedbackBg: colorOrange,
	})
	structure.push({
		id: 'port',
		name: 'Select Port',
		definitions: [
			templateGroup('port_group', 'Select Port', 'select_port', 'prt', self.product.numberOfPorts, PORT_LABEL),
		],
	})

	// Select by group and port — a single fixed button, referenced directly.
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
		addTemplatePreset(presets, 'preset_memory', {
			name: 'Recall preset memory',
			labelPrefix: PRESET_LABEL,
			textPrefix: 'Recall\\n',
			bgcolor: colorBlack,
			varName: 'pm',
			actionId: 'presetMemory',
			actionOptions: (v) => ({ preset: v }),
			feedbackId: 'presetSelected',
			feedbackOptions: (v) => ({ pmem: v }),
			feedbackBg: colorGrey,
		})
		structure.push({
			id: 'pmem',
			name: 'Preset Memory (PMEM)',
			definitions: [
				templateGroup('pmem_group', 'Recall PMEM', 'preset_memory', 'pm', self.product.numberOfPresets, PRESET_LABEL),
			],
		})
	}

	if (self.product.tracingMemory) {
		addTemplatePreset(presets, 'tracing_memory', {
			name: 'Recall tracing memory (standby)',
			labelPrefix: TRACING_LABEL,
			textPrefix: 'Standby\\n',
			bgcolor: colorBlack,
			varName: 'tm',
			actionId: 'tracingMemory',
			actionOptions: (v) => ({ opt: '02', trace: v }),
			feedbackId: 'traceSelected',
			feedbackOptions: (v) => ({ tmem: v }),
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
			definitions: [
				templateGroup('tmem_group', 'Standby', 'tracing_memory', 'tm', self.product.numberOfTracing, TRACING_LABEL),
				{ id: 'tmem_controls', type: 'simple', name: 'Play / Stop', presets: ['tmem_play', 'tmem_stop'] },
			],
		})
	}

	return { presets, structure }
}
