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
		label: 'Controller information',
		value:
			'Panasonic PTZ remote camera controller information.<br /> ' +
			'Please select your controller model, and fill its IP address and its HTTP port in the corresponding fields',
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
		type: 'textinput',
		id: 'httpPort',
		label: 'HTTP port (default: 80)',
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
			'Adjusting the API Polling Interval can impact performance. <br />' +
			'A lower interval allows for more responsive feedback, but may impact CPU usage. <br />' +
			'Less than 500 ms is not recommended, as the controllers are relatively slow to respond',
	},
	{
		type: 'checkbox',
		id: 'enablePolling',
		width: 3,
		label: 'Enable polling',
		default: true,
	},
	{
		type: 'textinput',
		id: 'apiPollInterval',
		label: 'API polling interval (ms) (default: 1000, min: 250)',
		width: 9,
		default: 1000,
		min: 250,
		max: 10000,
		regex: Regex.NUMBER,
	},
	{
		type: 'static-text',
		id: 'space3',
		width: 12,
		label: '',
		value: '',
	},
]
