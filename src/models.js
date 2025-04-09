import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL, PRESET_LABEL, TRACING_LABEL } from './common.js'

export const MODELS = [
	{ id: 'AW-RP50', label: 'AW-RP50' },
	{ id: 'AW-RP60', label: 'AW-RP60' },
	{ id: 'AW-RP120', label: 'AW-RP120' },
	{ id: 'AW-RP150', label: 'AW-RP150' },
]

export const PRODUCTS = {
	'AW-RP50': {
		numberOfCameras: 100,
		numberOfGroups: 20,
		numberOfPorts: 5,
		presetMemory: false,
		tracingMemory: false,
	},
	'AW-RP60': {
		numberOfCameras: 200,
		numberOfGroups: 40,
		numberOfPorts: 5,
		presetMemory: true,
		tracingMemory: false,
	},
	'AW-RP120': {
		numberOfCameras: 100,
		numberOfGroups: 10,
		numberOfPorts: 10,
		presetMemory: true,
		tracingMemory: true,
	},
	'AW-RP150': {
		numberOfCameras: 200,
		numberOfGroups: 20,
		numberOfPorts: 10,
		presetMemory: true,
		tracingMemory: true,
	},
}

export function generateChoices(label, numberOfChoices) {
	var choice = 1

	if (label == PRESET_LABEL || label == TRACING_LABEL) {
		return Array.from({ length: numberOfChoices }, () => ({
			id: ('00' + choice.toString(10)).slice(-3),
			label: `${label} ${choice++}`,
		}))
	} else {
		return Array.from({ length: numberOfChoices }, () => ({
			id: `${choice}`,
			label: `${label} ${choice++}`,
		}))
	}
}

export function initProduct(product) {
	if (!PRODUCTS[product].cameraChoices) {
		PRODUCTS[product].cameraChoices = generateChoices(CAMERA_LABEL, PRODUCTS[product].numberOfCameras)
		PRODUCTS[product].groupChoices = generateChoices(GROUP_LABEL, PRODUCTS[product].numberOfGroups)
		PRODUCTS[product].portChoices = generateChoices(PORT_LABEL, PRODUCTS[product].numberOfPorts)
		if (PRODUCTS[product].presetMemory) {
			PRODUCTS[product].presetChoices = generateChoices(PRESET_LABEL, 100)
		}
		if (PRODUCTS[product].tracingMemory) {
			PRODUCTS[product].tracingChoices = generateChoices(TRACING_LABEL, 100)
		}
	}
	return PRODUCTS[product]
}
