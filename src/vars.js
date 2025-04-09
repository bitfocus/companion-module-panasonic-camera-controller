export function setVariables(self) {
	const variables = [
		{ variableId: 'camera', name: 'Selected Camera' },
		{ variableId: 'group', name: 'Selected Group' },
		{ variableId: 'port', name: 'Selected Port' },
	]

	return variables
}
export function checkVariables(self) {
	self.setVariableValues({
		camera: self.data.camera,
		group: self.data.group,
		port: self.data.port,
	})
}
