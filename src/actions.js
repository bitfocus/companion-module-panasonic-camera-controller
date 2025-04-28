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
			self.data.pmem = null
			self.data.tmem = null
		},
	}

	actions.selectGroup = {
		name: 'Select Group',
		options: [
			{
				type: 'dropdown',
				label: GROUP_LABEL,
				id: 'group',
				default: self.product.groupChoices[0].id,
				choices: self.product.groupChoices,
			},
		],
		callback: async (action) => {
			await self.sendCommand(`XGP:${action.options.group}`)
			self.data.pmem = null
			self.data.tmem = null
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
			self.data.pmem = null
			self.data.tmem = null
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
			self.data.pmem = null
			self.data.tmem = null
		},
	}

	if (self.product.presetMemory == true) {
		actions.presetMemory = {
			name: 'Recall Preset Memory (PMEM)',
			options: [
				{
					type: 'dropdown',
					label: 'Memory',
					id: 'preset',
					default: self.product.presetChoices[0].id,
					choices: self.product.presetChoices,
				},
			],
			callback: async (action) => {
				await self.sendCommand(`XPM:01:${action.options.preset}`)
				self.data.pmem = action.options.preset
				self.data.tmem = null
			},
		}
	}

	if (self.product.tracingMemory == true) {
		actions.tracingMemory = {
			name: 'Recall Tracing Memory (TMEM)',
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
					isVisible: (options) => options.opt === '02',
				},
			],
			callback: async (action) => {
				switch (action.options.opt) {
					case '02': // Standby
						await self.sendCommand(`XTM:${action.options.opt}:${action.options.trace}`)
						self.data.pmem = action.options.trace
						self.data.tmem = action.options.trace
						break
					case '01': // Play
						await self.sendCommand(`XTM:${action.options.opt}:000`)
						break
					case '00': // Stop
						const tmem = self.data.tmem ? String(self.data.tmem).padStart(3, '0') : '001'
						await self.sendCommand(`XTM:${action.options.opt}:${tmem}`)
						break
				}
			},
		}
	}

	return actions
}
