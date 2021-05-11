const instance_skel = require('../../instance_skel')
const got = require('got')
var debug
var log

var CHOICES_PRESET = []
for (var i = 0; i < 100; ++i) {
	var x = i + 1
	CHOICES_PRESET.push({ id: ('00' + x.toString(10)).substr(-3, 3), label: 'Preset ' + (i + 1) })
}

var CHOICES_TRACING = []
for (var i = 0; i < 100; ++i) {
	var x = i + 1
	CHOICES_TRACING.push({ id: ('00' + x.toString(10)).substr(-3, 3), label: 'Tracing ' + (i + 1) })
}

const MODELS = [
	{ id: 'AW-RP50', label: 'AW-RP50' },
	{ id: 'AW-RP60', label: 'AW-RP60' },
	{ id: 'AW-RP120', label: 'AW-RP120' },
	{ id: 'AW-RP150', label: 'AW-RP150' },
]

const PRODUCTS = {
	'AW-RP50': {
		numberOfCameras: 100,
		numberOfGroups: 20,
		numberOfPorts: 5,
		presetMemory: false,
		presetTracing: false,
	},
	'AW-RP60': {
		numberOfCameras: 200,
		numberOfGroups: 40,
		numberOfPorts: 5,
		presetMemory: true,
		presetTracing: false,
	},
	'AW-RP120': {
		numberOfCameras: 100,
		numberOfGroups: 10,
		numberOfPorts: 10,
		presetMemory: true,
		presetTracing: true,
	},
	'AW-RP150': {
		numberOfCameras: 200,
		numberOfGroups: 20,
		numberOfPorts: 10,
		presetMemory: true,
		presetTracing: true,
	},
}

const CAMERA_LABEL = 'Cam'
const GROUP_LABEL = 'Group'
const PORT_LABEL = 'Port'

const generateChoices = (label, numberOfChoices) => {
	var choice = 1
	return Array.from({ length: numberOfChoices }, () => ({
		id: `${choice}`,
		label: `${label} ${choice++}`,
	}))
}

const initProduct = (product) => {
	if (!PRODUCTS[product].cameraChoices) {
		PRODUCTS[product].cameraChoices = generateChoices(CAMERA_LABEL, PRODUCTS[product].numberOfCameras)
		PRODUCTS[product].groupChoices = generateChoices(GROUP_LABEL, PRODUCTS[product].numberOfGroups)
		PRODUCTS[product].portChoices = generateChoices(PORT_LABEL, PRODUCTS[product].numberOfPorts)
	}
	return PRODUCTS[product]
}

function instance(system, id, config) {
	const self = this
	instance_skel.apply(self, arguments)
	return self
}

instance.prototype.init = function () {
	const self = this

	debug = self.debug
	log = self.log

	self.data = {
		camera: 'NaN',
		group: 'NaN',
		port: 'NaN',
	}

	self.lastGet = true
	self.config.model = this.config.model || 'AW-RP50'
	self.config.apiEnabled = this.config.apiEnabled || true
	self.product = initProduct(self.config.model)
	self.status(self.STATUS_UNKNOWN)
	self.actions()
	if (self.config.apiEnabled == true) {
		self.initAPI.bind(this)()
	}
	self.init_presets()
	self.init_feedbacks()
	self.checkFeedbacks()
	self.init_variables()
	self.checkVariables()
	if (self.config.host != '') {
		self.status(self.STATUS_OK)
	}
}

instance.prototype.destroy = function () {
	var self = this
	if (self.socket !== undefined) {
		self.socket.destroy()
	}

	if (self.pollAPI) {
		clearInterval(self.pollAPI)
	}

	self.debug('destroy', self.id)
}

instance.prototype.config_fields = function () {
	const self = this
	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: `Panasonic PTZ remote camera controller`,
		},
		{
			type: 'dropdown',
			id: 'model',
			label: 'Select Your Controler Model',
			width: 3,
			default: 'AW-RP50',
			choices: MODELS,
			minChoicesForSearch: 5,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Controller IP',
			width: 6,
			regex: self.REGEX_IP,
		},
		{
			type: 'textinput',
			id: 'httpPort',
			label: 'HTTP Port (Default: 80)',
			width: 3,
			default: 80,
			regex: this.REGEX_PORT,
		},
		{
			type: 'text',
			id: 'apiPollInfo',
			width: 12,
			label: 'API Poll Interval warning',
			value:
				'Adjusting the API Polling Interval can impact performance. <br />' +
				'A lower invterval allows for more responsive feedback, but may impact CPU usage. <br />' +
				'Less than 500 ms is not recommended, as the controllers are relatively slow to respond',
		},
		{
			type: 'textinput',
			id: 'apiPollInterval',
			label: 'API Polling interval (ms) (default: 1000, min: 250)',
			width: 4,
			default: 1000,
			min: 250,
			max: 10000,
			regex: this.REGEX_NUMBER,
		},
		{
			type: 'checkbox',
			id: 'apiEnabled',
			width: 3,
			label: 'Enable Feebacks/Polling',
			default: true,
		},
	]
}

