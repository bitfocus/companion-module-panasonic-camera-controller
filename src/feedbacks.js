import { combineRgb } from "@companion-module/base"
import { CAMERA_LABEL, GROUP_LABEL, PORT_LABEL } from "./common.js"

export function initFeedbacks(self) {
    var p = self.product
    var feedbacks = {}

    const foregroundColor = combineRgb(255, 255, 255) // White
    const backgroundColor = combineRgb(255, 0, 0) // Red

    feedbacks.cameraSelected = {
        type: 'boolean',
        name: 'Camera selected',
        description: 'Indicate if Camera is selected',
        defaultStyle: {
            color: foregroundColor,
            bgcolor: backgroundColor,
        },
        options: [
            {
                type: 'dropdown',
                label: CAMERA_LABEL,
                id: 'camera',
                default: '1',
                choices: p.cameraChoices,
            },
        ],
        callback: async (event) => {
            var opt = event.options
            if (opt.camera == self.data.camera) {
                return true
            }
            return false
        },
    }

    feedbacks.groupSelected = {
        type: 'boolean',
        name: 'Group selected',
        description: 'Indicate if Group is selected',
        defaultStyle: {
            color: foregroundColor,
            bgcolor: backgroundColor,
        },
        options: [
            {
                type: 'dropdown',
                label: GROUP_LABEL,
                id: 'group',
                default: '1',
                choices: p.groupChoices,
            },
        ],
        callback: async (event) => {
            var opt = event.options
            if (opt.group == self.data.group) {
                return true
            }
            return false
        },
    }

    feedbacks.portSelected = {
        type: 'boolean',
        name: 'Port selected',
        description: 'Indicate if Port is selected',
        defaultStyle: {
            color: foregroundColor,
            bgcolor: backgroundColor,
        },
        options: [
            {
                type: 'dropdown',
                label: PORT_LABEL,
                id: 'port',
                default: '1',
                choices: p.portChoices,
            },
        ],
        callback: async (event) => {
            var opt = event.options
            if (opt.port == self.data.port) {
                return true
            }
            return false
        },
    }

    self.setFeedbackDefinitions(feedbacks)
}