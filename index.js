const instance_skel = require('../../instance_skel');

var CHOICES_PRESET = [];
for (var i = 0; i < 100; ++i) {
	var x = i+1;
	CHOICES_PRESET.push({ id: ('00' + x.toString(10)).substr(-3, 3), label: 'Preset ' + (i + 1) });
}

var CHOICES_TRACING = [];	
for (var i = 0; i < 100; ++i) {
	var x = i+1;
	CHOICES_TRACING.push({ id: ('00' + x.toString(10)).substr(-3, 3), label: 'Tracing ' + (i + 1) });
}

const MODELS = [
	{ id: 'AW-RP50', label: 'AW-RP50' },
	{ id: 'AW-RP60', label: 'AW-RP60' },
	{ id: 'AW-RP120', label: 'AW-RP120' },
	{ id: 'AW-RP150', label: 'AW-RP150' },
];

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
	}
};

const CAMERA_LABEL = 'Cam';
const GROUP_LABEL = 'Group';
const PORT_LABEL = 'Port';

const generateChoices = (label, numberOfChoices) => {
	var choice = 1;
	return Array.from({ length: numberOfChoices }, () => ({
		id: `${choice}`,
		label: `${label} ${choice++}`
	}));
};

const initProduct = (product) => {
	if (!PRODUCTS[product].cameraChoices) {
		PRODUCTS[product].cameraChoices = generateChoices(CAMERA_LABEL, PRODUCTS[product].numberOfCameras);
		PRODUCTS[product].groupChoices = generateChoices(GROUP_LABEL, PRODUCTS[product].numberOfGroups);
		PRODUCTS[product].portChoices = generateChoices(PORT_LABEL, PRODUCTS[product].numberOfPorts);
	}
	return PRODUCTS[product];
};

function instance(system, id, config) {
	const self = this;
	instance_skel.apply(self, arguments);
	return self;
}

instance.prototype.init = function () {
	const self = this;
	self.config.model = this.config.model || 'AW-RP50';
	self.product = initProduct(self.config.model);
	self.status(self.STATUS_UNKNOWN);
	self.actions();
	self.init_presets();
	self.init_variables();
	if (self.config.host != '') { self.status(self.STATUS_OK); }
}

instance.prototype.destroy = function () {
	const self = this;
}

instance.prototype.config_fields = function () {
	const self = this;
	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: `Panasonic PTZ remote camera controller`
		},
		{
			type: 'dropdown',
			id: 'model',
			label: 'Select Your Controler Model',
			width: 6,
			default: 'AW-RP50',
			choices: MODELS,
			minChoicesForSearch: 5
		},		
		{
			type: 'textinput',
			id: 'host',
			label: 'Controller IP',
			width: 6,
			regex: self.REGEX_IP
		},
	];
}

instance.prototype.updateConfig = function (config) {
	var self = this;
	self.status(self.STATUS_UNKNOWN);
	self.config = config;
	self.product = initProduct(self.config.model);
	self.actions();
	self.init_presets();
	self.init_variables();
	if (self.config.host != '') { self.status(self.STATUS_OK); }
}

instance.prototype.init_presets = function () {
	const self = this;
	var p = self.product;
	var presets = [];


	for (var x = 0; x < 8; x++) {
		presets.push({
			category: 'Select Camera',
			label: 'By Camera Number',
			bank: {
				style: 'text',
				text: 'Select\\nCam ' + p.cameraChoices[x].id,
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0,0,0)
			},
			actions: [
				{
					action: 'selectCamera',
					options: {
						camera: p.cameraChoices[x].id
					}
				}
			]
		});
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
				bgcolor: self.rgb(0,0,0)
			},
			actions: [
				{
					action: 'selectGroup',
					options: {
						group: p.groupChoices[x].id
					}
				}
			]
		});
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
				bgcolor: self.rgb(0,0,0)
			},
			actions: [
				{
					action: 'selectPort',
					options: {
						port: p.portChoices[x].id
					}
				}
			]
		});
	}

	presets.push({
		category: 'Select Camera',
		label: 'By Group and Port',
		bank: {
			style: 'text',
			text: 'Select\\nGroup +\\nPort',
			size: '14',
			color: '16777215',
			bgcolor: self.rgb(0,0,0)
		},
		actions: [
			{
				action: 'selectGroupPort',
				options: {
					group: '1',
					port: '1'
				}
			}
		]
	});

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
					bgcolor: self.rgb(0,0,0)
				},
				actions: [
					{
						action: 'presetMemory',
						options: {
							preset: CHOICES_PRESET[x].id
						}
					}
				]
			});    
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
				bgcolor: self.rgb(0,0,0)
			},
			actions: [
				{
					action: 'presetTracing',
					options: {
						opt: '01',
						preset: '01',
					}
				}
			]
		});    

		for (var x in CHOICES_TRACING) {
			presets.push({
				category: 'Preset Tracing Standby',
				label: 'Standby Trace ' + CHOICES_TRACING[x].id,
				bank: {
					style: 'text',
					text: 'Standby\\nTrace\\n' + CHOICES_TRACING[x].id,
					size: '14',
					color: '16777215',
					bgcolor: self.rgb(0,0,0)
				},
				actions: [
					{
						action: 'presetTracing',
						options: {
							opt: '02',
							preset: CHOICES_TRACING[x].id
						}
					}
				]
			});    
		}

		presets.push({
			category: 'Preset Tracing Stop',
			label: 'Play Trace',
			bank: {
				style: 'text',
				text: 'Play\\nTrace',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0,0,0)
			},
			actions: [
				{
					action: 'presetTracing',
					options: {
						opt: '01',
						preset: '01',
					}
				}
			]
		});    

		for (var x in CHOICES_TRACING) {
			presets.push({
				category: 'Preset Tracing Stop',
				label: 'Stop Trace ' + CHOICES_TRACING[x].id,
				bank: {
					style: 'text',
					text: 'Stop\\nTrace\\n' + CHOICES_TRACING[x].id,
					size: '14',
					color: '16777215',
					bgcolor: self.rgb(0,0,0)
				},
				actions: [
					{
						action: 'presetTracing',
						options: {
							opt: '00',
							preset: CHOICES_TRACING[x].id
						}
					}
				]
			});    
		}
	}

	self.setPresetDefinitions(presets);
};

