import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

function dropdown(label, id, choices) {
	return { type: 'dropdown', label, id, default: choices[0].id, choices }
}

function resetMem(self) {
	self.data.pmem = null
	self.data.tmem = null
}

export function setActions(self) {
	const actions = {}

	actions.selectCamera = {
		name: 'Select Camera',
		options: [dropdown(CAMERA_LABEL, 'camera', self.product.cameraChoices)],
		callback: async (action) => {
			await self.sendCommand(`XCN:01:${action.options.camera}`)
			resetMem(self)
		},
	}

	actions.selectGroup = {
		name: 'Select Group',
		options: [dropdown(GROUP_LABEL, 'group', self.product.groupChoices)],
		callback: async (action) => {
			await self.sendCommand(`XGP:${action.options.group}`)
			resetMem(self)
		},
	}

	actions.selectGroupPort = {
		name: 'Select Group + Port',
		options: [
			dropdown(GROUP_LABEL, 'group', self.product.groupChoices),
			dropdown(PORT_LABEL, 'port', self.product.portChoices),
		],
		callback: async (action) => {
			await self.sendCommand(`XCN:02:${action.options.group}:${action.options.port}`)
			resetMem(self)
		},
	}

	actions.selectPort = {
		name: 'Select Port',
		options: [dropdown(PORT_LABEL, 'port', self.product.portChoices)],
		callback: async (action) => {
			await self.sendCommand(`XPT:${action.options.port}`)
			resetMem(self)
		},
	}

	if (self.product.presetMemory) {
		actions.presetMemory = {
			name: 'Recall Preset Memory (PMEM)',
			options: [dropdown('Memory', 'preset', self.product.presetChoices)],
			callback: async (action) => {
				await self.sendCommand(`XPM:01:${action.options.preset}`)
				self.data.pmem = parseInt(action.options.preset, 10)
				self.data.tmem = null
			},
		}
	}

	if (self.product.tracingMemory) {
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
					...dropdown('Memory', 'trace', self.product.tracingChoices),
					isVisible: (options) => options.opt === '02',
				},
			],
			callback: async (action) => {
				switch (action.options.opt) {
					case '02': // Standby
						await self.sendCommand(`XTM:${action.options.opt}:${action.options.trace}`)
						self.data.pmem = parseInt(action.options.trace, 10)
						self.data.tmem = parseInt(action.options.trace, 10)
						break
					case '01': // Play
						await self.sendCommand(`XTM:${action.options.opt}:000`)
						break
					case '00': {
						// Stop
						const tmem = self.data.tmem ? String(self.data.tmem).padStart(3, '0') : '001'
						await self.sendCommand(`XTM:${action.options.opt}:${tmem}`)
						break
					}
				}
			},
		}
	}

	return actions
}
