const instance_skel = require('../../instance_skel');

const PRODUCTS = {
	'AW-RP50': {
		numberOfCameras: 100,
		numberOfGroups: 20,
		numberOfPorts: 5
	},
	'AW-RP60': {
		numberOfCameras: 200,
		numberOfGroups: 40,
		numberOfPorts: 5
	},
	'AW-RP120': {
		numberOfCameras: 100,
		numberOfGroups: 10,
		numberOfPorts: 10
	},
	'AW-RP150': {
		numberOfCameras: 200,
		numberOfGroups: 20,
		numberOfPorts: 10
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
	self.product = initProduct(self.config.product);
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
			value: `Panasonic ${self.config.product} remote camera controller`
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Controller IP',
			width: 6,
			regex: self.REGEX_IP
		}
	];
}

instance.prototype.updateConfig = function (config) {
	const self = this;
	self.config = config;
	self.status(self.STATUS_UNKNOWN);
	if (self.config.host != '') { self.status(self.STATUS_OK); }
}

instance.prototype.init_presets = function () {
	const self = this;
	const presets = [
		{
			category: 'Select Camera',
			label: 'By Camera Number',
			bank: {
				style: 'text',
				text: 'Select\\nCamera',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0,0,255)
			},
			actions: [
				{
					action: 'selectCamera',
					options: {
						camera: '1'
					}
				}
			]
		},
		{
			category: 'Select Camera',
			label: 'By Group',
			bank: {
				style: 'text',
				text: 'Select\\nGroup',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0,0,255)
			},
			actions: [
				{
					action: 'selectGroup',
					options: {
						group: '1'
					}
				}
			]
		},
		{
			category: 'Select Camera',
			label: 'By Group and Port',
			bank: {
				style: 'text',
				text: 'Select\\nGroup +\\nPort',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0,0,255)
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
		},
		{
			category: 'Select Camera',
			label: 'By Port',
			bank: {
				style: 'text',
				text: 'Select\\nPort',
				size: '14',
				color: '16777215',
				bgcolor: self.rgb(0,0,255)
			},
			actions: [
				{
					action: 'selectPort',
					options: {
						port: '1'
					}
				}
			]
		}
	];

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
	const actions = {
		'selectCamera': {
			label: 'Select Camera',
			options: [
				{
					type: 'dropdown',
					label: CAMERA_LABEL,
					id: 'camera',
					choices: self.product.cameraChoices
				}
			]
		},
		'selectGroup': {
			label: 'Select Group',
			options: [
				{
					type: 'dropdown',
					label: 'Group',
					id: 'group',
					choices: self.product.groupChoices
				}
			]
		},
		'selectGroupPort': {
			label: 'Select Group + Port',
			options: [
				{
					type: 'dropdown',
					label: GROUP_LABEL,
					id: 'group',
					choices: self.product.groupChoices
				},
				{
					type: 'dropdown',
					label: PORT_LABEL,
					id: 'port',
					choices: self.product.portChoices
				}
			]
		},
		'selectPort': {
			label: 'Select Port',
			options: [
				{
					type: 'dropdown',
					label: PORT_LABEL,
					id: 'port',
					choices: self.product.portChoices
				}
			]
		}
	};

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
		)
	};

	if (!actionHandlers[action]) {
		self.log('warn', `No handler defined for action: ${action}`);
		return;
	}

	actionHandlers[action](options)
		.catch((error) => self.log('error', `${action}: ${error.toString()}`));
};

instance_skel.extendedBy(instance);

exports = module.exports = instance;
