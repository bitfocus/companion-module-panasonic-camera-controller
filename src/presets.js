import { combineRgb } from '@companion-module/base'

export function setPresets(self) {
	var presets = []

	const colorWhite = combineRgb(255, 255, 255)
	const colorRed = combineRgb(255, 0, 0)
	const colorGreen = combineRgb(0, 204, 0)
	const colorOrange = combineRgb(255, 102, 0)
	const colorBlue = combineRgb(0, 51, 204)
	const colorGrey = combineRgb(51, 51, 51)
	const colorBlack = combineRgb(0, 0, 0)

	for (var x = 0; x < self.product.cameraChoices.length; x++) {
		presets.push({
			type: 'button',
			category: 'Select camera',
			name: 'Select camera by camera number',
			style: {
				text: 'Select\\n' + self.product.cameraChoices[x].label,
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectCamera',
							options: {
								camera: self.product.cameraChoices[x].id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'cameraSelected',
					options: {
						camera: self.product.cameraChoices[x].id,
					},
					style: {
						color: colorWhite,
						bgcolor: colorOrange,
					},
				},
			],
		})
	}

	// Generate group presets
	for (let x = 0; x < self.product.groupChoices.length; x++) {
		presets.push({
			type: 'button',
			category: 'Select group',
			name: 'Select camera group',
			style: {
				text: 'Select\\n' + self.product.groupChoices[x].label,
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectGroup',
							options: {
								group: self.product.groupChoices[x].id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'groupSelected',
					options: {
						group: self.product.groupChoices[x].id,
					},
					style: {
						color: colorWhite,
						bgcolor: colorGreen,
					},
				},
			],
		})
	}

	// Generate port presets
	for (let x = 0; x < self.product.portChoices.length; x++) {
		presets.push({
			type: 'button',
			category: 'Select port',
			name: 'Select port',
			style: {
				text: 'Select\\n' + self.product.portChoices[x].label,
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectPort',
							options: {
								port: self.product.portChoices[x].id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'portSelected',
					options: {
						port: self.product.portChoices[x].id,
					},
					style: {
						color: colorWhite,
						bgcolor: colorOrange,
					},
				},
			],
		})
	}

	// Select by group and port preset
	presets.push({
		type: 'button',
		category: 'Select camera by group and port',
		name: 'Select camera by group and port',
		style: {
			text: 'Select\\nGroup +\\nPort',
			size: '14',
			color: colorWhite,
			bgcolor: colorBlack,
		},
		steps: [
			{
				down: [
					{
						actionId: 'selectGroupPort',
						options: {
							group: '1',
							port: '1',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	})

	// Generate preset memory presets
	if (self.product.presetMemory == true) {
		for (let x = 0; x < self.product.presetChoices.length; x++) {
			presets.push({
				type: 'button',
				category: 'Preset memory',
				name: 'Select preset memory',
				style: {
					text: 'Recall\\n' + self.product.presetChoices[x].label,
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'presetMemory',
								options: {
									preset: self.product.presetChoices[x].id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'presetSelected',
						options: {
							pmem: self.product.presetChoices[x].id,
						},
						style: {
							color: colorWhite,
							bgcolor: colorBlue,
						},
					},
				],
			})
		}
	}

	// Generate tracing presets
	if (self.product.tracingMemory == true) {
		for (let x = 0; x < self.product.tracingChoices.length; x++) {
			presets.push({
				type: 'button',
				category: 'Tracing memory',
				name: self.product.tracingChoices[x].label,
				style: {
					text: 'Standby\\n' + self.product.tracingChoices[x].label,
					size: '14',
					color: colorWhite,
					bgcolor: colorOrange,
				},
				steps: [
					{
						down: [
							{
								actionId: 'tracingMemory',
								options: {
									opt: '02',
									trace: self.product.tracingChoices[x].id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'traceSelected',
						options: {
							tmem: self.product.tracingChoices[x].id,
						},
						style: {
							color: colorWhite,
							bgcolor: colorBlue,
						},
					},
				],
			})
		}

		presets.push({
			type: 'button',
			category: 'Tracing memory',
			name: 'TMEM Play',
			style: {
				text: 'Play\\nTMEM',
				size: '14',
				color: colorWhite,
				bgcolor: colorRed,
			},
			steps: [
				{
					down: [
						{
							actionId: 'tracingMemory',
							options: {
								opt: '01',
								trace: self.product.tracingChoices[0].id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		})

		presets.push({
			type: 'button',
			category: 'Tracing memory',
			name: 'TMEM Stop',
			style: {
				text: 'Stop\\nTMEM',
				size: '14',
				color: colorWhite,
				bgcolor: colorGrey,
			},
			steps: [
				{
					down: [
						{
							actionId: 'tracingMemory',
							options: {
								opt: '00',
								//trace: '001',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		})
	}

	return presets
}
