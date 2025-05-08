import { combineRgb } from '@companion-module/base'
import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

export function setFeedbacks(self) {
	const feedbacks = {}

	const colorWhite = combineRgb(255, 255, 255)
	const colorOrange = combineRgb(255, 102, 0)
	const colorGreen = combineRgb(0, 204, 0)
	const colorBlue = combineRgb(0, 51, 204)
	const colorGrey = combineRgb(51, 51, 51)

	feedbacks.cameraSelected = {
		type: 'boolean',
		name: 'Camera selected',
		description: 'Indicate if Camera is selected',
		defaultStyle: {
			color: colorWhite,
			bgcolor: colorOrange,
		},
		options: [
			{
				type: 'dropdown',
				label: CAMERA_LABEL,
				id: 'camera',
				default: '1',
				choices: self.product.cameraChoices,
			},
		],
		callback: (feedback) => {
			return feedback.options.camera == self.data.camera
		},
	}

	feedbacks.groupSelected = {
		type: 'boolean',
		name: 'Group selected',
		description: 'Indicate if Group is selected',
		defaultStyle: {
			color: colorWhite,
			bgcolor: colorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: GROUP_LABEL,
				id: 'group',
				default: '1',
				choices: self.product.groupChoices,
			},
		],
		callback: (feedback) => {
			return feedback.options.group == self.data.group
		},
	}

	feedbacks.portSelected = {
		type: 'boolean',
		name: 'Port selected',
		description: 'Indicate if Port is selected',
		defaultStyle: {
			color: colorWhite,
			bgcolor: colorOrange,
		},
		options: [
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: '1',
				choices: self.product.portChoices,
			},
		],
		callback: (feedback) => {
			return feedback.options.port == self.data.port
		},
	}

	if (self.product.presetMemory) {
		feedbacks.presetSelected = {
			type: 'boolean',
			name: 'Preset Memory selected',
			description: 'Indicates if the selected PMEM is currently active (last selected)',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGrey,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'pmem',
					default: self.product.presetChoices[0].id,
					choices: self.product.presetChoices,
				},
			],
			callback: function (feedback) {
				return self.data.pmem === feedback.options.pmem
			},
		}
	}

	if (self.product.tracingMemory) {
		feedbacks.traceSelected = {
			type: 'boolean',
			name: 'Tracing Memory selected',
			description: 'Indicates if the selected TMEM is currently active (last selected)',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGrey,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'tmem',
					default: self.product.tracingChoices[0].id,
					choices: self.product.tracingChoices,
				},
			],
			callback: function (feedback) {
				return self.data.tmem === feedback.options.tmem
			},
		}

		return feedbacks
	}
}