instance.prototype.updateConfig = function (config) {
	var self = this
	self.status(self.STATUS_UNKNOWN)
	self.lastGet = true
	self.config = config
	self.product = initProduct(self.config.model)
	self.actions()
	if (self.config.apiEnabled == true) {
		self.initAPI.bind(this)()
	}
	self.init_presets()
	self.init_feedbacks()
	self.checkFeedbacks()
	self.init_variables()
	self.checkVariables()
	if (self.config.host != '') {
		self.status(self.STATUS_OK)
	}
}

instance.prototype.init_presets = function () {
	const self = this
	var p = self.product
	var presets = []

	for (var x = 0; x < 8; x++) {
		presets.push({
			category: 'Select Camera',
			label: 'By Camera Number',
			bank: {
				style: 'text',
				text: 'Select\\nCam ' + p.cameraChoices[x].id,
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'selectCamera',
					options: {
						camera: p.cameraChoices[x].id,
					},
				},
			],
			feedbacks: [
				{
					type: 'cameraSelected',
					options: {
						camera: p.cameraChoices[x].id,
					},
				},
			],
		})
	}

	for (var x = 0; x < 8; x++) {
		presets.push({
			category: 'Select Camera',
			label: 'By Group',
			bank: {
				style: 'text',
				text: 'Select\\nGroup ' + p.groupChoices[x].id,
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'selectGroup',
					options: {
						group: p.groupChoices[x].id,
					},
				},
			],
			feedbacks: [
				{
					type: 'groupSelected',
					options: {
						camera: p.groupChoices[x].id,
					},
				},
			],
		})
	}

	for (var x = 0; x < 5; x++) {
		presets.push({
			category: 'Select Camera',
			label: 'By Port',
			bank: {
				style: 'text',
				text: 'Select\\nPort ' + p.portChoices[x].id,
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'selectPort',
					options: {
						port: p.portChoices[x].id,
					},
				},
			],
			feedbacks: [
				{
					type: 'portSelected',
					options: {
						camera: p.portChoices[x].id,
					},
				},
			],
		})
	}

	presets.push({
		category: 'Select Camera',
		label: 'By Group and Port',
		bank: {
			style: 'text',
			text: 'Select\\nGroup +\\nPort',
			size: '14',
			color: '16777215',
			bgcolor: self.rgb(0, 0, 0),
		},
		actions: [
			{
				action: 'selectGroupPort',
				options: {
					group: '1',
					port: '1',
				},
			},
		],
	})

	if (p.presetMemory == true) {
		for (var x in CHOICES_PRESET) {
			presets.push({
				category: 'Preset Memory',
				label: 'Preset ' + CHOICES_PRESET[x].id,
				bank: {
					style: 'text',
					text: 'Preset\\n' + CHOICES_PRESET[x].id,
					size: '14',
					color: '16777215',
					bgcolor: self.rgb(0, 0, 0),
				},
				actions: [
					{
						action: 'presetMemory',
						options: {
							preset: CHOICES_PRESET[x].id,
						},
					},
				],
			})
		}
	}

	if (p.presetTracing == true) {
		presets.push({
			category: 'Preset Tracing Standby',
			label: 'Play Trace',
			bank: {
				style: 'text',
				text: 'Play\\nTrace',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'presetTracing',
					options: {
						opt: '01',
						preset: '01',
					},
				},
			],
		})

		for (var x in CHOICES_TRACING) {
			presets.push({
				category: 'Preset Tracing Standby',
				label: 'Standby Trace ' + CHOICES_TRACING[x].id,
				bank: {
					style: 'text',
					text: 'Standby\\nTrace\\n' + CHOICES_TRACING[x].id,
					size: '14',
					color: '16777215',
					bgcolor: self.rgb(0, 0, 0),
				},
				actions: [
					{
						action: 'presetTracing',
						options: {
							opt: '02',
							preset: CHOICES_TRACING[x].id,
						},
					},
				],
			})
		}

		presets.push({
			category: 'Preset Tracing Stop',
			label: 'Play Trace',
			bank: {
				style: 'text',
				text: 'Play\\nTrace',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0, 0, 0),
			},
			actions: [
				{
					action: 'presetTracing',
					options: {
						opt: '01',
						preset: '01',
					},
				},
			],
		})

		for (var x in CHOICES_TRACING) {
			presets.push({
				category: 'Preset Tracing Stop',
				label: 'Stop Trace ' + CHOICES_TRACING[x].id,
				bank: {
					style: 'text',
					text: 'Stop\\nTrace\\n' + CHOICES_TRACING[x].id,
					size: '14',
					color: '16777215',
					bgcolor: self.rgb(0, 0, 0),
				},
				actions: [
					{
						action: 'presetTracing',
						options: {
							opt: '00',
							preset: CHOICES_TRACING[x].id,
						},
					},
				],
			})
		}
	}

	self.setPresetDefinitions(presets)
}

