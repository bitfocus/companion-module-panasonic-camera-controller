import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from './common.js'

// Zero-pad to three digits for the preset/tracing memory commands (e.g. XPM:01:001).
const pad3 = (n) => String(n).padStart(3, '0')

// A numeric option field. Being a `number` field, the host coerces expression/variable
// results to an integer and validates the 1..max range before the callback runs.
function numberField(label, id, max, noun) {
	return {
		type: 'number',
		label,
		id,
		default: 1,
		min: 1,
		max,
		asInteger: true,
		expressionDescription: `${noun} (1–${max})`,
	}
}

function resetMem(self) {
	self.data.pmem = null
	self.data.tmem = null
}

export function setActions(self) {
	const actions = {}

	actions.selectCamera = {
		name: 'Select Camera',
		options: [numberField(CAMERA_LABEL, 'camera', self.product.numberOfCameras, 'Camera number')],
		callback: async (action) => {
			await self.sendCommand(`XCN:01:${action.options.camera}`)
			resetMem(self)
		},
	}

	actions.selectGroup = {
		name: 'Select Group',
		options: [numberField(GROUP_LABEL, 'group', self.product.numberOfGroups, 'Group number')],
		callback: async (action) => {
			await self.sendCommand(`XGP:${action.options.group}`)
			resetMem(self)
		},
	}

	actions.selectGroupPort = {
		name: 'Select Group + Port',
		options: [
			numberField(GROUP_LABEL, 'group', self.product.numberOfGroups, 'Group number'),
			numberField(PORT_LABEL, 'port', self.product.numberOfPorts, 'Port number'),
		],
		callback: async (action) => {
			await self.sendCommand(`XCN:02:${action.options.group}:${action.options.port}`)
			resetMem(self)
		},
	}

	actions.selectPort = {
		name: 'Select Port',
		options: [numberField(PORT_LABEL, 'port', self.product.numberOfPorts, 'Port number')],
		callback: async (action) => {
			await self.sendCommand(`XPT:${action.options.port}`)
			resetMem(self)
		},
	}

	if (self.product.presetMemory) {
		actions.presetMemory = {
			name: 'Recall Preset Memory (PMEM)',
			options: [numberField('Memory', 'preset', self.product.numberOfPresets, 'Preset memory number')],
			callback: async (action) => {
				await self.sendCommand(`XPM:01:${pad3(action.options.preset)}`)
				self.data.pmem = action.options.preset
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
					// Referenced by the trace field's isVisibleExpression, so it must not itself be an expression.
					disableAutoExpression: true,
					choices: [
						{ id: '02', label: 'Standby' },
						{ id: '01', label: 'Play' },
						{ id: '00', label: 'Stop' },
					],
				},
				{
					...numberField('Memory', 'trace', self.product.numberOfTracing, 'Tracing memory number'),
					isVisibleExpression: '$(options:opt) == "02"',
				},
			],
			callback: async (action) => {
				switch (action.options.opt) {
					case '02': // Standby
						await self.sendCommand(`XTM:${action.options.opt}:${pad3(action.options.trace)}`)
						self.data.pmem = action.options.trace
						self.data.tmem = action.options.trace
						break
					case '01': // Play
						await self.sendCommand(`XTM:${action.options.opt}:000`)
						break
					case '00': {
						// Stop
						await self.sendCommand(`XTM:${action.options.opt}:${pad3(self.data.tmem || 1)}`)
						break
					}
				}
			},
		}
	}

	return actions
}