instance.prototype.init_variables = function () {
	const self = this;
	const variables = [
		{ name: 'camera', label: 'Selected Camera' },
		{ name: 'group', label: 'Selected Group' },
		{ name: 'port', label: 'Selected Port' }
	];

	self.setVariableDefinitions(variables);
}

instance.prototype.actions = function () {
	const self = this;
	var p = self.product;
	var actions = {};

	actions.selectCamera = {
		label: 'Select Camera',
		options: [
			{
				type: 'dropdown',
				label: CAMERA_LABEL,
				id: 'camera',
				choices: p.cameraChoices
			}
		]
	};

	actions.selectGroup = {
		label: 'Select Group',
		options: [
			{
				type: 'dropdown',
				label: 'Group',
				id: 'group',
				choices: p.groupChoices
			}
		]
	};
	
	actions.selectGroupPort = {
		label: 'Select Group + Port',
		options: [
			{
				type: 'dropdown',
				label: GROUP_LABEL,
				id: 'group',
				choices: p.groupChoices
			},
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				choices: p.portChoices
			}
		]
	};

	actions.selectPort = {
		label: 'Select Port',
		options: [
			{
				type: 'dropdown',
				label: PORT_LABEL,
				id: 'port',
				choices: p.portChoices
			}
		]
	};

	if (p.presetMemory == true) {actions.presetMemory = {
			label: 'Select Preset Memory',
			options: [
				{
					type: 'dropdown',
					label: 'Select Preset',
					id: 'preset',
					choices: CHOICES_PRESET
				}
			]
		};
	}

	if (p.presetTracing == true) {actions.presetTracing = {
		label: 'Preset Traceing',
		options: [
			{
				type: 'dropdown',
				label: 'Option',
				id: 'opt',
				default: 'Standby',
				choices: [
					{ id: '02', label: 'Standby' },
					{ id: '01', label: 'Play' },
					{ id: '00', label: 'Stop' }		
				]
			},
			{
				type: 'dropdown',
				label: 'Select Trace',
				id: 'preset',
				choices: CHOICES_TRACING
			}
		]
	};
}

	self.system.emit('instance_actions', self.id, actions);
}

instance.prototype.sendCommand = function (command) {
	const self = this;
	const url = `http://${self.config.host}/cgi-bin/aw_cam?cmd=${command}&res=1`;
	const extraHeaders = {};
	const extraArgs = {
		requestConfig: { keepAlive: true, timeout: 1000 },
		responseConfig: { timeout: 1000 }
	};
	return new Promise((resolve, reject) => {
		self.system.emit('rest_get', url, (err, { data, error, response }) => {
			if (err) {
				reject(error);
				return;
			}
			resolve(data);
		}, extraHeaders, extraArgs);
	});
};

instance.prototype.action = function ({ action, options } = {}) {
	const self = this;
	const actionHandlers = {
		'selectCamera': (options) => (
			self.sendCommand(`XCN:01:${options.camera}`)
				.then(() => self.setVariable('camera', options.camera))
		),
		'selectGroup': (options) => (
			self.sendCommand(`XGP:${options.group}`)
				.then(() => self.setVariable('group', options.group))
		),
		'selectGroupPort': (options) => (
			self.sendCommand(`XCN:02:${options.group}:${options.port}`)
				.then(() => {
					self.setVariable('group', options.group);
					self.setVariable('port', options.port);
				})
		),
		'selectPort': (options) => (
			self.sendCommand(`XPT:${options.port}`)
				.then(() => self.setVariable('port', options.port))
		),
		'presetMemory': (options) => (
			self.sendCommand(`XPM:01:${options.preset}`)
				.then()
		),
		'presetTracing': (options) => {
			var preset = options.preset;
			if (options.opt == '01') { preset = '000'}
			self.sendCommand(`XPM:${options.opt}:${preset}`)
				.then()
		}
	};

	if (!actionHandlers[action]) {
		self.log('warn', `No handler defined for action: ${action}`);
		return;
	}

	actionHandlers[action](options)
		.catch((error) => {
			if (error == 'Error: socket hang up') { return } // This is the expected behavior, since it's the controller closing the connection. Therefore we ignore it here
			self.log('error', `${action}: ${error.toString()}`);
			console.log(`${action}: ${error.toString()}`);
			debug(`${action}: ${error.toString()}`);
		});
	};

instance_skel.extendedBy(instance);

exports = module.exports = instance;