instance.prototype.init_variables = function () {
	const self = this
	const variables = [
		{ name: 'camera', label: 'Selected Camera' },
		{ name: 'group', label: 'Selected Group' },
		{ name: 'port', label: 'Selected Port' },
	]

	self.setVariableDefinitions(variables)
}

instance.prototype.checkVariables = function () {
	var self = this

	self.setVariable('camera', self.data.camera)
	self.setVariable('group', self.data.group)
	self.setVariable('port', self.data.port)
}

instance.prototype.setFeedbacks = function () {
	var self = this
	var p = self.product
	var feedbacks = {}

	const foregroundColor = {
		type: 'colorpicker',
		label: 'Foreground color',
		id: 'fg',
		default: self.rgb(255, 255, 255), // White
	}

	const backgroundColor = {
		type: 'colorpicker',
		label: 'Background color ON',
		id: 'bg',
		default: self.rgb(255, 0, 0), // Red
	}

	feedbacks.cameraSelected = {
		label: 'Camera Selected',
		description: 'Indicate if Camera is selected',
		options: [
			{
				type: 'dropdown',
				label: CAMERA_LABEL,
				id: 'camera',
				default: '1',
				choices: p.cameraChoices,
			},
			foregroundColor,
			backgroundColor,
		],
		callback: function (feedback, bank) {
			var opt = feedback.options
			if (opt.camera == self.data.camera) {
				return { color: opt.fg, bgcolor: opt.bg }
			}
		},
	}

	feedbacks.groupSelected = {
		label: 'Group Selected',
		description: 'Indicate if Group is selected',
		options: [
			{
				type: 'dropdown',
				label: GROUP_LABEL,
				id: 'group',
				default: '1',
				choices: p.groupChoices,
			},
			foregroundColor,
			backgroundColor,
		],
		callback: function (feedback, bank) {
			var opt = feedback.options
			if (opt.group == self.data.group) {
				return { color: opt.fg, bgcolor: opt.bg }
			}
		},
	}

	feedbacks.portSelected = {
		label: 'Port Selected',
		description: 'Indicate if Port is selected',
		options: [
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: '1',
				choices: p.portChoices,
			},
			foregroundColor,
			backgroundColor,
		],
		callback: function (feedback, bank) {
			var opt = feedback.options
			if (opt.port == self.data.port) {
				return { color: opt.fg, bgcolor: opt.bg }
			}
		},
	}

	return feedbacks
}

instance.prototype.init_feedbacks = function (system) {
	const self = this
	self.setFeedbackDefinitions(self.setFeedbacks())
}

instance.prototype.actions = function () {
	const self = this
	var p = self.product
	var actions = {}

	actions.selectCamera = {
		label: 'Select Camera',
		options: [
			{
				type: 'dropdown',
				label: CAMERA_LABEL,
				id: 'camera',
				default: '1',
				choices: p.cameraChoices,
			},
		],
	}

	actions.selectGroup = {
		label: 'Select Group',
		options: [
			{
				type: 'dropdown',
				label: 'Group',
				id: 'group',
				default: '1',
				choices: p.groupChoices,
			},
		],
	}

	actions.selectGroupPort = {
		label: 'Select Group + Port',
		options: [
			{
				type: 'dropdown',
				label: GROUP_LABEL,
				id: 'group',
				default: '1',
				choices: p.groupChoices,
			},
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: '1',
				choices: p.portChoices,
			},
		],
	}

	actions.selectPort = {
		label: 'Select Port',
		options: [
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				default: '1',
				choices: p.portChoices,
			},
		],
	}

	if (p.presetMemory == true) {
		actions.presetMemory = {
			label: 'Select Preset Memory',
			options: [
				{
					type: 'dropdown',
					label: 'Select Preset',
					id: 'preset',
					default: '1',
					choices: CHOICES_PRESET,
				},
			],
		}
	}

	if (p.presetTracing == true) {
		actions.presetTracing = {
			label: 'Preset Traceing',
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
					id: 'preset',
					choices: CHOICES_TRACING,
				},
			],
		}
	}

	self.system.emit('instance_actions', self.id, actions)
}

