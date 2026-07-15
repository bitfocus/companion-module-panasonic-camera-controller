import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL, PRESET_LABEL, TRACING_LABEL } from './common.js'

export const MODELS = [
	{ id: 'AW-RP50', label: 'AW-RP50' },
	{ id: 'AW-RP60', label: 'AW-RP60' },
	{ id: 'AW-RP120', label: 'AW-RP120' },
	{ id: 'AW-RP150', label: 'AW-RP150' },
]

export const DEFAULT_MODEL = 'AW-RP50'

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
		numberOfPresets: 100,
		presetMemory: true,
		tracingMemory: false,
	},
	'AW-RP120': {
		numberOfCameras: 100,
		numberOfGroups: 10,
		numberOfPorts: 10,
		numberOfPresets: 100,
		numberOfTracing: 10,
		presetMemory: true,
		tracingMemory: true,
	},
	'AW-RP150': {
		numberOfCameras: 200,
		numberOfGroups: 20,
		numberOfPorts: 10,
		numberOfPresets: 100,
		numberOfTracing: 10,
		presetMemory: true,
		tracingMemory: true,
	},
}

// Preset/tracing memory ids must be sent zero-padded to three digits (e.g. XPM:01:001),
// hence the explicit `padded` flag; camera/group/port ids stay plain numbers.
export function generateChoices(label, count, padded = false) {
	return Array.from({ length: count }, (_, i) => {
		const n = i + 1
		return { id: padded ? String(n).padStart(3, '0') : n, label: `${label} ${n}` }
	})
}

const productCache = new Map()

// Pure factory: returns a frozen, per-model product object with its derived choice
// lists, memoized by model. Unknown models fall back to the default instead of crashing.
export function initProduct(model) {
	const key = PRODUCTS[model] ? model : DEFAULT_MODEL

	let product = productCache.get(key)
	if (!product) {
		const base = PRODUCTS[key]
		product = {
			...base,
			cameraChoices: generateChoices(CAMERA_LABEL, base.numberOfCameras),
			groupChoices: generateChoices(GROUP_LABEL, base.numberOfGroups),
			portChoices: generateChoices(PORT_LABEL, base.numberOfPorts),
		}
		if (base.presetMemory) {
			product.presetChoices = generateChoices(PRESET_LABEL, base.numberOfPresets, true)
		}
		if (base.tracingMemory) {
			product.tracingChoices = generateChoices(TRACING_LABEL, base.numberOfTracing, true)
		}
		Object.freeze(product)
		productCache.set(key, product)
	}
	return product
}
