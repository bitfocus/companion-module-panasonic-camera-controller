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
				default: '1',
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
				default: '1',
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
				default: '1',
				choices: self.product.groupChoices,
			},
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: '1',
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
				default: '1',
				choices: self.product.portChoices,
			},
		],
		callback: async (action) => {
			await self.sendCommand(`XPT:${action.options.port}`)
		},
	}

	if (self.product.presetMemory == true) {
		actions.presetMemory = {
			name: 'Select Preset Memory',
			options: [
				{
					type: 'dropdown',
					label: 'Select Preset',
					id: 'preset',
					default: '001',
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
			name: 'Select Tracing Memory',
			options: [
				{
					type: 'dropdown',
					label: 'Option',
					id: 'opt',
					default: 'Standby',
					default: '02',
					choices: [
						{ id: '02', label: 'Standby' },
						{ id: '01', label: 'Play' },
						{ id: '00', label: 'Stop' },
					],
				},
				{
					type: 'dropdown',
					label: 'Select Trace',
					id: 'trace',
					choices: self.product.tracingChoices,
				},
			],
			callback: async (action) => {
				var trace = action.options.trace
				if (action.options.opt == '01') {
					trace = '000'
				}
				await self.sendCommand(`XPM:${action.options.opt}:${trace}`)
			},
		}
	}

	self.setActionDefinitions(actions)
}