instance.prototype.action = function ({ action, options } = {}) {
	const self = this
	const actionHandlers = {
		selectCamera: (options) => self.sendCommand(`XCN:01:${options.camera}`).then(),
		selectGroup: (options) => self.sendCommand(`XGP:${options.group}`).then(),
		selectGroupPort: (options) => self.sendCommand(`XCN:02:${options.group}:${options.port}`).then(),
		selectPort: (options) => self.sendCommand(`XPT:${options.port}`).then(),
		presetMemory: (options) => self.sendCommand(`XPM:01:${options.preset}`).then(),
		presetTracing: (options) => {
			var preset = options.preset
			if (options.opt == '01') {
				preset = '000'
			}
			self.sendCommand(`XPM:${options.opt}:${preset}`).then()
		},
	}

	if (!actionHandlers[action]) {
		self.log('warn', `No handler defined for action: ${action}`)
		return
	}

	actionHandlers[action](options).catch((error) => {
		if (error == 'Error: socket hang up') {
			return
		} // This is the expected behavior, since it's the controller closing the connection. Therefore we ignore it here
		self.log('error', `${action}: ${error.toString()}`)
		console.log(`${action}: ${error.toString()}`)
		debug(`${action}: ${error.toString()}`)
	})
}

instance.prototype.sendCommand = function (command) {
	const self = this
	const url = `http://${this.config.host}:${this.config.httpPort || 80}/cgi-bin/aw_cam?cmd=${command}&res=1`
	const extraHeaders = {}
	const extraArgs = {
		requestConfig: { keepAlive: true, timeout: 1000 },
		responseConfig: { timeout: 1000 },
	}
	return new Promise((resolve, reject) => {
		self.system.emit(
			'rest_get',
			url,
			(err, { data, error, response }) => {
				if (err) {
					reject(error)
					return
				}
				resolve(data)
			},
			extraHeaders,
			extraArgs
		)
	})
}

instance.prototype.initAPI = function () {
	const self = this
	const parseData = (body) => {
		var str_raw = String(body)
		var str = {}

		str_raw = str_raw.split('\r\n') // Split Data in order to remove data before and after command

		str = str_raw[0].trim() // remove new line, carage return and so on.
		str = str.split(':') // Split Commands and data
		console.log('HTTP Recived from Controller: ' + str_raw[0])
		debug('HTTP Recived from Controller: ' + str_raw[0]) // Debug Recived data

		// Store Data
		if (str[0] == 'XQC') {
			switch (
				str[1] // str[0] is always XQC
			) {
				case '01':
					self.data.camera = str[2]
					break
				case '02':
					self.data.group = str[2]
					self.data.port = str[3]
					break
				default:
					break
			}
		}

		self.checkVariables()
		self.checkFeedbacks()
	}

	const getStatus = () => {
		got.retry = 0 // Disable reties

		// For sepecifiing a headder
		const options = {
			// headers: {
			// 	Authorization: `Basic ${Buffer.from(this.config.username + ':' + this.config.password).toString('base64')}`
			// }
		}

		// Get Selected Camera
		if (self.lastGet == true) {
			got
				.get(`http://${this.config.host}:${this.config.httpPort || 80}/cgi-bin/aw_cam?cmd=XQC:01&res=1`, options)
				.then((res) => {
					if (res.statusCode === 200) {
						this.status(this.STATE_OK)
						this.debug('Connected')
						// console.log(res.body);
						parseData(res.body)
						// return parseData(res.body);
					}
				})
				.catch((err) => {
					this.debug('Network error', err)
					this.status(this.STATE_ERROR, err)
					this.debug('Panasonic API err:' + JSON.stringify(err))
				})
		}

		// Get Selected Group and Port
		if (self.lastGet == false) {
			got
				.get(`http://${this.config.host}:${this.config.httpPort || 80}/cgi-bin/aw_cam?cmd=XQC:02&res=1`, options)
				.then((res) => {
					if (res.statusCode === 200) {
						this.status(this.STATE_OK)
						this.debug('Connected')
						// console.log(res.body);
						parseData(res.body)
						// return parseData(res.body);
					}
				})
				.catch((err) => {
					this.debug('Network error', err)
					this.status(this.STATE_ERROR, err)
					this.debug('Panasonic API err:' + JSON.stringify(err))
				})
		}

		self.lastGet = !self.lastGet // toggles to get Camera, vs Group and Port
	}

	if (this.pollAPI) {
		clearInterval(this.pollAPI)
	}

	if (this.config.apiPollInterval != 0) {
		this.pollAPI = setInterval(getStatus, this.config.apiPollInterval < 100 ? 100 : this.config.apiPollInterval)
	}
}

instance_skel.extendedBy(instance)

exports = module.exports = instance
