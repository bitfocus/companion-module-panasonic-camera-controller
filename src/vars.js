export function initVariables(self) {
	const variables = [
		{ variableId: 'camera', name: 'Selected Camera' },
		{ variableId: 'group', name: 'Selected Group' },
		{ variableId: 'port', name: 'Selected Port' },
	]

	self.setVariableDefinitions(variables)
}
export function checkVariables(self) {
	self.setVariableValues({
		camera: self.data.camera,
		group: self.data.group,
		port: self.data.port,
	})
}
