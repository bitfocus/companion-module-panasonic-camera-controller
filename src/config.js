import { Regex } from '@companion-module/base'
import { MODELS } from './models.js'

export const ConfigFields = [
	{
		type: 'static-text',
		id: 'space1',
		width: 12,
		label: '',
		value: '',
	},
	{
		type: 'static-text',
		id: 'info',
		width: 12,
		label: 'Controller connection setup',
		value: 'Please select your controller model, and fill its IP address and its HTTP port in the corresponding fields',
	},
	{
		type: 'dropdown',
		id: 'model',
		label: 'Model',
		width: 3,
		default: 'AW-RP50',
		choices: MODELS,
		minChoicesForSearch: 5,
	},
	{
		type: 'textinput',
		id: 'host',
		label: 'IP address / Hostname',
		width: 5,
		//regex: Regex.IP,
	},
	{
		type: 'number',
		id: 'port',
		label: 'API port (default: 80)',
		width: 4,
		default: 80,
		regex: Regex.PORT,
	},
	{
		type: 'static-text',
		id: 'space2',
		width: 12,
		label: '',
		value: '',
	},
	{
		type: 'static-text',
		id: 'apiPollInfo',
		width: 12,
		label: 'API poll settings',
		value:
			'The controller is not designed to process simultaneous or consecutive requests. To ensure efficient use, all commands are buffered and transmitted one after the other with a sufficient time gap.<br />' +
			'A lower delay allows for more responsive feedback, but may impact CPU usage.',
	},
	{
		type: 'checkbox',
		id: 'polling',
		width: 2,
		label: 'Enable',
		default: true,
	},
	{
		type: 'static-text',
		id: 'pollInfo',
		width: 7,
		label: 'Polling',
		value:
			'Enables periodic updates of the device status (default: on). This must be activated in order for feedbacks and variables to reflect the current device status. The delay setting specifies the gap between the requests to the device. (default: 100ms)',
	},
	{
		type: 'number',
		id: 'polldelay',
		label: 'Delay (ms)',
		width: 3,
		default: 100,
		min: 25,
		max: 2500,
	},
	{
		type: 'static-text',
		id: 'space3',
		width: 12,
		label: '',
		value: '',
	},
]
