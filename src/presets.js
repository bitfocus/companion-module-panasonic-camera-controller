import { combineRgb } from '@companion-module/base'

export function setPresets(self) {
	var p = self.product
	var presets = []

	const foregroundColor = combineRgb(255, 255, 255) // White
	const backgroundColor = combineRgb(255, 0, 0) // Red

	for (var x = 0; x < p.cameraChoices.length; x++) {
		presets.push({
			type: 'button',
			category: 'Select camera',
			name: 'Select camera by camera number',
			style: {
				text: 'Select\\n' + p.cameraChoices[x].label,
				size: '14',
				color: '16777215',
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectCamera',
							options: {
								camera: p.cameraChoices[x].id,
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
						camera: p.cameraChoices[x].id,
					},
					style: {
						color: foregroundColor,
						bgcolor: backgroundColor,
					},
				},
			],
		})
	}

	// Generate group presets
	for (var x = 0; x < p.groupChoices.length; x++) {
		presets.push({
			type: 'button',
			category: 'Select group',
			name: 'Select camera group',
			style: {
				text: 'Select\\n' + p.groupChoices[x].label,
				size: '14',
				color: '16777215',
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectGroup',
							options: {
								group: p.groupChoices[x].id,
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
						group: p.groupChoices[x].id,
					},
					style: {
						color: foregroundColor,
						bgcolor: backgroundColor,
					},
				},
			],
		})
	}

	// Generate port presets
	for (var x = 0; x < p.portChoices.length; x++) {
		presets.push({
			type: 'button',
			category: 'Select port',
			name: 'Select port',
			style: {
				text: 'Select\\n' + p.portChoices[x].label,
				size: '14',
				color: '16777215',
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'selectPort',
							options: {
								port: p.portChoices[x].id,
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
						port: p.portChoices[x].id,
					},
					style: {
						color: foregroundColor,
						bgcolor: backgroundColor,
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
			color: '16777215',
			bgcolor: combineRgb(0, 0, 0),
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
	if (p.presetMemory == true) {
		for (var x = 0; x < p.presetChoices.length; x++) {
			presets.push({
				type: 'button',
				category: 'Preset memory',
				name: 'Select preset memory',
				style: {
					text: 'Recall\\n' + p.presetChoices[x].label,
					size: '14',
					color: '16777215',
					bgcolor: combineRgb(0, 0, 0),
				},
				steps: [
					{
						down: [
							{
								actionId: 'presetMemory',
								options: {
									preset: p.presetChoices[x].id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			})
		}
	}

	// Generate tracing presets
	if (p.tracingMemory == true) {
		for (var x = 0; x < p.tracingChoices.length; x++) {
			presets.push({
				type: 'button',
				category: 'Tracing memory',
				name: p.tracingChoices[x].label,
				style: {
					text: 'Standby/Play/Stop\\n' + p.tracingChoices[x].label,
					size: '14',
					color: '16777215',
					bgcolor: combineRgb(255, 0, 255),
				},
				steps: [
					{
						down: [
							{
								actionId: 'tracingMemory',
								options: {
									opt: '02',
									preset: p.tracingChoices[x].id,
								},
							},
						],
						up: [],
					},
					{
						down: [
							{
								actionId: 'tracingMemory',
								options: {
									opt: '01',
									preset: p.tracingChoices[x].id,
								},
							},
						],
						up: [],
					},
					{
						down: [
							{
								actionId: 'tracingMemory',
								options: {
									opt: '00',
									preset: p.tracingChoices[x].id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			})
		}
	}

	return presets
}
