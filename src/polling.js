import { checkVariables } from './vars.js'
import { InstanceStatus } from '@companion-module/base'

export function checkConnection(self) {
	const check = function () {
		self.api
			.sendCommand('XQC:01')
			.then(() => {
				self.updateStatus(InstanceStatus.Ok)
				if (self.retryConnection) {
					clearInterval(self.retryConnection)
				}
				self.polling.pause = false
			})
			.catch((error) => {
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Check host/port')
				self.polling.pause = true
				self.log('error', error.message)
				if (!self.retryConnection) {
					self.retryConnection = setInterval(() => {
						check()
					}, 30000)
				}
			})
	}

	if (!self.config.host) {
		self.updateStatus(InstanceStatus.BadConfig, 'Missing host')
		self.polling.pause = true
	} else {
		check()
	}
}

export async function setPolling(self) {
	self.config.apiPollInterval =
		self.config.apiPollInterval === undefined ? 1000 : Math.max(250, self.config.apiPollInterval)

	const parseData = (body) => {
		var str_raw = String(body)
		var str = {}

		str_raw = str_raw.split('\r\n') // Split Data in order to remove data before and after command

		str = str_raw[0].trim() // remove new line, carage return and so on.
		str = str.split(':') // Split Commands and data
		self.log('debug', 'HTTP Received from Controller: ' + str_raw[0]) // Debug Received data

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

		checkVariables(self)
		self.checkFeedbacks()
	}

	const poll = function () {
		if (!self.polling.pause) {
			if (self.polling.alt == true) {
				self.polling.alt = false
				self.api
					.sendCommand('XQC:01')
					.then((data) => {
						parseData(data)
					})
					.catch(async (error) => {
						self.log('error', error.message)
						self.polling.pause = true
					})
			} else {
				self.polling.alt = true
				self.api
					.sendCommand('XQC:02')
					.then((data) => {
						parseData(data)
					})
					.catch(async (error) => {
						self.log('error', error.message)
						self.polling.pause = true
					})
			}
		} else {
			checkConnection(self)
		}
	}

	if (!self.config.enablePolling) {
		self.log('debug', 'polling disabled')
		clearInterval(self.polling.interval)
		self.polling.interval = undefined
	} else {
		self.log('debug', 'polling enabled with interval of ' + self.config.apiPollInterval)
		if (self.polling.interval) {
			clearInterval(self.polling.interval)
			self.polling.interval = undefined
		}
		self.polling.interval = setInterval(poll, self.config.apiPollInterval)
	}
}
