import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL, CHOICES_PRESET, CHOICES_TRACING } from "./common.js"

export function initActions(self) {
    var actions = {}

    actions.selectCamera = {
        name: 'Select Camera',
        options: [
            {
                type: 'dropdown',
                label: CAMERA_LABEL,
                id: 'camera',
                default: '1',
                choices: self.product.cameraChoices,
            },
        ],
        callback: async (event) => {
            await self.api.sendCommand(`XCN:01:${event.options.camera}`).then()
        },
    }

    actions.selectGroup = {
        name: 'Select Group',
        options: [
            {
                type: 'dropdown',
                label: 'Group',
                id: 'group',
                default: '1',
                choices: self.product.groupChoices,
            },
        ],
        callback: async (event) => {
            await self.api.sendCommand(`XGP:${event.options.group}`).then()
        },
    }

    actions.selectGroupPort = {
        name: 'Select Group + Port',
        options: [
            {
                type: 'dropdown',
                label: GROUP_LABEL,
                id: 'group',
                default: '1',
                choices: self.product.groupChoices,
            },
            {
                type: 'dropdown',
                label: PORT_LABEL,
                id: 'port',
                default: '1',
                choices: self.product.portChoices,
            },
        ],
        callback: async (event) => {
            await self.api.sendCommand(`XCN:02:${event.options.group}:${event.options.port}`).then()
        },
    }

    actions.selectPort = {
        name: 'Select Port',
        options: [
            {
                type: 'dropdown',
                label: PORT_LABEL,
                id: 'port',
                default: '1',
                choices: self.product.portChoices,
            },
        ],
        callback: async (event) => {
            await self.api.sendCommand(`XPT:${event.options.port}`).then()
        },
    }

    if (self.product.presetMemory == true) {
        actions.presetMemory = {
            name: 'Select Preset Memory',
            options: [
                {
                    type: 'dropdown',
                    label: 'Select Preset',
                    id: 'preset',
                    default: '001',
                    choices: self.product.presetChoices,
                },
            ],
            callback: async (event) => {
                await self.api.sendCommand(`XPM:01:${event.options.preset}`).then()
            },
        }
    }

    if (self.product.tracingMemory == true) {
        actions.tracingMemory = {
            name: 'Select Tracing Memory',
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
                    id: 'trace',
                    choices: self.product.tracingChoices,
                },
            ],
            callback: async (event) => {
                var trace = event.options.trace
                if (event.options.opt == '01') {
                    trace = '000'
                }
                await self.api.sendCommand(`XPM:${event.options.opt}:${trace}`).then()
            },
        }
    }

    self.setActionDefinitions(actions)
}