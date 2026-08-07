import { combineRgb } from '@companion-module/base'
import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

const colorWhite = combineRgb(255, 255, 255)
const colorOrange = combineRgb(255, 102, 0)
const colorGreen = combineRgb(0, 204, 0)
const colorGrey = combineRgb(51, 51, 51)

// All feedbacks are boolean "is this id currently selected" checks that differ only in
// labels, colour and the data key. The selector is a `number` field so users can drive it
// with variables/expressions (the host coerces + range-validates before the callback).
function makeSelectedFeedback(self, { name, description, label, id, max, noun, bgcolor }) {
	return {
		type: 'boolean',
		name,
		description,
		defaultStyle: { color: colorWhite, bgcolor },
		options: [
			{
				type: 'number',
				label,
				id,
				default: 1,
				min: 1,
				max,
				asInteger: true,
				expressionDescription: `${noun} (1–${max})`,
			},
		],
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
		max: self.product.numberOfCameras,
		noun: 'Camera number',
		bgcolor: colorOrange,
	})

	feedbacks.groupSelected = makeSelectedFeedback(self, {
		name: 'Group selected',
		description: 'Indicate if Group is selected',
		label: GROUP_LABEL,
		id: 'group',
		max: self.product.numberOfGroups,
		noun: 'Group number',
		bgcolor: colorGreen,
	})

	feedbacks.portSelected = makeSelectedFeedback(self, {
		name: 'Port selected',
		description: 'Indicate if Port is selected',
		label: PORT_LABEL,
		id: 'port',
		max: self.product.numberOfPorts,
		noun: 'Port number',
		bgcolor: colorOrange,
	})

	if (self.product.presetMemory) {
		feedbacks.presetSelected = makeSelectedFeedback(self, {
			name: 'Preset Memory selected',
			description: 'Indicates if the selected PMEM is currently active (last selected)',
			label: 'Memory',
			id: 'pmem',
			max: self.product.numberOfPresets,
			noun: 'Preset memory number',
			bgcolor: colorGrey,
		})
	}

	if (self.product.tracingMemory) {
		feedbacks.traceSelected = makeSelectedFeedback(self, {
			name: 'Tracing Memory selected',
			description: 'Indicates if the selected TMEM is currently active (last selected)',
			label: 'Memory',
			id: 'tmem',
			max: self.product.numberOfTracing,
			noun: 'Tracing memory number',
			bgcolor: colorGrey,
		})
	}

	return feedbacks
}
