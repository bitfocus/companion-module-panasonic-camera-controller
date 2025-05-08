export function setVariables(self) {
	return [
		{ variableId: 'camera', name: 'Selected Camera' },
		{ variableId: 'group', name: 'Selected Group' },
		{ variableId: 'port', name: 'Selected Port' },
		{ variableId: 'pmem', name: 'Last selected Preset Memory' },
		{ variableId: 'tmem', name: 'Last selected Tracing Memory' },
	]
}
export function checkVariables(self) {
	self.setVariableValues({
		camera: self.data.camera,
		group: self.data.group,
		port: self.data.port,
		pmem: parseInt(self.data.pmem, 10),
		tmem: parseInt(self.data.tmem, 10),
	})
}
