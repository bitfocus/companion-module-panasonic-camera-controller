import { combineRgb } from '@companion-module/base'
import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

export function setFeedbacks(self) {
	const feedbacks = {}

	const colorWhite = combineRgb(255, 255, 255)
	const colorRed = combineRgb(255, 0, 0)

	feedbacks.cameraSelected = {
		type: 'boolean',
		name: 'Camera selected',
		description: 'Indicate if Camera is selected',
		defaultStyle: {
			color: colorWhite,
			bgcolor: colorRed,
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
			bgcolor: colorRed,
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
			bgcolor: colorRed,
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

	return feedbacks
}
