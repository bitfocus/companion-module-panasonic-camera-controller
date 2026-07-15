export function setVariables() {
	return {
		camera: { name: 'Selected Camera' },
		group: { name: 'Selected Group' },
		port: { name: 'Selected Port' },
		pmem: { name: 'Last selected Preset Memory' },
		tmem: { name: 'Last selected Tracing Memory' },
	}
}
export function checkVariables(self) {
	self.setVariableValues({
		camera: self.data.camera ?? undefined,
		group: self.data.group ?? undefined,
		port: self.data.port ?? undefined,
		pmem: self.data.pmem ?? undefined,
		tmem: self.data.tmem ?? undefined,
	})
}
