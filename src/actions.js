import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

export function setActions(self) {
	const actions = {}

	actions.selectCamera = {
		name: 'Select Camera',
		options: [
			{
				type: 'dropdown',
				label: CAMERA_LABEL,
				id: 'camera',
				default: self.product.cameraChoices[0].id,
				choices: self.product.cameraChoices,
			},
		],
		callback: async (action) => {
			await self.sendCommand(`XCN:01:${action.options.camera}`)
		},
	}

	actions.selectGroup = {
		name: 'Select Group',
		options: [
			{
				type: 'dropdown',
				label: 'Group',
				id: 'group',
				default: self.product.groupChoices[0].id,
				choices: self.product.groupChoices,
			},
		],
		callback: async (action) => {
			await self.sendCommand(`XGP:${action.options.group}`)
		},
	}

	actions.selectGroupPort = {
		name: 'Select Group + Port',
		options: [
			{
				type: 'dropdown',
				label: GROUP_LABEL,
				id: 'group',
				default: self.product.groupChoices[0].id,
				choices: self.product.groupChoices,
			},
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: self.product.portChoices[0].id,
				choices: self.product.portChoices,
			},
		],
		callback: async (action) => {
			await self.sendCommand(`XCN:02:${action.options.group}:${action.options.port}`)
		},
	}

	actions.selectPort = {
		name: 'Select Port',
		options: [
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: self.product.portChoices[0].id,
				choices: self.product.portChoices,
			},
		],
		callback: async (action) => {
			await self.sendCommand(`XPT:${action.options.port}`)
		},
	}

	if (self.product.presetMemory == true) {
		actions.presetMemory = {
			name: 'Recall Preset memory',
			options: [
				{
					type: 'dropdown',
					label: 'Preset',
					id: 'preset',
					default: self.product.presetChoices[0].id,
					choices: self.product.presetChoices,
				},
			],
			callback: async (action) => {
				await self.sendCommand(`XPM:01:${action.options.preset}`)
			},
		}
	}

	if (self.product.tracingMemory == true) {
		actions.tracingMemory = {
			name: 'Tracing memory',
			options: [
				{
					type: 'dropdown',
					label: 'Operation',
					id: 'opt',
					default: '02',
					choices: [
						{ id: '02', label: 'Standby' },
						{ id: '01', label: 'Play' },
						{ id: '00', label: 'Stop' },
					],
				},
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'trace',
					default: self.product.tracingChoices[0].id,
					choices: self.product.tracingChoices,
					isVisible: (options) => options.opt !== '01',
				},
			],
			callback: async (action) => {
				const trace = action.options.opt === '01' ? '000' : action.options.trace
				await self.sendCommand(`XPM:${action.options.opt}:${trace}`)
			},
		}
	}

	return actions
}
