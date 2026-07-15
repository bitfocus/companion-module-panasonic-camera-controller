import { combineRgb } from '@companion-module/base'
import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

const colorWhite = combineRgb(255, 255, 255)
const colorOrange = combineRgb(255, 102, 0)
const colorGreen = combineRgb(0, 204, 0)
const colorGrey = combineRgb(51, 51, 51)

// All feedbacks are boolean "is this id currently selected" checks that differ
// only in labels, colour and the data key they compare against.
function makeSelectedFeedback(self, { name, description, label, id, choices, bgcolor }) {
	return {
		type: 'boolean',
		name,
		description,
		defaultStyle: { color: colorWhite, bgcolor },
		options: [{ type: 'dropdown', label, id, default: choices[0].id, choices }],
		callback: (feedback) => Number(feedback.options[id]) === self.data[id],
	}
}

export function setFeedbacks(self) {
	const feedbacks = {}

	feedbacks.cameraSelected = makeSelectedFeedback(self, {
		name: 'Camera selected',
		description: 'Indicate if Camera is selected',
		label: CAMERA_LABEL,
		id: 'camera',
		choices: self.product.cameraChoices,
		bgcolor: colorOrange,
	})

	feedbacks.groupSelected = makeSelectedFeedback(self, {
		name: 'Group selected',
		description: 'Indicate if Group is selected',
		label: GROUP_LABEL,
		id: 'group',
		choices: self.product.groupChoices,
		bgcolor: colorGreen,
	})

	feedbacks.portSelected = makeSelectedFeedback(self, {
		name: 'Port selected',
		description: 'Indicate if Port is selected',
		label: PORT_LABEL,
		id: 'port',
		choices: self.product.portChoices,
		bgcolor: colorOrange,
	})

	if (self.product.presetMemory) {
		feedbacks.presetSelected = makeSelectedFeedback(self, {
			name: 'Preset Memory selected',
			description: 'Indicates if the selected PMEM is currently active (last selected)',
			label: 'Memory',
			id: 'pmem',
			choices: self.product.presetChoices,
			bgcolor: colorGrey,
		})
	}

	if (self.product.tracingMemory) {
		feedbacks.traceSelected = makeSelectedFeedback(self, {
			name: 'Tracing Memory selected',
			description: 'Indicates if the selected TMEM is currently active (last selected)',
			label: 'Memory',
			id: 'tmem',
			choices: self.product.tracingChoices,
			bgcolor: colorGrey,
		})
	}

	return feedbacks
}
